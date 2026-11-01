unit WebStudio.LocalAIHost;
{$B-}

interface

{ Runs the pinned CPU runtime and model once, returning a proposed plan.
  This must run on a worker thread: model verification and inference are slow. }
function RunLocalSitePlan(const RuntimeArchive, ModelFile, Brief: string;
  const ProposalKind: string = 'pages'): string;

implementation

uses
  Winapi.Windows, Winapi.WinSock, System.SysUtils, System.Classes,
  System.IOUtils, System.Hash, System.Zip, System.Net.HttpClient,
  WebStudio.LocalAIProcess, WebStudio.LocalAIClient;

const
  RuntimeArchiveSHA256 = '7605ee19d22ff58053d0df045f972367f6e6fd36bbcd02e7c0633ca639603a85';
  RuntimeServerSHA256 = 'fdd36c37b25b171a4a7f293d52885f4e578064fcfd806800dcc0e5322039b3a8';
  ModelSHA256 = '061b54daade076b5d3362dac252678d17da8c68f07560be70818cace6590cb1a';
  BCRYPT_USE_SYSTEM_PREFERRED_RNG = $00000002;
  TCP_TABLE_OWNER_PID_LISTENER = 3;

type
  TTcpOwnerRow = record
    State, LocalAddress, LocalPort, RemoteAddress, RemotePort, OwnerPid: Cardinal;
  end;
  PTcpOwnerRow = ^TTcpOwnerRow;

function BCryptGenRandom(Algorithm: Pointer; Buffer: PByte; BufferSize, Flags: Cardinal): LongInt; stdcall; external 'bcrypt.dll';
function ConvertStringSecurityDescriptorToSecurityDescriptorW(Descriptor: PWideChar;
  Revision: Cardinal; out SecurityDescriptor: Pointer; Size: PCardinal): BOOL; stdcall; external 'advapi32.dll';
function GetExtendedTcpTable(Table: Pointer; var Size: Cardinal; Order: BOOL;
  AddressFamily, TableClass, Reserved: Cardinal): Cardinal; stdcall; external 'iphlpapi.dll';

function NewPrivateDirectory: string;
var
  Guid: TGUID;
  Descriptor: Pointer;
  Attributes: TSecurityAttributes;
begin
  CreateGUID(Guid);
  Result := TPath.Combine(TPath.GetTempPath, 'webstudio-ai-' + GUIDToString(Guid));
  Descriptor := nil;
  if not ConvertStringSecurityDescriptorToSecurityDescriptorW('D:P(A;;GA;;;OW)(A;;GA;;;SY)', 1, Descriptor, nil) then
    RaiseLastOSError;
  try
    FillChar(Attributes, SizeOf(Attributes), 0);
    Attributes.nLength := SizeOf(Attributes);
    Attributes.lpSecurityDescriptor := Descriptor;
    if not CreateDirectory(PChar(Result), @Attributes) then RaiseLastOSError;
  finally
    LocalFree(HLOCAL(Descriptor));
  end;
end;

function NewAccessKey: string;
var
  Bytes: array[0..31] of Byte;
  Index: Integer;
begin
  if BCryptGenRandom(nil, @Bytes[0], SizeOf(Bytes), BCRYPT_USE_SYSTEM_PREFERRED_RNG) <> 0 then
    raise EInvalidOpException.Create('Unable to create a local AI access key.');
  Result := '';
  for Index := Low(Bytes) to High(Bytes) do
    Result := Result + IntToHex(Bytes[Index], 2);
  FillChar(Bytes, SizeOf(Bytes), 0);
end;

function AllocateLoopbackPort: Word;
var
  Data: TWSAData;
  SocketHandle: TSocket;
  Address: TSockAddrIn;
  AddressSize: Integer;
begin
  if WSAStartup($0202, Data) <> 0 then
    raise EInvalidOpException.Create('Unable to initialize local networking.');
  try
    SocketHandle := socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
    if SocketHandle = INVALID_SOCKET then
      raise EInvalidOpException.Create('Unable to allocate a local AI port.');
    try
      FillChar(Address, SizeOf(Address), 0);
      Address.sin_family := AF_INET;
      Address.sin_addr.S_addr := htonl($7F000001);
      if bind(SocketHandle, Address, SizeOf(Address)) <> 0 then
        raise EInvalidOpException.Create('Unable to allocate a local AI port.');
      AddressSize := SizeOf(Address);
      if getsockname(SocketHandle, Address, AddressSize) <> 0 then
        raise EInvalidOpException.Create('Unable to read the local AI port.');
      Result := ntohs(Address.sin_port);
    finally
      closesocket(SocketHandle);
    end;
  finally
    WSACleanup;
  end;
