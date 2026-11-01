program LocalAIHostSmoke;

{$APPTYPE CONSOLE}

uses
  System.SysUtils,
  WebStudio.LocalAIHost in '..\..\desktop\ai\WebStudio.LocalAIHost.pas';

begin
  try
    if ParamCount <> 2 then
      raise EArgumentException.Create('Supply the runtime ZIP and model paths.');
    Writeln(RunLocalSitePlan(ParamStr(1), ParamStr(2),
      'A small noncommercial community website with news and events.'));
  except
    on E: Exception do
    begin
      Writeln(ErrOutput, E.ClassName + ': ' + E.Message);
      ExitCode := 1;
    end;
  end;
end.
