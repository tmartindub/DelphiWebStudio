program DesktopBridgeValidationSmoke;
{$APPTYPE CONSOLE}
uses Winapi.Windows, System.SysUtils, System.Threading, WebStudio.Bridge in '..\..\desktop\bridge\WebStudio.Bridge.pas';
const
  Valid = '{"version":1,"requestId":"request-1","sessionId":"session-1","projectId":"project-1","capability":"project.save"}';
  Source = 'https://webstudio.local/editor';
procedure Reject(const Raw, Sender, Session, Project: string; Grants: TDesktopCapabilities);
var Rejected: Boolean;
begin
  Rejected := False;
  try ValidateDesktopRequest(Raw, Sender, Session, Project, Grants);
  except on E: EArgumentException do Rejected := True end;
  if not Rejected then raise Exception.Create('Invalid desktop request was accepted.');
end;
var Request: TDesktopRequest; Session: TDesktopSession; Rejected: Boolean; AcceptedCount, RejectedCount, Index: Integer;
begin
  Request := ValidateDesktopRequest(Valid, Source, 'session-1', 'project-1', [dcProjectSave]);
  if (Request.RequestId <> 'request-1') or (Request.Capability <> dcProjectSave) then raise Exception.Create('Valid request was not retained.');
  Reject(Valid, 'https://webstudio.local.evil.test/editor', 'session-1', 'project-1', [dcProjectSave]);
  Reject(Valid, 'http://webstudio.local/editor', 'session-1', 'project-1', [dcProjectSave]);
  Reject(Valid, 'https://user@webstudio.local/editor', 'session-1', 'project-1', [dcProjectSave]);
  Reject(Valid, 'https://webstudio.local:443/editor', 'session-1', 'project-1', [dcProjectSave]);
  Reject(Valid, Source, 'other-session', 'project-1', [dcProjectSave]);
  Reject(Valid, Source, 'session-1', 'other-project', [dcProjectSave]);
  Reject(Valid, Source, 'session-1', 'project-1', []);
  Reject(StringReplace(Valid, 'project.save', 'shell.execute', []), Source, 'session-1', 'project-1', [dcProjectSave]);
  Reject(StringReplace(Valid, 'request-1', 'constructor', []), Source, 'session-1', 'project-1', [dcProjectSave]);
  Reject(StringReplace(Valid, '"version":1', '"version":2', []), Source, 'session-1', 'project-1', [dcProjectSave]);
  Reject(StringReplace(Valid, '"version":1', '"path":"secret"', []), Source, 'session-1', 'project-1', [dcProjectSave]);
  Reject(StringReplace(Valid, '"version":1', '"version":1,"path":"secret"', []), Source, 'session-1', 'project-1', [dcProjectSave]);
  Reject('{', Source, 'session-1', 'project-1', [dcProjectSave]);
  Reject(Valid + '{"extra":true}', Source, 'session-1', 'project-1', [dcProjectSave]);
  Reject(StringOfChar('x', 16385), Source, 'session-1', 'project-1', [dcProjectSave]);
  Reject(StringReplace(Valid, '"projectId":"project-1"', '"projectId":null', []), Source, 'session-1', '', [dcProjectSave]);
  Request := ValidateDesktopRequest(StringReplace(StringReplace(Valid, '"projectId":"project-1"', '"projectId":null', []), 'project.save', 'project.open', []), Source, 'session-1', '', [dcProjectOpen]);
  if Request.Capability <> dcProjectOpen then raise Exception.Create('Open request was not retained.');
  Session := TDesktopSession.Create('session-1', 'project-1', [dcProjectSave]);
  try
    Rejected := False;
    try Session.ValidateAndClaim(Valid, 'https://untrusted.local/editor');
    except on E: EArgumentException do Rejected := True end;
    if not Rejected then raise Exception.Create('Untrusted request was accepted.');
    Session.ValidateAndClaim(Valid, Source);
    Rejected := False;
    try Session.ValidateAndClaim(Valid, Source);
    except on E: EInvalidOpException do Rejected := True end;
    if not Rejected then raise Exception.Create('Replayed request was accepted.');
    AcceptedCount := 0; RejectedCount := 0;
    TParallel.For(1, 2, procedure(Index: Integer)
      begin
        try
          Session.ValidateAndClaim(StringReplace(Valid, 'request-1', 'request-3', []), Source);
          InterlockedIncrement(AcceptedCount);
        except on E: EInvalidOpException do InterlockedIncrement(RejectedCount) end;
      end);
    if (AcceptedCount <> 1) or (RejectedCount <> 1) then raise Exception.Create('Concurrent replay was not rejected.');
    Session.Revoke;
    Rejected := False;
    try Session.ValidateAndClaim(StringReplace(Valid, 'request-1', 'request-2', []), Source);
    except on E: EInvalidOpException do Rejected := True end;
    if not Rejected then raise Exception.Create('Revoked session was accepted.');
  finally
    Session.Free;
  end;
  Session := TDesktopSession.Create('session-1', 'project-1', [dcProjectSave]);
  try
    for Index := 1 to 4096 do
      Session.ValidateAndClaim(StringReplace(Valid, 'request-1', 'r' + IntToStr(Index), []), Source);
    Rejected := False;
    try Session.ValidateAndClaim(StringReplace(Valid, 'request-1', 'overflow', []), Source);
    except on E: EInvalidOpException do Rejected := True end;
    if not Rejected then raise Exception.Create('Full session accepted another request.');
    Rejected := False;
    try Session.ValidateAndClaim(StringReplace(Valid, 'request-1', 'r1', []), Source);
    except on E: EInvalidOpException do Rejected := True end;
    if not Rejected then raise Exception.Create('Full session forgot a previous request.');
  finally
    Session.Free;
  end;
  Writeln('Native desktop request validation passed.');
end.
