unit WebStudio.SftpInventory;
{$B-}

interface

uses System.Classes;

type
  TSftpInventoryEntry = record
    Path: string;
    Size: UInt64;
    Sha256: string;
  end;
  TSftpTransferReceipt = record
    Path: string;
    Size: UInt64;
    Sha256: string;
    PreviousPath: string;
  end;

{ Read-only SFTP directory inventory. Unsupported entries fail the scan. }
function ScanSftpInventory(const Host, UserName, KeyFile, KnownHostsFile: string;
  Port: Word; const RemoteDirectory: string): TArray<TSftpInventoryEntry>;
procedure SaveSftpInventory(const Entries: TArray<TSftpInventoryEntry>; const Destination: string);
procedure BackupSftpDestination(const Host, UserName, KeyFile, KnownHostsFile: string;
  Port: Word; const RemoteDirectory, Destination: string);
{ Internal primitive, not connected to the UI. It relies on SFTP v3's
  no-overwrite rename semantics and verifies a new file. It does not review a
  deployment, back up the destination, replace existing files or restore them.
  Do not expose it without the required review and explicit confirmation. }
function UploadNewSftpFile(const Host, UserName, KeyFile, KnownHostsFile: string;
  Port: Word; const RemoteDirectory, RemoteName, LocalFile: string): TSftpTransferReceipt;
function UploadNewSftpFileWithId(const Host, UserName, KeyFile, KnownHostsFile: string;
  Port: Word; const RemoteDirectory, RemoteName, LocalFile: string;
  const OperationId: TGUID): TSftpTransferReceipt;
function ReplaceSftpFile(const Host, UserName, KeyFile, KnownHostsFile: string;
  Port: Word; const RemoteDirectory, RecoveryDirectory, RemoteName, LocalFile: string;
  ExpectedSize: UInt64; const ExpectedSha256: string): TSftpTransferReceipt;
function ReplaceSftpFileWithId(const Host, UserName, KeyFile, KnownHostsFile: string;
  Port: Word; const RemoteDirectory, RecoveryDirectory, RemoteName, LocalFile: string;
  ExpectedSize: UInt64; const ExpectedSha256: string; const OperationId: TGUID): TSftpTransferReceipt;
function TransferSftpStreamWithId(const Host, UserName, KeyFile, KnownHostsFile: string;
  Port: Word; const RemoteDirectory, RecoveryDirectory, RemoteName: string; Source: TStream;
  Replacing: Boolean; ExpectedSize: UInt64; const ExpectedSha256: string;
  const OperationId: TGUID): TSftpTransferReceipt;
{ Replacement is also internal. The caller must first review the full diff,
  back up the destination, and obtain explicit publication confirmation. The
  original is retained under the receipt's PreviousPath; it is never deleted.
  The recovery directory must be outside all server-served website paths. }
{ Internal rollback primitive; not connected to the UI. Both files must match
  reviewed hashes. The displaced current file is retained, never deleted. }
function RestoreSftpOriginal(const Host, UserName, KeyFile, KnownHostsFile: string;
  Port: Word; const RemoteDirectory, RecoveryDirectory, RemoteName, PreviousName: string;
  CurrentSize: UInt64; const CurrentSha256: string; OriginalSize: UInt64;
  const OriginalSha256: string): TSftpTransferReceipt;
{ Internal transfer primitive, not connected to the UI. Creates missing
  directories only; it never follows links or removes existing entries. }
function EnsureSftpDirectories(const Host, UserName, KeyFile, KnownHostsFile: string;
  Port: Word; const RemoteDirectory, RelativeDirectory: string): TArray<string>;
function NormalizePrivateRecoveryDirectory(const WebsiteDirectory, RecoveryDirectory: string): string;
procedure CheckPrivateSftpRecovery(const Host, UserName, KeyFile, KnownHostsFile: string;
  Port: Word; const WebsiteDirectory, RecoveryDirectory: string);

implementation

uses Winapi.Windows, System.SysUtils, System.IOUtils, System.Hash, System.JSON, System.Zip,
  System.Generics.Collections;

type
  TSftpScanner = class
  private
    FInput, FOutput, FJob: THandle;
    FProcess: TProcessInformation;
    FDeadline: UInt64;
    FId: Cardinal;
    FTotalBytes: UInt64;
    FEntries: TList<TSftpInventoryEntry>;
    FBackupNames: TDictionary<string, Boolean>;
    FBackup: TZipFile;
    procedure ReadExact(var Buffer; Count: Cardinal);
    procedure SendPacket(Stream: TBytesStream);
    function ReceivePacket: TBytesStream;
    function Request(Kind: Byte; const Value: TBytes; const Extra: TBytes = nil): TBytesStream;
    function HashFile(const RemotePath: string; ExpectedSize: UInt64; Capture: TStream = nil): string;
    procedure RequireRegularFile(const RemotePath: string; ExpectedSize: UInt64);
    procedure RequireDirectoryChain(const RemotePath: string);
    procedure Initialize;
    procedure RenameNoReplace(const OldPath, NewPath: string);
    function UploadFile(const RemoteDirectory, RecoveryDirectory, RemoteName: string; Source: TStream;
      Replacing: Boolean; ExpectedSize: UInt64; const ExpectedSha256: string;
      const OperationId: TGUID): TSftpTransferReceipt;
    function RestoreOriginal(const RemoteDirectory, RecoveryDirectory, RemoteName, PreviousName: string;
      CurrentSize: UInt64; const CurrentSha256: string; OriginalSize: UInt64;
      const OriginalSha256: string): TSftpTransferReceipt;
    function EnsureDirectories(const RemoteDirectory, RelativeDirectory: string): TArray<string>;
    procedure ScanDirectory(const Root, Relative: string; Depth: Integer);
  public
    constructor Create(const Host, UserName, KeyFile, KnownHostsFile: string; Port: Word);
    destructor Destroy; override;
    function Scan(const RemoteDirectory: string): TArray<TSftpInventoryEntry>;
  end;

