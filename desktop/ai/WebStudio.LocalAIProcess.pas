unit WebStudio.LocalAIProcess;

interface

uses
  Winapi.Windows, System.SysUtils;

type
  { Starts only an explicitly configured local llama-server. The caller owns
    model/runtime verification, protected key-file creation, and readiness. }
  TLocalAIProcess = class
  private
    FProcess: THandle;
    FJob: THandle;
  public
    destructor Destroy; override;
    procedure Start(const ServerPath, ModelPath, KeyFile: string; Port: Word);
    procedure Stop;
    function IsRunning: Boolean;
  end;

implementation

uses
  System.IOUtils;

destructor TLocalAIProcess.Destroy;
begin
  Stop;
  inherited;
end;

function TLocalAIProcess.IsRunning: Boolean;
var
  ExitCode: Cardinal;
begin
  Result := (FProcess <> 0) and GetExitCodeProcess(FProcess, ExitCode) and
    (ExitCode = STILL_ACTIVE);
end;

procedure TLocalAIProcess.Start(const ServerPath, ModelPath, KeyFile: string;
  Port: Word);
var
  ServerName, ModelName, KeyName, Key, CommandLine: string;
  Startup: TStartupInfo;
  ProcessInfo: TProcessInformation;
  Limits: JOBOBJECT_EXTENDED_LIMIT_INFORMATION;
  Index: Integer;
  ErrorCode: Cardinal;
begin
  if FProcess <> 0 then
    raise EInvalidOpException.Create('Stop the existing local AI process first.');
  if Port = 0 then
    raise EArgumentException.Create('A nonzero loopback port is required.');
  ServerName := ExpandFileName(ServerPath);
  ModelName := ExpandFileName(ModelPath);
  KeyName := ExpandFileName(KeyFile);
  if (not SameText(ExtractFileName(ServerName), 'llama-server.exe')) or
     (not SameText(ExtractFileExt(ModelName), '.gguf')) or
     (not TFile.Exists(ServerName)) or (not TFile.Exists(ModelName)) or
     (not TFile.Exists(KeyName)) or (Pos('"', ServerName + ModelName + KeyName) > 0) then
    raise EArgumentException.Create('Local AI runtime, model, or key file is invalid.');
  if TFile.GetSize(KeyName) > 256 then
    raise EArgumentException.Create('Local AI key file is invalid.');
  Key := Trim(TFile.ReadAllText(KeyName));
  if Length(Key) < 32 then
    raise EArgumentException.Create('Local AI key file is invalid.');
  for Index := 1 to Length(Key) do
    if not CharInSet(Key[Index], ['0'..'9', 'A'..'F', 'a'..'f']) then
      raise EArgumentException.Create('Local AI key file is invalid.');

  FJob := CreateJobObject(nil, nil);
  if FJob = 0 then RaiseLastOSError;
  try
    FillChar(Limits, SizeOf(Limits), 0);
    Limits.BasicLimitInformation.LimitFlags := JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
    if not SetInformationJobObject(FJob, JobObjectExtendedLimitInformation,
      @Limits, SizeOf(Limits)) then RaiseLastOSError;
    CommandLine := Format('"%s" --model "%s" --api-key-file "%s" --host 127.0.0.1 --port %d --offline --no-webui --no-slots --parallel 1',
      [ServerName, ModelName, KeyName, Port]);
    UniqueString(CommandLine);
    FillChar(Startup, SizeOf(Startup), 0);
    Startup.cb := SizeOf(Startup);
    Startup.dwFlags := STARTF_USESHOWWINDOW;
    Startup.wShowWindow := SW_HIDE;
    FillChar(ProcessInfo, SizeOf(ProcessInfo), 0);
    if not CreateProcess(PChar(ServerName), PChar(CommandLine), nil, nil, False,
      CREATE_SUSPENDED or CREATE_NO_WINDOW, nil, PChar(ExtractFilePath(ServerName)),
      Startup, ProcessInfo) then RaiseLastOSError;
    try
      if not AssignProcessToJobObject(FJob, ProcessInfo.hProcess) then
      begin
        ErrorCode := GetLastError;
        TerminateProcess(ProcessInfo.hProcess, 1);
        RaiseLastOSError(ErrorCode);
      end;
      if ResumeThread(ProcessInfo.hThread) = Cardinal(-1) then
      begin
        ErrorCode := GetLastError;
        TerminateJobObject(FJob, 1);
        RaiseLastOSError(ErrorCode);
      end;
      FProcess := ProcessInfo.hProcess;
      ProcessInfo.hProcess := 0;
    finally
      if ProcessInfo.hThread <> 0 then CloseHandle(ProcessInfo.hThread);
      if ProcessInfo.hProcess <> 0 then CloseHandle(ProcessInfo.hProcess);
    end;
  except
    CloseHandle(FJob);
    FJob := 0;
    raise;
  end;
end;

procedure TLocalAIProcess.Stop;
begin
  if FJob <> 0 then
  begin
    TerminateJobObject(FJob, 0);
    if FProcess <> 0 then WaitForSingleObject(FProcess, 5000);
    CloseHandle(FJob);
    FJob := 0;
  end;
  if FProcess <> 0 then
  begin
    CloseHandle(FProcess);
    FProcess := 0;
  end;
end;

end.
