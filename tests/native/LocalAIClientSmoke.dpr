program LocalAIClientSmoke;
{$APPTYPE CONSOLE}

uses
  System.SysUtils, System.JSON,
  WebStudio.LocalAIClient in '..\..\desktop\ai\WebStudio.LocalAIClient.pas';

var Port: Integer; Key, Plan: string; Parsed: TJSONValue; Rejected: Boolean;
begin
  if ParamCount <> 2 then raise Exception.Create('Expected an isolated test port and key.');
  Port := StrToInt(ParamStr(1)); Key := ParamStr(2);
  if (Port < 1) or (Port > 65535) then raise Exception.Create('Invalid port.');
  Rejected := False;
  try GenerateLocalSitePlan(Word(Port), 'bad-key', 'A community site') except on E: EArgumentException do Rejected := True end;
  if not Rejected then raise Exception.Create('An invalid key was accepted.');
  Rejected := False;
  try GenerateLocalSitePlan(Word(Port), Key, '   ') except on E: EArgumentException do Rejected := True end;
  if not Rejected then raise Exception.Create('An empty description was accepted.');
  Plan := GenerateLocalSitePlan(Word(Port), Key, 'A community site');
  Parsed := TJSONObject.ParseJSONValue(Plan);
  try
    if not (Parsed is TJSONObject) or not (TJSONObject(Parsed).GetValue('pages') is TJSONArray) or
      (TJSONArray(TJSONObject(Parsed).GetValue('pages')).Count <> 5) then raise Exception.Create('A valid plan was not returned.');
  finally Parsed.Free end;
  Rejected := False;
  try GenerateLocalSitePlan(Word(Port), Key, 'A community site') except on E: EInOutError do Rejected := True end;
  if not Rejected then raise Exception.Create('An invalid model response was accepted.');
  Writeln('Local AI client accepted a valid plan and rejected invalid input and response.');
end.
