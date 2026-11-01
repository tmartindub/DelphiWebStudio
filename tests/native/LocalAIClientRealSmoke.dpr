program LocalAIClientRealSmoke;
{$APPTYPE CONSOLE}

uses System.SysUtils, WebStudio.LocalAIClient in '..\..\desktop\ai\WebStudio.LocalAIClient.pas';

var Port: Integer;
begin
  if ParamCount <> 2 then raise Exception.Create('Expected a test port and key.');
  Port := StrToInt(ParamStr(1));
  if (Port < 1) or (Port > 65535) then raise Exception.Create('Invalid port.');
  Writeln(GenerateLocalSitePlan(Word(Port), ParamStr(2), 'A small community website with information, events, and resources.'));
end.
