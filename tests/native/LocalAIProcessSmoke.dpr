program LocalAIProcessSmoke;

{$APPTYPE CONSOLE}

uses
  Winapi.Windows, System.SysUtils, System.Classes, System.IOUtils, System.Net.HttpClient, System.Net.URLClient,
  WebStudio.LocalAIProcess in '..\..\desktop\ai\WebStudio.LocalAIProcess.pas';

var
  LocalAI: TLocalAIProcess;
  Client: THTTPClient;
  Response: IHTTPResponse;
  Port, Attempt: Integer;
  BaseURL: string;
  Ready: Boolean;
  Rejected: Boolean;
begin
  if not (ParamCount in [4, 5]) then
    raise Exception.Create('Expected runtime, model, protected key file, port, and optional crash test.');
  Port := StrToInt(ParamStr(4));
  if (Port < 1) or (Port > 65535) then raise Exception.Create('Invalid port.');
  LocalAI := TLocalAIProcess.Create;
  try
    Rejected := False;
    try
      LocalAI.Start(ParamStr(1), ParamStr(2), ParamStr(3), 0);
    except
      on E: EArgumentException do Rejected := True;
    end;
    if not Rejected then raise Exception.Create('Invalid port was accepted.');
    LocalAI.Start(ParamStr(1), ParamStr(2), ParamStr(3), Word(Port));
    if not LocalAI.IsRunning then raise Exception.Create('Process did not start.');
    Rejected := False;
    try
      LocalAI.Start(ParamStr(1), ParamStr(2), ParamStr(3), Word(Port));
    except
      on E: EInvalidOpException do Rejected := True;
    end;
    if not Rejected then raise Exception.Create('A second process was allowed.');
    Client := THTTPClient.Create;
    try
      Client.ConnectionTimeout := 1000;
      Client.ResponseTimeout := 1000;
      BaseURL := 'http://127.0.0.1:' + IntToStr(Port);
      Ready := False;
      for Attempt := 1 to 40 do
      begin
        if not LocalAI.IsRunning then raise Exception.Create('Process exited during startup.');
        try
          Response := Client.Get(BaseURL + '/health');
          if Response.StatusCode = 200 then
          begin
            Ready := True;
            Break;
          end;
        except
          on E: Exception do Sleep(500);
        end;
        Sleep(500);
      end;
      if not Ready then raise Exception.Create('Local AI did not become ready.');
      Response := Client.Get(BaseURL + '/v1/models');
      if Response.StatusCode <> 401 then
        raise Exception.Create('Unauthenticated model access was not rejected.');
      Response := Client.Get(BaseURL + '/v1/models', nil,
        [TNetHeader.Create('Authorization', 'Bearer ' + Trim(TFile.ReadAllText(ParamStr(3))))]);
      if Response.StatusCode <> 200 then
        raise Exception.Create('Authenticated model access failed.');
    finally
      Client.Free;
    end;
    if (ParamCount = 5) and (ParamStr(5) = 'crash') then
      TerminateProcess(GetCurrentProcess, 99);
    LocalAI.Stop;
    if LocalAI.IsRunning then raise Exception.Create('Process did not stop.');
    Writeln('Local AI process start, loopback health, authentication, and stop passed.');
  finally
    LocalAI.Free;
  end;
end.
