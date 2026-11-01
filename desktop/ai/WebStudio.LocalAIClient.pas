unit WebStudio.LocalAIClient;
{$B-}

interface

uses System.SysUtils;

{ Send only the user's brief to an already-running local model. The caller
  owns process identity, the protected key, execution off the UI thread,
  cancellation and review of the returned plan. }
function GenerateLocalSitePlan(Port: Word; const AccessKey, Brief: string;
  const ProposalKind: string = 'pages'): string;

implementation

uses System.Classes, System.JSON, System.Net.HttpClient, System.Net.URLClient;

function GenerateLocalSitePlan(Port: Word; const AccessKey, Brief, ProposalKind: string): string;
const
  SchemaJSON = '{"type":"object","properties":{"pages":{"type":"array","items":{"type":"object","properties":{"name":{"type":"string"},"headline":{"type":"string"}},"required":["name","headline"],"additionalProperties":false},"minItems":5,"maxItems":5}},"required":["pages"],"additionalProperties":false}';
  ThemeSchemaJSON = '{"type":"object","properties":{"bg0":{"type":"string"},"text0":{"type":"string"},"accent":{"type":"string"}},"required":["bg0","text0","accent"],"additionalProperties":false}';
  ThemeKeys: array[0..2] of string = ('bg0', 'text0', 'accent');
var
  Client: THTTPClient;
  Request, FormatObject, SchemaObject, MessageObject, ResponseObject, PageObject: TJSONObject;
  Messages, Choices, Pages: TJSONArray;
  RequestBody, ResponseBody: TStringStream;
  HTTPResponse: IHTTPResponse;
  Parsed, Plan: TJSONValue;
  Value: TJSONValue;
  Index, CharacterIndex: Integer;
  Headers: TNetHeaders;
  Text: string;
