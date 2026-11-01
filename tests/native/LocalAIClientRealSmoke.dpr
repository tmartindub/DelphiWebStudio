program LocalAIClientRealSmoke;
{$APPTYPE CONSOLE}

uses System.SysUtils, WebStudio.LocalAIClient in '..\..\desktop\ai\WebStudio.LocalAIClient.pas';

var Port: Integer; Brief: string;
begin
  if (ParamCount < 2) or (ParamCount > 3) then raise Exception.Create('Expected a test port, key, and optional brief.');
  Port := StrToInt(ParamStr(1));
  if (Port < 1) or (Port > 65535) then raise Exception.Create('Invalid port.');
  if ParamCount = 3 then Brief := ParamStr(3)
  else Brief := 'A small community website with information, events, and resources.';
  Writeln(GenerateLocalSitePlan(Word(Port), ParamStr(2), Brief));
end.
