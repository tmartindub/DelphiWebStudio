unit WebStudio.SftpConnection;
{$B-}

interface

{ Tests an explicitly requested connection only. It does not upload, remove,
  create, or modify remote files. Authentication uses an SSH key and a
  user-supplied trusted known_hosts file; no password is stored or passed. }
procedure TestSftpConnection(const Host, UserName, KeyFile, KnownHostsFile: string; Port: Word);
procedure DownloadSftpSnapshot(const Host, UserName, KeyFile, KnownHostsFile: string;
  Port: Word; const RemotePath, Destination: string);

implementation

uses Winapi.Windows, System.SysUtils, System.IOUtils;

procedure RunSftp(const Host, UserName, KeyFile, KnownHostsFile: string; Port: Word;
  const Commands: UTF8String; const LimitedFile: string = '');
var
  Index, Attempt: Integer;
  SystemFolder: array[0..MAX_PATH] of Char;
  SftpPath, KeyPath, HostsPath, CommandLine: string;
  Security: TSecurityAttributes;
  Startup: TStartupInfo;
  ProcessInfo: TProcessInformation;
  Limits: JOBOBJECT_EXTENDED_LIMIT_INFORMATION;
  InputRead, InputWrite, NullOutput, Job: THandle;
  Written, WaitResult, ExitCode, ErrorCode: Cardinal;
  FileData: TWin32FileAttributeData;