function NormalizePrivateRecoveryDirectory(const WebsiteDirectory, RecoveryDirectory: string): string;
var Website, Recovery, Part, Path: string; Index: Integer;
begin
  Website := WebsiteDirectory;
  Recovery := RecoveryDirectory;
  for Path in TArray<string>.Create(Website, Recovery) do begin
    if (Path = '') or (Path[1] <> '/') or (Length(Path) > 1024) or (Pos('\', Path) > 0) or (Pos('//', Path) > 0) then
      raise EArgumentException.Create('Website and recovery folders must be absolute SFTP paths.');
    for Part in Path.Split(['/']) do
      if (Part = '.') or (Part = '..') then raise EArgumentException.Create('Invalid website or recovery folder.');
    for Index := 1 to Length(Path) do
      if Path[Index] < #32 then raise EArgumentException.Create('Invalid website or recovery folder.');
  end;
  while (Length(Website) > 1) and Website.EndsWith('/') do Delete(Website, Length(Website), 1);
  while (Length(Recovery) > 1) and Recovery.EndsWith('/') do Delete(Recovery, Length(Recovery), 1);
  if (Website = '/') or (Recovery = '/') or SameText(Website, Recovery) or
     LowerCase(Recovery).StartsWith(LowerCase(Website) + '/') or
     LowerCase(Website).StartsWith(LowerCase(Recovery) + '/') then
    raise EArgumentException.Create('Choose a private recovery folder separate from the website folder.');
  Result := Recovery + '/';
end;

procedure PutUInt32(Stream: TStream; Value: Cardinal);
var Buffer: array[0..3] of Byte;
begin
  Buffer[0] := (Value shr 24) and $FF; Buffer[1] := (Value shr 16) and $FF;
  Buffer[2] := (Value shr 8) and $FF; Buffer[3] := Value and $FF;
  Stream.WriteBuffer(Buffer, 4);
end;

function GetUInt32(Stream: TStream): Cardinal;
var Buffer: array[0..3] of Byte;
begin
  Stream.ReadBuffer(Buffer, 4);
  Result := (Cardinal(Buffer[0]) shl 24) or (Cardinal(Buffer[1]) shl 16) or
    (Cardinal(Buffer[2]) shl 8) or Cardinal(Buffer[3]);
end;

procedure PutBytes(Stream: TStream; const Value: TBytes);
begin
  PutUInt32(Stream, Length(Value));
  if Length(Value) > 0 then Stream.WriteBuffer(Value[0], Length(Value));
end;

function GetBytes(Stream: TStream): TBytes;
var Count: Cardinal;
begin
  Count := GetUInt32(Stream);
  if (Count > 1024 * 1024) or (Int64(Count) > Stream.Size - Stream.Position) then
    raise EInvalidOpException.Create('Invalid SFTP response length.');
  SetLength(Result, Count);
  if Count > 0 then Stream.ReadBuffer(Result[0], Count);
end;

constructor TSftpScanner.Create(const Host, UserName, KeyFile, KnownHostsFile: string; Port: Word);
var
  I: Integer;
  SystemFolder: array[0..MAX_PATH] of Char;
  SshPath, KeyPath, HostsPath, CommandLine: string;
  Security: TSecurityAttributes;
  Startup: TStartupInfo;
  Limits: JOBOBJECT_EXTENDED_LIMIT_INFORMATION;
  ChildInput, ChildOutput, NullOutput: THandle;
begin
  inherited Create;
  FEntries := TList<TSftpInventoryEntry>.Create;
  FBackupNames := TDictionary<string, Boolean>.Create;
  if (Host = '') or (UserName = '') or (Port = 0) then
    raise EArgumentException.Create('Enter a host, username and port.');
  if not CharInSet(Host[1], ['A'..'Z', 'a'..'z', '0'..'9']) or
     not CharInSet(UserName[1], ['A'..'Z', 'a'..'z', '0'..'9', '_']) then
    raise EArgumentException.Create('Invalid host or username.');
  for I := 1 to Length(Host) do
    if not CharInSet(Host[I], ['A'..'Z', 'a'..'z', '0'..'9', '.', '-']) then
      raise EArgumentException.Create('Invalid host.');
  for I := 1 to Length(UserName) do
    if not CharInSet(UserName[I], ['A'..'Z', 'a'..'z', '0'..'9', '.', '_', '-']) then
      raise EArgumentException.Create('Invalid username.');
  if (Length(Host) > 253) or (Length(UserName) > 64) or (KeyFile = '') or (KnownHostsFile = '') then
    raise EArgumentException.Create('Invalid connection details.');
  KeyPath := ExpandFileName(KeyFile); HostsPath := ExpandFileName(KnownHostsFile);
  if not TFile.Exists(KeyPath) or not TFile.Exists(HostsPath) or (Pos('"', KeyPath + HostsPath) > 0) then
    raise EArgumentException.Create('Choose an existing private key and trusted known_hosts file.');
  for I := 1 to Length(KeyPath) do if KeyPath[I] < #32 then raise EArgumentException.Create('Invalid key path.');
  for I := 1 to Length(HostsPath) do if HostsPath[I] < #32 then raise EArgumentException.Create('Invalid trusted hosts path.');
  if GetSystemDirectory(SystemFolder, Length(SystemFolder)) = 0 then RaiseLastOSError;
  SshPath := TPath.Combine(string(SystemFolder), 'OpenSSH\ssh.exe');
  if not TFile.Exists(SshPath) then raise EInvalidOpException.Create('Windows OpenSSH is not installed.');
  ChildInput := 0; ChildOutput := 0; NullOutput := 0;
  try
    FillChar(Security, SizeOf(Security), 0); Security.nLength := SizeOf(Security); Security.bInheritHandle := True;
    if not CreatePipe(ChildInput, FInput, @Security, 0) then RaiseLastOSError;
    if not SetHandleInformation(FInput, HANDLE_FLAG_INHERIT, 0) then RaiseLastOSError;
    if not CreatePipe(FOutput, ChildOutput, @Security, 0) then RaiseLastOSError;
    if not SetHandleInformation(FOutput, HANDLE_FLAG_INHERIT, 0) then RaiseLastOSError;
    NullOutput := CreateFile('NUL', GENERIC_WRITE, FILE_SHARE_READ or FILE_SHARE_WRITE,
      @Security, OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, 0);
    if NullOutput = INVALID_HANDLE_VALUE then begin NullOutput := 0; RaiseLastOSError end;
    FJob := CreateJobObject(nil, nil);
    if FJob = 0 then RaiseLastOSError;
    FillChar(Limits, SizeOf(Limits), 0);
    Limits.BasicLimitInformation.LimitFlags := JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
    if not SetInformationJobObject(FJob, JobObjectExtendedLimitInformation, @Limits, SizeOf(Limits)) then RaiseLastOSError;
    CommandLine := Format('"%s" -T -F NUL -o BatchMode=yes -o StrictHostKeyChecking=yes ' +
      '-o "UserKnownHostsFile=\"%s\"" -o GlobalKnownHostsFile=NUL -o UpdateHostKeys=no ' +
      '-o ClearAllForwardings=yes -o PermitLocalCommand=no -o ConnectTimeout=12 ' +
      '-o IdentitiesOnly=yes -i "%s" -p %d -s %s@%s sftp',
      [SshPath, HostsPath, KeyPath, Port, UserName, Host]);
    UniqueString(CommandLine);
    FillChar(Startup, SizeOf(Startup), 0); Startup.cb := SizeOf(Startup);
    Startup.dwFlags := STARTF_USESTDHANDLES or STARTF_USESHOWWINDOW; Startup.wShowWindow := SW_HIDE;
    Startup.hStdInput := ChildInput; Startup.hStdOutput := ChildOutput; Startup.hStdError := NullOutput;
    if not CreateProcess(PChar(SshPath), PChar(CommandLine), nil, nil, True,
      CREATE_SUSPENDED or CREATE_NO_WINDOW, nil, nil, Startup, FProcess) then RaiseLastOSError;
    if not AssignProcessToJobObject(FJob, FProcess.hProcess) then begin
      TerminateProcess(FProcess.hProcess, 1); raise EInvalidOpException.Create('Could not control the SFTP process.')
    end;
    if ResumeThread(FProcess.hThread) = Cardinal(-1) then RaiseLastOSError;
    FDeadline := GetTickCount64 + 60000;
  finally
    if ChildInput <> 0 then CloseHandle(ChildInput);
    if ChildOutput <> 0 then CloseHandle(ChildOutput);
    if NullOutput <> 0 then CloseHandle(NullOutput);
  end;
end;

destructor TSftpScanner.Destroy;
begin
  if FInput <> 0 then CloseHandle(FInput);
  if FOutput <> 0 then CloseHandle(FOutput);
  if FJob <> 0 then CloseHandle(FJob);
  if FProcess.hThread <> 0 then CloseHandle(FProcess.hThread);
  if FProcess.hProcess <> 0 then CloseHandle(FProcess.hProcess);
  FEntries.Free;
  FBackupNames.Free;
  inherited;
end;

procedure TSftpScanner.ReadExact(var Buffer; Count: Cardinal);
var Available, Actual, Offset: Cardinal;
begin
  Offset := 0;
  while Offset < Count do begin
    if GetTickCount64 >= FDeadline then raise EInvalidOpException.Create('SFTP inventory timed out.');
    if not PeekNamedPipe(FOutput, nil, 0, nil, @Available, nil) then
      raise EInvalidOpException.Create('SFTP connection closed while reading the destination.');
    if Available = 0 then begin Sleep(20); Continue end;
    if Available > Count - Offset then Available := Count - Offset;
    if not ReadFile(FOutput, PByte(NativeUInt(@Buffer) + Offset)^, Available, Actual, nil) or (Actual = 0) then
      raise EInvalidOpException.Create('Could not read the SFTP response.');
    Inc(Offset, Actual);
  end;
end;

procedure TSftpScanner.SendPacket(Stream: TBytesStream);
var Header: array[0..3] of Byte; Count, Written: Cardinal;
begin
  Count := Stream.Size;
  Header[0] := (Count shr 24) and $FF; Header[1] := (Count shr 16) and $FF;
  Header[2] := (Count shr 8) and $FF; Header[3] := Count and $FF;
  if not WriteFile(FInput, Header, 4, Written, nil) or (Written <> 4) then raise EInvalidOpException.Create('Could not send SFTP request.');
  if (Count > 0) and (not WriteFile(FInput, Stream.Bytes[0], Count, Written, nil) or (Written <> Count)) then
    raise EInvalidOpException.Create('Could not send SFTP request.');
end;

function TSftpScanner.ReceivePacket: TBytesStream;
var Header: array[0..3] of Byte; Count: Cardinal; Bytes: TBytes;
begin
  ReadExact(Header, 4);
  Count := (Cardinal(Header[0]) shl 24) or (Cardinal(Header[1]) shl 16) or (Cardinal(Header[2]) shl 8) or Header[3];
  if (Count = 0) or (Count > 1024 * 1024) then raise EInvalidOpException.Create('Invalid SFTP packet size.');
  SetLength(Bytes, Count); ReadExact(Bytes[0], Count);
  Result := TBytesStream.Create(Bytes);
end;

function TSftpScanner.Request(Kind: Byte; const Value: TBytes; const Extra: TBytes): TBytesStream;
var Packet: TBytesStream; ResponseKind: Byte; Id: Cardinal;
begin
  Inc(FId); Id := FId;
  Packet := TBytesStream.Create;
  try
    Packet.WriteBuffer(Kind, 1); PutUInt32(Packet, Id); PutBytes(Packet, Value);
    if Length(Extra) > 0 then Packet.WriteBuffer(Extra[0], Length(Extra));
    SendPacket(Packet);
  finally Packet.Free end;
  Result := ReceivePacket;
  try
    Result.ReadBuffer(ResponseKind, 1);
    if GetUInt32(Result) <> Id then raise EInvalidOpException.Create('Unexpected SFTP response.');
    Result.Position := 0;
  except Result.Free; raise end;
end;

function TSftpScanner.HashFile(const RemotePath: string; ExpectedSize: UInt64; Capture: TStream): string;
var
  Packet, Extra: TBytesStream;
  Kind: Byte;
  Handle, Data, RequestData: TBytes;
  Offset: UInt64;
  Requested: Cardinal;
  Hash: THashSHA2;
begin
  if (ExpectedSize > 512 * 1024 * 1024) or (FTotalBytes + ExpectedSize > 512 * 1024 * 1024) then
    raise EInvalidOpException.Create('The destination exceeds the 512 MiB scan limit.');
  if Assigned(Capture) and (ExpectedSize > 64 * 1024 * 1024) then
    raise EInvalidOpException.Create('A destination file exceeds the 64 MiB backup limit.');
  Inc(FTotalBytes, ExpectedSize);
  Extra := TBytesStream.Create;
  try
    PutUInt32(Extra, 1); PutUInt32(Extra, 0);
    RequestData := Copy(Extra.Bytes, 0, Extra.Size);
  finally Extra.Free end;
  Packet := Request(3, TEncoding.UTF8.GetBytes(RemotePath), RequestData);
  try
    Packet.ReadBuffer(Kind, 1); GetUInt32(Packet);
    if Kind <> 102 then raise EInvalidOpException.Create('Cannot read a destination file.');
    Handle := GetBytes(Packet);
    if Length(Handle) > 256 then raise EInvalidOpException.Create('Invalid SFTP file handle.');
  finally Packet.Free end;
  Hash := THashSHA2.Create;
  Offset := 0;
  repeat
    if Offset < ExpectedSize then begin
      Requested := 65536;
      if ExpectedSize - Offset < Requested then Requested := Cardinal(ExpectedSize - Offset);
    end else Requested := 1;
    Extra := TBytesStream.Create;
    try
      PutUInt32(Extra, Cardinal(Offset shr 32)); PutUInt32(Extra, Cardinal(Offset)); PutUInt32(Extra, Requested);
      RequestData := Copy(Extra.Bytes, 0, Extra.Size);
    finally Extra.Free end;
    Packet := Request(5, Handle, RequestData);
    try
      Packet.ReadBuffer(Kind, 1); GetUInt32(Packet);
      if Kind = 101 then begin
        if (GetUInt32(Packet) <> 1) or (Offset <> ExpectedSize) then
          raise EInvalidOpException.Create('A destination file changed or could not be read during the scan.');
        Break;
      end;
      if Kind <> 103 then raise EInvalidOpException.Create('Unexpected SFTP file response.');
      Data := GetBytes(Packet);
      if (Length(Data) = 0) or (Cardinal(Length(Data)) > Requested) or (UInt64(Length(Data)) > ExpectedSize - Offset) then
        raise EInvalidOpException.Create('A destination file changed during the scan.');
      Hash.Update(Data, Length(Data));
      if Assigned(Capture) then Capture.WriteBuffer(Data[0], Length(Data));
      Inc(Offset, Length(Data));
    finally Packet.Free end;
  until False;
  Packet := Request(4, Handle);
  try
    Packet.ReadBuffer(Kind, 1); GetUInt32(Packet);
    if (Kind <> 101) or (GetUInt32(Packet) <> 0) then raise EInvalidOpException.Create('Could not close the SFTP file.');
  finally Packet.Free end;
  Result := LowerCase(Hash.HashAsString);
end;

procedure TSftpScanner.ScanDirectory(const Root, Relative: string; Depth: Integer);
var
  Packet: TBytesStream;
  Kind: Byte;
  Handle, NameBytes: TBytes;
  Count, Index, Flags, Mode, Extended, X: Cardinal;
  Size: UInt64;
  Name, Path, BaseName: string;
  Entry: TSftpInventoryEntry;
  Capture: TMemoryStream;
begin
  if Depth > 32 then raise EInvalidOpException.Create('The destination has too many nested folders.');
  Packet := Request(11, TEncoding.UTF8.GetBytes(Root + Relative));
  try
    Packet.ReadBuffer(Kind, 1); GetUInt32(Packet);
    if Kind <> 102 then raise EInvalidOpException.Create('Cannot open the SFTP destination folder.');
    Handle := GetBytes(Packet);
    if Length(Handle) > 256 then raise EInvalidOpException.Create('Invalid SFTP directory handle.');
  finally Packet.Free end;
  repeat
    Packet := Request(12, Handle);
    try
      Packet.ReadBuffer(Kind, 1); GetUInt32(Packet);
      if Kind = 101 then begin
        if GetUInt32(Packet) <> 1 then raise EInvalidOpException.Create('Cannot list the SFTP destination.');
        Break;
      end;
      if Kind <> 104 then raise EInvalidOpException.Create('Unexpected SFTP directory response.');
      Count := GetUInt32(Packet);
      if Count > 10000 then raise EInvalidOpException.Create('The destination contains too many files.');
      for Index := 1 to Count do begin
        NameBytes := GetBytes(Packet); GetBytes(Packet);
        if not TEncoding.UTF8.IsBufferValid(NameBytes) then raise EInvalidOpException.Create('The destination contains a filename that is not valid UTF-8.');
        Name := TEncoding.UTF8.GetString(NameBytes);
        Flags := GetUInt32(Packet); Size := 0; Mode := 0;
        if Flags and 1 <> 0 then Size := (UInt64(GetUInt32(Packet)) shl 32) or GetUInt32(Packet);
        if Flags and 2 <> 0 then begin GetUInt32(Packet); GetUInt32(Packet) end;
        if Flags and 4 <> 0 then Mode := GetUInt32(Packet);
        if Flags and 8 <> 0 then begin GetUInt32(Packet); GetUInt32(Packet) end;
        if Flags and $80000000 <> 0 then begin
          Extended := GetUInt32(Packet);
          if Extended > 1024 then raise EInvalidOpException.Create('Invalid SFTP file attributes.');
          for X := 1 to Extended do begin GetBytes(Packet); GetBytes(Packet) end;
        end;
        if (Name = '.') or (Name = '..') then Continue;
        if (Name = '') or (Pos('/', Name) > 0) or (Pos('\', Name) > 0) then raise EInvalidOpException.Create('Invalid destination filename.');
        for X := 1 to Length(Name) do if Name[X] < #32 then raise EInvalidOpException.Create('Unsupported destination filename.');
        if Assigned(FBackup) then begin
          BaseName := UpperCase(Name);
          if Pos('.', BaseName) > 0 then BaseName := Copy(BaseName, 1, Pos('.', BaseName) - 1);
          if Name.EndsWith('.') or Name.EndsWith(' ') or (Pos(':', Name) > 0) or
             (Pos('*', Name) > 0) or (Pos('?', Name) > 0) or (Pos('"', Name) > 0) or
             (Pos('<', Name) > 0) or (Pos('>', Name) > 0) or (Pos('|', Name) > 0) or
             (BaseName = 'CON') or (BaseName = 'PRN') or (BaseName = 'AUX') or (BaseName = 'NUL') or
             ((Length(BaseName) = 4) and ((Copy(BaseName, 1, 3) = 'COM') or (Copy(BaseName, 1, 3) = 'LPT')) and CharInSet(BaseName[4], ['1'..'9'])) then
            raise EInvalidOpException.Create('The destination contains a filename that cannot be safely backed up.');
        end;
        Path := Relative + Name;
        if Length(TEncoding.UTF8.GetBytes(Root + Path)) > 2048 then
          raise EInvalidOpException.Create('The destination contains a path that is too long to scan.');
        if Assigned(FBackup) then begin
          if FBackupNames.ContainsKey(LowerCase(Path)) then
            raise EInvalidOpException.Create('The destination contains names that collide on Windows.');
          FBackupNames.Add(LowerCase(Path), True);
        end;
        case Mode and $F000 of
          $4000: begin
            if Assigned(FBackup) then FBackup.Add(TBytes(nil), Path + '/');
            ScanDirectory(Root, Path + '/', Depth + 1);
          end;
          $8000: begin
            if Flags and 1 = 0 then raise EInvalidOpException.Create('The server did not provide a file size.');
            if FEntries.Count >= 10000 then raise EInvalidOpException.Create('The destination contains too many files.');
            Entry.Path := Path; Entry.Size := Size;
            if Assigned(FBackup) then begin
              Capture := TMemoryStream.Create;
              try
                Entry.Sha256 := HashFile(Root + Path, Size, Capture);
                Capture.Position := 0;
                FBackup.Add(Capture, Path);
              finally Capture.Free end;
            end else Entry.Sha256 := HashFile(Root + Path, Size);
            FEntries.Add(Entry);
          end;
        else raise EInvalidOpException.Create('The destination contains a link or unsupported file type; the scan is incomplete.');
        end;
      end;
    finally Packet.Free end;
  until False;
  Packet := Request(4, Handle);
  try
    Packet.ReadBuffer(Kind, 1); GetUInt32(Packet);
    if (Kind <> 101) or (GetUInt32(Packet) <> 0) then raise EInvalidOpException.Create('Could not close the SFTP directory.');
  finally Packet.Free end;
end;

procedure TSftpScanner.Initialize;
var Packet: TBytesStream; Kind: Byte;
begin
  Packet := TBytesStream.Create;
  try Kind := 1; Packet.WriteBuffer(Kind, 1); PutUInt32(Packet, 3); SendPacket(Packet) finally Packet.Free end;
  Packet := ReceivePacket;
  try
    Packet.ReadBuffer(Kind, 1);
    if (Kind <> 2) or (GetUInt32(Packet) <> 3) then raise EInvalidOpException.Create('The server does not support SFTP version 3.');
  finally Packet.Free end;
end;

function TSftpScanner.Scan(const RemoteDirectory: string): TArray<TSftpInventoryEntry>;
var Path, Part: string; Index: Integer;
begin
  if (RemoteDirectory = '') or (Length(RemoteDirectory) > 1024) or (RemoteDirectory[1] <> '/') or (Pos('\', RemoteDirectory) > 0) then
    raise EArgumentException.Create('Enter an absolute SFTP destination folder.');
  for Index := 1 to Length(RemoteDirectory) do
    if RemoteDirectory[Index] < #32 then raise EArgumentException.Create('Invalid destination folder.');
  for Part in RemoteDirectory.Split(['/']) do
    if (Part = '.') or (Part = '..') then raise EArgumentException.Create('The destination folder cannot contain dot segments.');
  Path := RemoteDirectory;
  if not Path.EndsWith('/') then Path := Path + '/';
  Initialize;
  ScanDirectory(Path, '', 0);
  Result := FEntries.ToArray;
end;

procedure TSftpScanner.RenameNoReplace(const OldPath, NewPath: string);
var Packet, Extra: TBytesStream; RequestData: TBytes; Kind: Byte;
begin
  Extra := TBytesStream.Create;
  try
    PutBytes(Extra, TEncoding.UTF8.GetBytes(NewPath));
    RequestData := Copy(Extra.Bytes, 0, Extra.Size);
  finally Extra.Free end;
  Packet := Request(18, TEncoding.UTF8.GetBytes(OldPath), RequestData);
  try
    Packet.ReadBuffer(Kind, 1); GetUInt32(Packet);
    if (Kind <> 101) or (GetUInt32(Packet) <> 0) then
      raise EInvalidOpException.Create('The server refused a non-overwriting rename.');
  finally Packet.Free end;
end;

procedure TSftpScanner.RequireRegularFile(const RemotePath: string; ExpectedSize: UInt64);
var Packet: TBytesStream; Kind: Byte; Flags, Mode: Cardinal; Size: UInt64;
begin
  Packet := Request(7, TEncoding.UTF8.GetBytes(RemotePath));
  try
    Packet.ReadBuffer(Kind, 1); GetUInt32(Packet);
    if Kind <> 105 then raise EInvalidOpException.Create('Cannot inspect the reviewed destination file.');
    Flags := GetUInt32(Packet);
    if (Flags and 1 = 0) or (Flags and 4 = 0) then
      raise EInvalidOpException.Create('The server did not provide the destination file type and size.');
    Size := (UInt64(GetUInt32(Packet)) shl 32) or GetUInt32(Packet);
    if Flags and 2 <> 0 then begin GetUInt32(Packet); GetUInt32(Packet) end;
    Mode := GetUInt32(Packet);
    if (Mode and $F000 <> $8000) or (Size <> ExpectedSize) then
      raise EInvalidOpException.Create('The destination is not the reviewed regular file.');
  finally Packet.Free end;
end;

procedure TSftpScanner.RequireDirectoryChain(const RemotePath: string);
var Current, Part: string;
  procedure CheckDirectory(const Path: string);
  var Packet: TBytesStream; Kind: Byte; Flags, Mode: Cardinal;
  begin
    Packet := Request(7, TEncoding.UTF8.GetBytes(Path));
    try
      Packet.ReadBuffer(Kind, 1); GetUInt32(Packet);
      if Kind <> 105 then raise EInvalidOpException.Create('Cannot inspect folder ' + Path + '.');
      Flags := GetUInt32(Packet);
      if Flags and 1 <> 0 then begin GetUInt32(Packet); GetUInt32(Packet) end;
      if Flags and 2 <> 0 then begin GetUInt32(Packet); GetUInt32(Packet) end;
      if Flags and 4 = 0 then raise EInvalidOpException.Create('The server did not provide a folder type.');
      Mode := GetUInt32(Packet);
      if Mode and $F000 <> $4000 then raise EInvalidOpException.Create('A folder is a link or unsupported type: ' + Path + '.');
    finally Packet.Free end;
  end;
begin
  Current := '/';
  CheckDirectory(Current);
  for Part in RemotePath.Split(['/']) do begin
    if Part = '' then Continue;
    if Current.EndsWith('/') then Current := Current + Part else Current := Current + '/' + Part;
    CheckDirectory(Current);
  end;
end;

function TSftpScanner.UploadFile(const RemoteDirectory, RecoveryDirectory, RemoteName: string; Source: TStream;
  Replacing: Boolean; ExpectedSize: UInt64; const ExpectedSha256: string;
  const OperationId: TGUID): TSftpTransferReceipt;
var
  Root, RecoveryRoot, Part, TempPath, TargetPath, PreviousPath, LocalHash, RemoteHash: string;
  Index, ReadCount: Integer;
  Packet, Extra: TBytesStream;
  Handle, RequestData, Bytes: TBytes;
  Kind: Byte;
  Offset: UInt64;
  Hash: THashSHA2;
  Created, Renamed, RenameAttempted, MoveAttempted, OriginalMoved: Boolean;
begin
  if (RemoteDirectory = '') or (Length(RemoteDirectory) > 1024) or (RemoteDirectory[1] <> '/') or (Pos('\', RemoteDirectory) > 0) then
    raise EArgumentException.Create('Enter an absolute SFTP destination folder.');
  for Part in RemoteDirectory.Split(['/']) do
    if (Part = '.') or (Part = '..') then raise EArgumentException.Create('Invalid destination folder.');
  for Index := 1 to Length(RemoteDirectory) do
    if RemoteDirectory[Index] < #32 then raise EArgumentException.Create('Invalid destination folder.');
  if (RemoteName = '') or (RemoteName = '.') or (RemoteName = '..') or (Pos('/', RemoteName) > 0) or
     (Pos('\', RemoteName) > 0) or (Length(TEncoding.UTF8.GetBytes(RemoteName)) > 255) then
    raise EArgumentException.Create('Invalid destination filename.');
  for Index := 1 to Length(RemoteName) do
    if RemoteName[Index] < #32 then raise EArgumentException.Create('Invalid destination filename.');
  if (Source.Size < 0) or (Source.Size > 64 * 1024 * 1024) then
    raise EArgumentException.Create('The file exceeds the 64 MiB transfer limit.');
  if Replacing then begin
    if (ExpectedSize > 64 * 1024 * 1024) or (Length(ExpectedSha256) <> 64) then
      raise EArgumentException.Create('The reviewed original file metadata is invalid.');
    for Index := 1 to Length(ExpectedSha256) do
      if not CharInSet(ExpectedSha256[Index], ['0'..'9', 'a'..'f', 'A'..'F']) then
        raise EArgumentException.Create('The reviewed original checksum is invalid.');
  end;
  Root := RemoteDirectory;
  if not Root.EndsWith('/') then Root := Root + '/';
  TargetPath := Root + RemoteName;
  if GUIDToString(OperationId) = '{00000000-0000-0000-0000-000000000000}' then
    raise EArgumentException.Create('A unique transfer identifier is required.');
  RecoveryRoot := '';
  if Replacing then RecoveryRoot := NormalizePrivateRecoveryDirectory(RemoteDirectory, RecoveryDirectory);
  if Replacing then TempPath := RecoveryRoot + '.webstudio-upload-' + GUIDToString(OperationId) + '.tmp'
  else TempPath := Root + '.webstudio-upload-' + GUIDToString(OperationId) + '.tmp';
  PreviousPath := RecoveryRoot + '.webstudio-original-' + GUIDToString(OperationId) + '.bak';
  Initialize;
  Created := False;
  Renamed := False;
  RenameAttempted := False;
  MoveAttempted := False;
  OriginalMoved := False;
  try
    if Replacing then begin
      RequireDirectoryChain(RemoteDirectory);
      RequireDirectoryChain(RecoveryRoot);
      RequireRegularFile(TargetPath, ExpectedSize);
      if HashFile(TargetPath, ExpectedSize) <> LowerCase(ExpectedSha256) then
        raise EInvalidOpException.Create('The destination file no longer matches the reviewed scan.');
    end;
    Extra := TBytesStream.Create;
    try
      PutUInt32(Extra, 2 or 8 or 32); PutUInt32(Extra, 0);
      RequestData := Copy(Extra.Bytes, 0, Extra.Size);
    finally Extra.Free end;
    Packet := Request(3, TEncoding.UTF8.GetBytes(TempPath), RequestData);
    try
      Packet.ReadBuffer(Kind, 1); GetUInt32(Packet);
      if Kind <> 102 then raise EInvalidOpException.Create('Cannot create the remote staging file.');
      Handle := GetBytes(Packet);
      if Length(Handle) > 256 then raise EInvalidOpException.Create('Invalid SFTP file handle.');
      Created := True;
    finally Packet.Free end;
    Source.Position := 0;
    Hash := THashSHA2.Create;
    Offset := 0;
    SetLength(Bytes, 2048);
    repeat
      ReadCount := Source.Read(Bytes[0], Length(Bytes));
      if ReadCount = 0 then Break;
      if Offset + UInt64(ReadCount) > UInt64(Source.Size) then
        raise EInvalidOpException.Create('The local file changed during transfer.');
      Hash.Update(Bytes[0], ReadCount);
      Extra := TBytesStream.Create;
      try
        PutUInt32(Extra, Cardinal(Offset shr 32)); PutUInt32(Extra, Cardinal(Offset));
        PutUInt32(Extra, ReadCount); Extra.WriteBuffer(Bytes[0], ReadCount);
        RequestData := Copy(Extra.Bytes, 0, Extra.Size);
      finally Extra.Free end;
      Packet := Request(6, Handle, RequestData);
      try
        Packet.ReadBuffer(Kind, 1); GetUInt32(Packet);
        if (Kind <> 101) or (GetUInt32(Packet) <> 0) then raise EInvalidOpException.Create('The remote write failed.');
      finally Packet.Free end;
      Inc(Offset, ReadCount);
    until False;
    if Offset <> UInt64(Source.Size) then raise EInvalidOpException.Create('The local file changed during transfer.');
    Packet := Request(4, Handle);
    try
      Packet.ReadBuffer(Kind, 1); GetUInt32(Packet);
      if (Kind <> 101) or (GetUInt32(Packet) <> 0) then raise EInvalidOpException.Create('Could not close the staged file.');
    finally Packet.Free end;
    LocalHash := LowerCase(Hash.HashAsString);
    RemoteHash := HashFile(TempPath, Offset);
    if LocalHash <> RemoteHash then raise EInvalidOpException.Create('The staged file verification failed.');
    if Replacing then begin
      MoveAttempted := True;
      RenameNoReplace(TargetPath, PreviousPath);
      OriginalMoved := True;
      RequireRegularFile(PreviousPath, ExpectedSize);
      if HashFile(PreviousPath, ExpectedSize) <> LowerCase(ExpectedSha256) then
        raise EInvalidOpException.Create('The destination file changed after review.');
    end;
    RenameAttempted := True;
    RenameNoReplace(TempPath, TargetPath);
    Renamed := True;
    if HashFile(TargetPath, Offset) <> LocalHash then
      raise EInvalidOpException.Create('The destination file verification failed.');
    Result.Path := TargetPath;
    Result.Size := Offset;
    Result.Sha256 := LocalHash;
    if Replacing then Result.PreviousPath := PreviousPath else Result.PreviousPath := '';
  except
    on E: Exception do begin
      if OriginalMoved and not Renamed then begin
        try RenameNoReplace(PreviousPath, TargetPath) except end;
      end;
      if MoveAttempted then begin
        if Renamed then raise EInvalidOpException.Create(E.Message + ' The destination may exist at ' + TargetPath + ' and the original may remain at ' + PreviousPath + '; inspect both before retrying.');
        raise EInvalidOpException.Create(E.Message + ' Inspect ' + TargetPath + ' and the possible original at ' + PreviousPath + ' before retrying. A staging file may remain at ' + TempPath + '.');
      end;
      if Renamed then raise EInvalidOpException.Create(E.Message + ' The destination file may exist at ' + TargetPath + '; inspect it before retrying.');
      if RenameAttempted then raise EInvalidOpException.Create(E.Message + ' The destination file may exist at ' + TargetPath + ' and a staging file may remain at ' + TempPath + '; inspect both before retrying.');
      if Created then raise EInvalidOpException.Create(E.Message + ' A staging file may remain at ' + TempPath + '.');
      raise;
    end;
  end;
end;

function TSftpScanner.RestoreOriginal(const RemoteDirectory, RecoveryDirectory, RemoteName, PreviousName: string;
  CurrentSize: UInt64; const CurrentSha256: string; OriginalSize: UInt64;
  const OriginalSha256: string): TSftpTransferReceipt;
var
  Root, RecoveryRoot, Part, TargetPath, PreviousPath, DisplacedPath: string;
  Index: Integer;
  UniqueId: TGUID;
  MoveAttempted, CurrentMoved, OriginalRestored: Boolean;
begin
  if (RemoteDirectory = '') or (Length(RemoteDirectory) > 1024) or (RemoteDirectory[1] <> '/') or (Pos('\', RemoteDirectory) > 0) then
    raise EArgumentException.Create('Enter an absolute SFTP destination folder.');
  for Part in RemoteDirectory.Split(['/']) do
    if (Part = '.') or (Part = '..') then raise EArgumentException.Create('Invalid destination folder.');
  for Index := 1 to Length(RemoteDirectory) do
    if RemoteDirectory[Index] < #32 then raise EArgumentException.Create('Invalid destination folder.');
  if (RemoteName = '') or (RemoteName = '.') or (RemoteName = '..') or
     (Pos('/', RemoteName) > 0) or (Pos('\', RemoteName) > 0) or
     (Length(TEncoding.UTF8.GetBytes(RemoteName)) > 255) then
    raise EArgumentException.Create('Invalid destination filename.');
  for Index := 1 to Length(RemoteName) do
    if RemoteName[Index] < #32 then raise EArgumentException.Create('Invalid destination filename.');
  if not PreviousName.StartsWith('.webstudio-original-') or not PreviousName.EndsWith('.bak') or
     (Length(PreviousName) > 255) or (Pos('/', PreviousName) > 0) or (Pos('\', PreviousName) > 0) then
    raise EArgumentException.Create('Choose an original file from a replacement receipt.');
  for Index := 1 to Length(PreviousName) do
    if PreviousName[Index] < #32 then raise EArgumentException.Create('Invalid original filename.');
  if (CurrentSize > 64 * 1024 * 1024) or (OriginalSize > 64 * 1024 * 1024) or
     (Length(CurrentSha256) <> 64) or (Length(OriginalSha256) <> 64) then
    raise EArgumentException.Create('The reviewed rollback metadata is invalid.');
  for Index := 1 to 64 do
    if not CharInSet(CurrentSha256[Index], ['0'..'9', 'a'..'f', 'A'..'F']) or
       not CharInSet(OriginalSha256[Index], ['0'..'9', 'a'..'f', 'A'..'F']) then
      raise EArgumentException.Create('The reviewed rollback checksum is invalid.');
  Root := RemoteDirectory;
  if not Root.EndsWith('/') then Root := Root + '/';
  RecoveryRoot := NormalizePrivateRecoveryDirectory(RemoteDirectory, RecoveryDirectory);
  TargetPath := Root + RemoteName;
  PreviousPath := RecoveryRoot + PreviousName;
  if TargetPath = PreviousPath then raise EArgumentException.Create('The original and destination must be different files.');
  if CreateGUID(UniqueId) <> 0 then raise EInvalidOpException.Create('Could not create a rollback staging filename.');
  DisplacedPath := RecoveryRoot + '.webstudio-displaced-' + GUIDToString(UniqueId) + '.bak';
  Initialize;
  RequireDirectoryChain(RemoteDirectory);
  RequireDirectoryChain(RecoveryRoot);
  RequireRegularFile(TargetPath, CurrentSize);
  if HashFile(TargetPath, CurrentSize) <> LowerCase(CurrentSha256) then
    raise EInvalidOpException.Create('The destination file no longer matches the reviewed scan.');
  RequireRegularFile(PreviousPath, OriginalSize);
  if HashFile(PreviousPath, OriginalSize) <> LowerCase(OriginalSha256) then
    raise EInvalidOpException.Create('The retained original no longer matches the reviewed receipt.');
  MoveAttempted := False; CurrentMoved := False; OriginalRestored := False;
  try
    MoveAttempted := True;
    RenameNoReplace(TargetPath, DisplacedPath);
    CurrentMoved := True;
    RequireRegularFile(DisplacedPath, CurrentSize);
    if HashFile(DisplacedPath, CurrentSize) <> LowerCase(CurrentSha256) then
      raise EInvalidOpException.Create('The destination file changed after review.');
    RenameNoReplace(PreviousPath, TargetPath);
    OriginalRestored := True;
    RequireRegularFile(TargetPath, OriginalSize);
    if HashFile(TargetPath, OriginalSize) <> LowerCase(OriginalSha256) then
      raise EInvalidOpException.Create('The restored file verification failed.');
    Result.Path := TargetPath;
    Result.Size := OriginalSize;
    Result.Sha256 := LowerCase(OriginalSha256);
    Result.PreviousPath := DisplacedPath;
  except
    on E: Exception do begin
      if CurrentMoved and not OriginalRestored then begin
        try RenameNoReplace(DisplacedPath, TargetPath) except end;
      end;
      if MoveAttempted then raise EInvalidOpException.Create(E.Message +
        ' Inspect the destination at ' + TargetPath + ', the possible original at ' + PreviousPath +
        ', and the possible displaced file at ' + DisplacedPath + ' before retrying.');
      raise;
    end;
  end;
end;

function TSftpScanner.EnsureDirectories(const RemoteDirectory, RelativeDirectory: string): TArray<string>;
var
  Root, Part, Current: string;
  Parts: TArray<string>;
  Index: Integer;
  Created: TStringList;
  MutationAttempted: Boolean;

  function DirectoryExists(const Path: string): Boolean;
  var Packet: TBytesStream; Kind: Byte; Status, Flags, Mode: Cardinal;
  begin
    Packet := Request(7, TEncoding.UTF8.GetBytes(Path));
    try
      Packet.ReadBuffer(Kind, 1); GetUInt32(Packet);
      if Kind = 101 then begin
        Status := GetUInt32(Packet);
        if Status = 2 then Exit(False);
        raise EInvalidOpException.Create('Cannot inspect destination folder ' + Path + '.');
      end;
      if Kind <> 105 then raise EInvalidOpException.Create('Unexpected destination folder response.');
      Flags := GetUInt32(Packet);
      if Flags and 1 <> 0 then begin GetUInt32(Packet); GetUInt32(Packet) end;
      if Flags and 2 <> 0 then begin GetUInt32(Packet); GetUInt32(Packet) end;
      if Flags and 4 = 0 then raise EInvalidOpException.Create('The server did not provide the destination folder type.');
      Mode := GetUInt32(Packet);
      if Mode and $F000 <> $4000 then raise EInvalidOpException.Create('A destination path is not a regular directory: ' + Path + '.');
      Result := True;
    finally Packet.Free end;
  end;

  procedure EnsureDirectory(const Path: string; MayCreate: Boolean);
  var Packet: TBytesStream; Kind: Byte; Status: Cardinal; Attributes: TBytes;
  begin
    if DirectoryExists(Path) then Exit;
    if not MayCreate then raise EInvalidOpException.Create('The destination root does not exist.');
    SetLength(Attributes, 4); FillChar(Attributes[0], 4, 0);
    MutationAttempted := True;
    Packet := Request(14, TEncoding.UTF8.GetBytes(Path), Attributes);
    try
      Packet.ReadBuffer(Kind, 1); GetUInt32(Packet);
      if Kind <> 101 then raise EInvalidOpException.Create('Unexpected response while creating a destination folder.');
      Status := GetUInt32(Packet);
      if Status = 0 then Created.Add(Path)
      else raise EInvalidOpException.Create('Cannot create destination folder ' + Path + '.');
    finally Packet.Free end;
    if not DirectoryExists(Path) then raise EInvalidOpException.Create('The destination folder was not created.');
  end;

begin
  if (RemoteDirectory = '') or (Length(RemoteDirectory) > 1024) or
     (RemoteDirectory[1] <> '/') or (Pos('\', RemoteDirectory) > 0) then
    raise EArgumentException.Create('Enter an absolute SFTP destination folder.');
  for Part in RemoteDirectory.Split(['/']) do
    if (Part = '.') or (Part = '..') then raise EArgumentException.Create('Invalid destination folder.');
  for Index := 1 to Length(RemoteDirectory) do
    if RemoteDirectory[Index] < #32 then raise EArgumentException.Create('Invalid destination folder.');
  if (Pos('\', RelativeDirectory) > 0) or (Pos(':', RelativeDirectory) > 0) then
    raise EArgumentException.Create('Invalid relative destination folder.');
  if RelativeDirectory = '' then SetLength(Parts, 0)
  else begin
    Parts := RelativeDirectory.Split(['/']);
    if Length(Parts) > 32 then raise EArgumentException.Create('Too many destination folders.');
    for Part in Parts do begin
      if (Part = '') or (Part = '.') or (Part = '..') then raise EArgumentException.Create('Invalid relative destination folder.');
      for Index := 1 to Length(Part) do
        if Part[Index] < #32 then raise EArgumentException.Create('Invalid relative destination folder.');
    end;
  end;
  Root := RemoteDirectory;
  while (Length(Root) > 1) and Root.EndsWith('/') do Delete(Root, Length(Root), 1);
  Current := Root;
  Created := TStringList.Create;
  try
    MutationAttempted := False;
    Initialize;
    try
      EnsureDirectory(Current, False);
      for Part in Parts do begin
        if Current.EndsWith('/') then Current := Current + Part else Current := Current + '/' + Part;
        if Length(TEncoding.UTF8.GetBytes(Current)) > 2048 then raise EArgumentException.Create('Destination folder path is too long.');
        EnsureDirectory(Current, True);
      end;
      Result := Created.ToStringArray;
    except
      on E: Exception do begin
        if Created.Count > 0 then raise EInvalidOpException.Create(E.Message + ' Created folders remain: ' + StringReplace(Trim(Created.Text), sLineBreak, ', ', [rfReplaceAll]) + '. Inspect the requested folder ' + Current + ' before retrying.');
        if MutationAttempted then raise EInvalidOpException.Create(E.Message + ' The requested folder may exist at ' + Current + '; inspect it before retrying.');
        raise;
      end;
    end;
  finally Created.Free end;
end;

function ScanSftpInventory(const Host, UserName, KeyFile, KnownHostsFile: string;
  Port: Word; const RemoteDirectory: string): TArray<TSftpInventoryEntry>;
var Scanner: TSftpScanner;
begin
  Scanner := TSftpScanner.Create(Host, UserName, KeyFile, KnownHostsFile, Port);
  try Result := Scanner.Scan(RemoteDirectory) finally Scanner.Free end;
end;

procedure SaveSftpInventory(const Entries: TArray<TSftpInventoryEntry>; const Destination: string);
var
  Entry: TSftpInventoryEntry;
  Document, Item: TJSONObject;
  Files: TJSONArray;
  Bytes: TBytes;
  Output: THandle;
  Written: Cardinal;
begin
  Document := TJSONObject.Create;
  try
    Document.AddPair('format', 'webstudio-website-manifest');
    Document.AddPair('version', TJSONNumber.Create(1));
    Files := TJSONArray.Create;
    Document.AddPair('files', Files);
    for Entry in Entries do begin
      Item := TJSONObject.Create;
      Item.AddPair('path', Entry.Path);
      Item.AddPair('size', TJSONNumber.Create(Int64(Entry.Size)));
      Item.AddPair('sha256', Entry.Sha256);
      Files.AddElement(Item);
    end;
    Bytes := TEncoding.UTF8.GetBytes(Document.ToJSON);
    if Length(Bytes) > 2 * 1024 * 1024 then
      raise EInvalidOpException.Create('The scan is too large for the Export comparison.');
  finally Document.Free end;
  Output := CreateFile(PChar(Destination), GENERIC_WRITE, 0, nil, CREATE_NEW, FILE_ATTRIBUTE_NORMAL, 0);
  if Output = INVALID_HANDLE_VALUE then RaiseLastOSError;
  try
    if (Length(Bytes) > 0) and (not WriteFile(Output, Bytes[0], Length(Bytes), Written, nil) or (Written <> Cardinal(Length(Bytes)))) then
      raise EInvalidOpException.Create('Could not write the complete scan file.');
  finally CloseHandle(Output) end;
end;

procedure BackupSftpDestination(const Host, UserName, KeyFile, KnownHostsFile: string;
  Port: Word; const RemoteDirectory, Destination: string);
var
  TargetFile, TempDirectory, TempZip: string;
  UniqueId: TGUID;
  Scanner: TSftpScanner;
  Archive: TZipFile;
begin
  if Destination = '' then raise EArgumentException.Create('Choose a new backup ZIP filename.');
  TargetFile := ExpandFileName(Destination);
  if not TDirectory.Exists(ExtractFileDir(TargetFile)) or TFile.Exists(TargetFile) or TDirectory.Exists(TargetFile) then
    raise EArgumentException.Create('Choose a new backup ZIP filename; existing files are not replaced.');
  if CreateGUID(UniqueId) <> 0 then raise EInvalidOpException.Create('Could not create a temporary backup folder.');
  TempDirectory := TPath.Combine(ExtractFileDir(TargetFile), '.webstudio-backup-' + GUIDToString(UniqueId));
  if TDirectory.Exists(TempDirectory) or not CreateDir(TempDirectory) then
    raise EInvalidOpException.Create('Could not create a temporary backup folder.');
  TempZip := TPath.Combine(TempDirectory, 'backup.zip');
  try
    Archive := TZipFile.Create;
    try
      Archive.Open(TempZip, zmWrite);
      Scanner := TSftpScanner.Create(Host, UserName, KeyFile, KnownHostsFile, Port);
      try
        Scanner.FBackup := Archive;
        Scanner.Scan(RemoteDirectory);
      finally Scanner.Free end;
      Archive.Close;
    finally Archive.Free end;
    if not MoveFile(PChar(TempZip), PChar(TargetFile)) then RaiseLastOSError;
  finally
    if TFile.Exists(TempZip) then DeleteFile(PChar(TempZip));
    RemoveDir(TempDirectory);
  end;
end;

function UploadNewSftpFile(const Host, UserName, KeyFile, KnownHostsFile: string;
  Port: Word; const RemoteDirectory, RemoteName, LocalFile: string): TSftpTransferReceipt;
var OperationId: TGUID;
begin
  if CreateGUID(OperationId) <> 0 then raise EInvalidOpException.Create('Could not create a transfer identifier.');
  Result := UploadNewSftpFileWithId(Host, UserName, KeyFile, KnownHostsFile, Port,
    RemoteDirectory, RemoteName, LocalFile, OperationId);
end;

function UploadNewSftpFileWithId(const Host, UserName, KeyFile, KnownHostsFile: string;
  Port: Word; const RemoteDirectory, RemoteName, LocalFile: string;
  const OperationId: TGUID): TSftpTransferReceipt;
var Scanner: TSftpScanner; Source: TFileStream;
begin
  Source := TFileStream.Create(LocalFile, fmOpenRead or fmShareDenyWrite);
  try
    Scanner := TSftpScanner.Create(Host, UserName, KeyFile, KnownHostsFile, Port);
    try Result := Scanner.UploadFile(RemoteDirectory, '', RemoteName, Source, False, 0, '', OperationId) finally Scanner.Free end;
  finally Source.Free end;
end;

function ReplaceSftpFile(const Host, UserName, KeyFile, KnownHostsFile: string;
  Port: Word; const RemoteDirectory, RecoveryDirectory, RemoteName, LocalFile: string;
  ExpectedSize: UInt64; const ExpectedSha256: string): TSftpTransferReceipt;
var OperationId: TGUID;
begin
  if CreateGUID(OperationId) <> 0 then raise EInvalidOpException.Create('Could not create a transfer identifier.');
  Result := ReplaceSftpFileWithId(Host, UserName, KeyFile, KnownHostsFile, Port,
    RemoteDirectory, RecoveryDirectory, RemoteName, LocalFile, ExpectedSize, ExpectedSha256, OperationId);
end;

function ReplaceSftpFileWithId(const Host, UserName, KeyFile, KnownHostsFile: string;
  Port: Word; const RemoteDirectory, RecoveryDirectory, RemoteName, LocalFile: string;
  ExpectedSize: UInt64; const ExpectedSha256: string; const OperationId: TGUID): TSftpTransferReceipt;
var Scanner: TSftpScanner; Source: TFileStream;
begin
  Source := TFileStream.Create(LocalFile, fmOpenRead or fmShareDenyWrite);
  try
    Scanner := TSftpScanner.Create(Host, UserName, KeyFile, KnownHostsFile, Port);
    try Result := Scanner.UploadFile(RemoteDirectory, RecoveryDirectory, RemoteName, Source, True, ExpectedSize, ExpectedSha256, OperationId) finally Scanner.Free end;
  finally Source.Free end;
end;

function TransferSftpStreamWithId(const Host, UserName, KeyFile, KnownHostsFile: string;
  Port: Word; const RemoteDirectory, RecoveryDirectory, RemoteName: string; Source: TStream;
  Replacing: Boolean; ExpectedSize: UInt64; const ExpectedSha256: string;
  const OperationId: TGUID): TSftpTransferReceipt;
var Scanner: TSftpScanner;
begin
  if not Assigned(Source) then raise EArgumentException.Create('A transfer source is required.');
  Scanner := TSftpScanner.Create(Host, UserName, KeyFile, KnownHostsFile, Port);
  try
    Result := Scanner.UploadFile(RemoteDirectory, RecoveryDirectory, RemoteName, Source,
      Replacing, ExpectedSize, ExpectedSha256, OperationId);
  finally Scanner.Free end;
end;

function RestoreSftpOriginal(const Host, UserName, KeyFile, KnownHostsFile: string;
  Port: Word; const RemoteDirectory, RecoveryDirectory, RemoteName, PreviousName: string;
  CurrentSize: UInt64; const CurrentSha256: string; OriginalSize: UInt64;
  const OriginalSha256: string): TSftpTransferReceipt;
var Scanner: TSftpScanner;
begin
  Scanner := TSftpScanner.Create(Host, UserName, KeyFile, KnownHostsFile, Port);
  try
    Result := Scanner.RestoreOriginal(RemoteDirectory, RecoveryDirectory, RemoteName, PreviousName,
      CurrentSize, CurrentSha256, OriginalSize, OriginalSha256);
  finally Scanner.Free end;
end;

function EnsureSftpDirectories(const Host, UserName, KeyFile, KnownHostsFile: string;
  Port: Word; const RemoteDirectory, RelativeDirectory: string): TArray<string>;
var Scanner: TSftpScanner;
begin
  Scanner := TSftpScanner.Create(Host, UserName, KeyFile, KnownHostsFile, Port);
  try Result := Scanner.EnsureDirectories(RemoteDirectory, RelativeDirectory) finally Scanner.Free end;
end;

procedure CheckPrivateSftpRecovery(const Host, UserName, KeyFile, KnownHostsFile: string;
  Port: Word; const WebsiteDirectory, RecoveryDirectory: string);
var Scanner: TSftpScanner; RecoveryRoot: string;
begin
  RecoveryRoot := NormalizePrivateRecoveryDirectory(WebsiteDirectory, RecoveryDirectory);
  Scanner := TSftpScanner.Create(Host, UserName, KeyFile, KnownHostsFile, Port);
  try
    Scanner.Initialize;
    Scanner.RequireDirectoryChain(WebsiteDirectory);
    Scanner.RequireDirectoryChain(RecoveryRoot);
  finally Scanner.Free end;
end;

end.