begin
  if (Port = 0) or (Length(AccessKey) <> 64) then raise EArgumentException.Create('Invalid local AI connection.')
  else for Index := 1 to Length(AccessKey) do
    if not CharInSet(AccessKey[Index], ['0'..'9', 'A'..'F', 'a'..'f']) then raise EArgumentException.Create('Invalid local AI connection.');
  Text := Trim(Brief);
  if (Text = '') or (Length(Text) > 4000) then raise EArgumentException.Create('Enter a site description of up to 4,000 characters.');
  if (ProposalKind <> 'pages') and (ProposalKind <> 'theme') then raise EArgumentException.Create('Invalid local AI proposal type.');

  Request := TJSONObject.Create;
  try
    Request.AddPair('model', 'local');
    Messages := TJSONArray.Create;
    Request.AddPair('messages', Messages);
    MessageObject := TJSONObject.Create;
    MessageObject.AddPair('role', 'user');
    if ProposalKind = 'theme' then
      MessageObject.AddPair('content', 'Choose accessible website colors based on this request. Return bg0 for the page background, text0 for readable foreground text, and accent for highlights. Each value must be a six-digit hexadecimal color beginning with #. Request: ' + Text)
    else
      MessageObject.AddPair('content', 'Plan an informational website based on this description. Return exactly five distinct pages, beginning with Home, each with a short name and a headline. Use neutral headings; do not invent activities, schedules, services, business practices, contact details, paid features, advertisements, donations, or signups. Description: ' + Text);
    Messages.AddElement(MessageObject);
    FormatObject := TJSONObject.Create;
    Request.AddPair('response_format', FormatObject);
    FormatObject.AddPair('type', 'json_schema');
    SchemaObject := TJSONObject.Create;
    FormatObject.AddPair('json_schema', SchemaObject);
    if ProposalKind = 'theme' then begin
      SchemaObject.AddPair('name', 'site_colors');
      Value := TJSONObject.ParseJSONValue(ThemeSchemaJSON);
    end else begin
      SchemaObject.AddPair('name', 'site_plan');
      Value := TJSONObject.ParseJSONValue(SchemaJSON);
    end;
    if not (Value is TJSONObject) then begin Value.Free; raise EInvalidOpException.Create('Local AI schema is invalid.') end;
    SchemaObject.AddPair('schema', Value);
    Request.AddPair('temperature', TJSONNumber.Create(0));
    Request.AddPair('max_tokens', TJSONNumber.Create(512));
    SchemaObject := TJSONObject.Create;
    SchemaObject.AddPair('enable_thinking', TJSONBool.Create(False));
    Request.AddPair('chat_template_kwargs', SchemaObject);
    RequestBody := TStringStream.Create(Request.ToJSON, TEncoding.UTF8);
    ResponseBody := TStringStream.Create('', TEncoding.UTF8);
    Client := THTTPClient.Create;
    try
      Client.ConnectionTimeout := 3000;
      Client.ResponseTimeout := 240000;
      Client.HandleRedirects := False;
      SetLength(Headers, 2);
      Headers[0] := TNameValuePair.Create('Content-Type', 'application/json');
      Headers[1] := TNameValuePair.Create('Authorization', 'Bearer ' + AccessKey);
      HTTPResponse := Client.Post('http://127.0.0.1:' + IntToStr(Port) + '/v1/chat/completions', RequestBody, ResponseBody, Headers);
      if HTTPResponse.StatusCode <> 200 then raise EInOutError.CreateFmt('Local AI returned HTTP %d.', [HTTPResponse.StatusCode]);
      if (ResponseBody.Size <= 0) or (ResponseBody.Size > 200000) then raise EInOutError.Create('Local AI returned an invalid response size.');
      Parsed := TJSONObject.ParseJSONValue(ResponseBody.DataString);
      try
        if not (Parsed is TJSONObject) then raise EInOutError.Create('Local AI returned invalid JSON.');
        ResponseObject := TJSONObject(Parsed);
        Value := ResponseObject.GetValue('choices');
        if not (Value is TJSONArray) or (TJSONArray(Value).Count <> 1) or not (TJSONArray(Value).Items[0] is TJSONObject) then raise EInOutError.Create('Local AI returned no plan.');
        Choices := TJSONArray(Value);
        Value := TJSONObject(Choices.Items[0]).GetValue('message');
        if not (Value is TJSONObject) then raise EInOutError.Create('Local AI returned no plan.');
        Value := TJSONObject(Value).GetValue('content');
        if not (Value is TJSONString) then raise EInOutError.Create('Local AI returned no plan.');
        Plan := TJSONObject.ParseJSONValue(Value.Value);
        try
          if not (Plan is TJSONObject) then raise EInOutError.Create('Local AI returned an invalid proposal.');
          if ProposalKind = 'theme' then begin
            if TJSONObject(Plan).Count <> 3 then raise EInOutError.Create('Local AI returned invalid colors.');
            for Text in ThemeKeys do begin
              Value := TJSONObject(Plan).GetValue(Text);
              if not (Value is TJSONString) or (Length(Value.Value) <> 7) or (Value.Value[1] <> '#') then
                raise EInOutError.Create('Local AI returned invalid colors.');
              for CharacterIndex := 2 to 7 do
                if not CharInSet(Value.Value[CharacterIndex], ['0'..'9', 'A'..'F', 'a'..'f']) then
                  raise EInOutError.Create('Local AI returned invalid colors.');
            end;
            Result := Plan.ToJSON;
            Exit;
          end;
          if TJSONObject(Plan).Count <> 1 then raise EInOutError.Create('Local AI returned an invalid plan.');
          Value := TJSONObject(Plan).GetValue('pages');
          if not (Value is TJSONArray) or (TJSONArray(Value).Count <> 5) then raise EInOutError.Create('Local AI must return five pages.');
          Pages := TJSONArray(Value);
          for Index := 0 to Pages.Count - 1 do begin
            if not (Pages.Items[Index] is TJSONObject) then raise EInOutError.Create('Local AI returned an invalid page.');
            PageObject := TJSONObject(Pages.Items[Index]);
            if PageObject.Count <> 2 then raise EInOutError.Create('Local AI returned an invalid page.');
            Value := PageObject.GetValue('name');
            if not (Value is TJSONString) or (Trim(Value.Value) = '') or (Length(Value.Value) > 120) then raise EInOutError.Create('Local AI returned an invalid page name.');
            Value := PageObject.GetValue('headline');
            if not (Value is TJSONString) or (Trim(Value.Value) = '') or (Length(Value.Value) > 4000) then raise EInOutError.Create('Local AI returned an invalid headline.');
          end;
          Result := Plan.ToJSON;
        finally Plan.Free end;
      finally Parsed.Free end;
    finally
      Client.Free;
      ResponseBody.Free;
      RequestBody.Free;
    end;
  finally Request.Free end;
end;

end.