begin
  if (Host = '') or (UserName = '') or (Port = 0) then
    raise EArgumentException.Create('Enter a host, username and port from 1 to 65535.');
  if (Length(Host) > 253) or (Length(UserName) > 64) or
     not CharInSet(Host[1], ['A'..'Z', 'a'..'z', '0'..'9']) or
     not CharInSet(UserName[1], ['A'..'Z', 'a'..'z', '0'..'9', '_']) then
    raise EArgumentException.Create('Enter a host, username and port from 1 to 65535.');
  for Index := 1 to Length(Host) do
    if not CharInSet(Host[Index], ['A'..'Z', 'a'..'z', '0'..'9', '.', '-']) then
      raise EArgumentException.Create('The host must be a DNS name or IPv4 address.');
  for Index := 1 to Length(UserName) do
    if not CharInSet(UserName[Index], ['A'..'Z', 'a'..'z', '0'..'9', '.', '_', '-']) then
      raise EArgumentException.Create('The username contains unsupported characters.');
  KeyPath := ExpandFileName(KeyFile);
  HostsPath := ExpandFileName(KnownHostsFile);
  for Index := 1 to Length(KeyPath) do
    if KeyPath[Index] < #32 then
      raise EArgumentException.Create('The key paths contain an unsupported character.');
  for Index := 1 to Length(HostsPath) do
    if HostsPath[Index] < #32 then
      raise EArgumentException.Create('The key paths contain an unsupported character.');
  if (KeyFile = '') or (KnownHostsFile = '') or not TFile.Exists(KeyPath) or
     not TFile.Exists(HostsPath) or (Pos('"', KeyPath + HostsPath) > 0) then
    raise EArgumentException.Create('Choose an existing private key and trusted known_hosts file.');
  if GetSystemDirectory(SystemFolder, Length(SystemFolder)) = 0 then RaiseLastOSError;
  SftpPath := TPath.Combine(string(SystemFolder), 'OpenSSH\sftp.exe');
  if not TFile.Exists(SftpPath) then
    raise EInvalidOpException.Create('Windows OpenSSH sftp.exe is not installed.');

  InputRead := 0; InputWrite := 0; NullOutput := 0; Job := 0;
  FillChar(ProcessInfo, SizeOf(ProcessInfo), 0);
  try
    FillChar(Security, SizeOf(Security), 0);
    Security.nLength := SizeOf(Security);
    Security.bInheritHandle := True;
    if not CreatePipe(InputRead, InputWrite, @Security, 0) then RaiseLastOSError;
    if not SetHandleInformation(InputWrite, HANDLE_FLAG_INHERIT, 0) then RaiseLastOSError;
    NullOutput := CreateFile('NUL', GENERIC_WRITE, FILE_SHARE_READ or FILE_SHARE_WRITE,
      @Security, OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, 0);
    if NullOutput = INVALID_HANDLE_VALUE then begin NullOutput := 0; RaiseLastOSError end;
    Job := CreateJobObject(nil, nil);
    if Job = 0 then RaiseLastOSError;
    FillChar(Limits, SizeOf(Limits), 0);
    Limits.BasicLimitInformation.LimitFlags := JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
    if not SetInformationJobObject(Job, JobObjectExtendedLimitInformation, @Limits, SizeOf(Limits)) then RaiseLastOSError;
    CommandLine := Format('"%s" -F NUL -o BatchMode=yes -o StrictHostKeyChecking=yes ' +
      '-o "UserKnownHostsFile=\"%s\"" -o GlobalKnownHostsFile=NUL -o UpdateHostKeys=no ' +
      '-o ClearAllForwardings=yes -o PermitLocalCommand=no -o ConnectTimeout=12 ' +
      '-o IdentitiesOnly=yes -i "%s" -P %d -b - %s@%s',
      [SftpPath, HostsPath, KeyPath, Port, UserName, Host]);
    UniqueString(CommandLine);
    FillChar(Startup, SizeOf(Startup), 0);
    Startup.cb := SizeOf(Startup);
    Startup.dwFlags := STARTF_USESTDHANDLES or STARTF_USESHOWWINDOW;
    Startup.wShowWindow := SW_HIDE;
    Startup.hStdInput := InputRead;
    Startup.hStdOutput := NullOutput;
    Startup.hStdError := NullOutput;
    if not CreateProcess(PChar(SftpPath), PChar(CommandLine), nil, nil, True,
      CREATE_SUSPENDED or CREATE_NO_WINDOW, nil, nil, Startup, ProcessInfo) then RaiseLastOSError;
    if not AssignProcessToJobObject(Job, ProcessInfo.hProcess) then begin
      ErrorCode := GetLastError; TerminateProcess(ProcessInfo.hProcess, 1); RaiseLastOSError(ErrorCode)
    end;
    if ResumeThread(ProcessInfo.hThread) = Cardinal(-1) then begin
      ErrorCode := GetLastError; TerminateJobObject(Job, 1); RaiseLastOSError(ErrorCode)
    end;
    CloseHandle(InputRead); InputRead := 0;
    if not WriteFile(InputWrite, Commands[1], Length(Commands), Written, nil) or
       (Written <> Cardinal(Length(Commands))) then RaiseLastOSError;
    CloseHandle(InputWrite); InputWrite := 0;
    for Attempt := 1 to 200 do begin
      WaitResult := WaitForSingleObject(ProcessInfo.hProcess, 100);
      if (LimitedFile <> '') and GetFileAttributesEx(PChar(LimitedFile), GetFileExInfoStandard, @FileData) and
         ((FileData.nFileSizeHigh <> 0) or (FileData.nFileSizeLow > 2 * 1024 * 1024)) then begin
        TerminateJobObject(Job, 1);
        WaitForSingleObject(ProcessInfo.hProcess, 5000);
        raise EInvalidOpException.Create('The saved snapshot exceeds the 2 MiB limit.')
      end;
      if WaitResult <> WAIT_TIMEOUT then Break;
    end;
    if WaitResult = WAIT_TIMEOUT then begin
      TerminateJobObject(Job, 1);
      WaitForSingleObject(ProcessInfo.hProcess, 5000);
      raise EInvalidOpException.Create('SFTP connection timed out.')
    end;
    if WaitResult <> WAIT_OBJECT_0 then RaiseLastOSError;
    if not GetExitCodeProcess(ProcessInfo.hProcess, ExitCode) then RaiseLastOSError;
    if ExitCode <> 0 then raise EInvalidOpException.Create('SFTP operation failed. Check the connection, trusted host key, and requested file.')
  finally
    if ProcessInfo.hThread <> 0 then CloseHandle(ProcessInfo.hThread);
    if ProcessInfo.hProcess <> 0 then CloseHandle(ProcessInfo.hProcess);
    if InputRead <> 0 then CloseHandle(InputRead);
    if InputWrite <> 0 then CloseHandle(InputWrite);
    if NullOutput <> 0 then CloseHandle(NullOutput);
    if Job <> 0 then CloseHandle(Job);
  end;