end;

function OwnsLoopbackPort(Port: Word; ProcessId: Cardinal): Boolean;
var
  Size, Count, Index: Cardinal;
  Table: TBytes;
  Row: PTcpOwnerRow;
begin
  Result := False;
  Size := 0;
  if GetExtendedTcpTable(nil, Size, False, AF_INET, TCP_TABLE_OWNER_PID_LISTENER, 0) <> ERROR_INSUFFICIENT_BUFFER then Exit;
  SetLength(Table, Size);
  if GetExtendedTcpTable(@Table[0], Size, False, AF_INET, TCP_TABLE_OWNER_PID_LISTENER, 0) <> NO_ERROR then Exit;
  Count := PCardinal(@Table[0])^;
  if Count > (Size - SizeOf(Cardinal)) div SizeOf(TTcpOwnerRow) then Exit;
  if Count = 0 then Exit;
  for Index := 0 to Count - 1 do
  begin
    Row := PTcpOwnerRow(@Table[SizeOf(Cardinal) + Index * SizeOf(TTcpOwnerRow)]);
    if (Row^.OwnerPid = ProcessId) and (Row^.LocalAddress = htonl($7F000001)) and
       (ntohs(Word(Row^.LocalPort)) = Port) then Exit(True);
  end;
end;

function RunLocalSitePlan(const RuntimeArchive, ModelFile, Brief, ProposalKind: string): string;
var
  Directory, Key, KeyFile, ServerFile: string;
  Port: Word;
  Process: TLocalAIProcess;
  Http: THTTPClient;
  Deadline: UInt64;
  Ready: Boolean;
begin
  if (Trim(Brief) = '') or (Length(Brief) > 4000) then
    raise EArgumentException.Create('Describe the website in 1 to 4000 characters.');
  if not SameText(THashSHA2.GetHashStringFromFile(RuntimeArchive), RuntimeArchiveSHA256) then
    raise EArgumentException.Create('The local AI runtime ZIP does not match the supported release.');
  if not SameText(THashSHA2.GetHashStringFromFile(ModelFile), ModelSHA256) then
    raise EArgumentException.Create('The local AI model does not match the supported model.');
  Directory := NewPrivateDirectory;
  try
    TZipFile.ExtractZipFile(RuntimeArchive, Directory);
    ServerFile := TPath.Combine(Directory, 'llama-server.exe');
    Key := NewAccessKey;
    KeyFile := TPath.Combine(Directory, 'webstudio-key.txt');
    TFile.WriteAllText(KeyFile, Key, TEncoding.ASCII);
    Port := AllocateLoopbackPort;
    Process := TLocalAIProcess.Create;
    try
      Process.Start(ServerFile, ModelFile, KeyFile, RuntimeServerSHA256, ModelSHA256, Port);
      Http := THTTPClient.Create;
      try
        Http.ConnectionTimeout := 1000;
        Http.ResponseTimeout := 1000;
        Http.HandleRedirects := False;
        Deadline := GetTickCount64 + 120000;
        Ready := False;
        repeat
          if not Process.IsRunning then
            raise EInvalidOpException.Create('The local AI process stopped during startup.');
          if OwnsLoopbackPort(Port, Process.ProcessId) then
            try
              Ready := Http.Get(Format('http://127.0.0.1:%d/health', [Port])).StatusCode = 200;
            except
              Ready := False;
            end;
          if not Ready then Sleep(500);
        until Ready or (GetTickCount64 >= Deadline);
        if not Ready then raise EInvalidOpException.Create('The local AI model did not become ready.');
        if not Process.IsRunning or not OwnsLoopbackPort(Port, Process.ProcessId) then
          raise EInvalidOpException.Create('The local AI process no longer owns its port.');
        Result := GenerateLocalSitePlan(Port, Key, Brief, ProposalKind);
      finally
        Http.Free;
      end;
    finally
      Process.Free;
    end;
  finally
    TDirectory.Delete(Directory, True);
  end;
end;

end.