end;

procedure TestSftpConnection(const Host, UserName, KeyFile, KnownHostsFile: string; Port: Word);
begin
  RunSftp(Host, UserName, KeyFile, KnownHostsFile, Port, 'pwd'#10'quit'#10);
end;

procedure DownloadSftpSnapshot(const Host, UserName, KeyFile, KnownHostsFile: string;
  Port: Word; const RemotePath, Destination: string);
var
  Index: Integer;
  Part: string;
  Parts: TArray<string>;
  TempDirectory, TempFile, TargetFile: string;
  UniqueId: TGUID;
begin
  if (Length(RemotePath) < 2) or (Length(RemotePath) > 1024) or (RemotePath[1] <> '/') then
    raise EArgumentException.Create('Enter an absolute remote snapshot path.');
  for Index := 1 to Length(RemotePath) do
    if not CharInSet(RemotePath[Index], ['A'..'Z', 'a'..'z', '0'..'9', '/', '.', '_', '-']) then
      raise EArgumentException.Create('The remote snapshot path contains unsupported characters.');
  Parts := RemotePath.Split(['/']);
  for Index := 1 to Length(Parts) - 1 do begin
    Part := Parts[Index];
    if (Part = '') or (Part = '.') or (Part = '..') then
      raise EArgumentException.Create('The remote snapshot path contains an invalid folder or filename.');
  end;
  if Destination = '' then raise EArgumentException.Create('Choose a new local snapshot filename.');
  TargetFile := ExpandFileName(Destination);
  for Index := 1 to Length(TargetFile) do
    if TargetFile[Index] < #32 then
      raise EArgumentException.Create('The local snapshot filename contains an unsupported character.');
  if (Pos('"', TargetFile) > 0) or not TDirectory.Exists(ExtractFileDir(TargetFile)) then
    raise EArgumentException.Create('Choose a valid local snapshot filename.');
  if TFile.Exists(TargetFile) or TDirectory.Exists(TargetFile) then
    raise EArgumentException.Create('Choose a new local filename; existing files are not replaced.');
  if CreateGUID(UniqueId) <> 0 then raise EInvalidOpException.Create('Could not create a temporary snapshot folder.');
  TempDirectory := TPath.Combine(ExtractFileDir(TargetFile), '.webstudio-sftp-' + GUIDToString(UniqueId));
  if TDirectory.Exists(TempDirectory) or not CreateDir(TempDirectory) then
    raise EInvalidOpException.Create('Could not create a temporary snapshot folder.');
  TempFile := TPath.Combine(TempDirectory, 'snapshot.json');
  try
    RunSftp(Host, UserName, KeyFile, KnownHostsFile, Port,
      UTF8String('get "' + RemotePath + '" "' + StringReplace(TempFile, '\', '/', [rfReplaceAll]) + '"'#10'quit'#10), TempFile);
    if not TFile.Exists(TempFile) then raise EInvalidOpException.Create('The snapshot was not downloaded.');
    if not MoveFile(PChar(TempFile), PChar(TargetFile)) then RaiseLastOSError;
  finally
    if TFile.Exists(TempFile) then DeleteFile(PChar(TempFile));
    RemoveDir(TempDirectory);
  end;
end;

end.
