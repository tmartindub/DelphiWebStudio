unit WebStudio.Bridge;
{$B-}

interface

uses System.SysUtils, System.Generics.Collections;

type
  TDesktopCapability = (dcProjectOpen, dcProjectSave, dcMediaImport, dcSiteExport);
  TDesktopCapabilities = set of TDesktopCapability;

  TDesktopRequest = record
    RequestId: string;
    Capability: TDesktopCapability;
  end;

  { Native owner creates a fresh session with its own unpredictable ID.
    Once revoked or full, create a new session rather than recycling IDs. }
  TDesktopSession = class
  private
    FSessionId: string;
    FProjectId: string;
    FGrants: TDesktopCapabilities;
    FSeenRequests: TDictionary<string, Byte>;
    FRevoked: Boolean;
  public
    constructor Create(const SessionId, ProjectId: string; Grants: TDesktopCapabilities);
    destructor Destroy; override;
    function ValidateAndClaim(const RawJSON, SenderURL: string): TDesktopRequest;
    procedure Revoke;
  end;

{ Validates an envelope only. SenderURL must be obtained from the WebView
  event, and grants must come from the native host. Empty ProjectId means no
  project. No file operations, replay protection, or UI are provided here. }
function ValidateDesktopRequest(const RawJSON, SenderURL, SessionId,
  ProjectId: string; Grants: TDesktopCapabilities): TDesktopRequest;

implementation

uses System.JSON, System.Classes;

constructor TDesktopSession.Create(const SessionId, ProjectId: string; Grants: TDesktopCapabilities);
begin
  inherited Create;
  if SessionId = '' then raise EArgumentException.Create('A native session ID is required.');
  FSessionId := SessionId;
  FProjectId := ProjectId;
  FGrants := Grants;
  FSeenRequests := TDictionary<string, Byte>.Create;
end;

destructor TDesktopSession.Destroy;
begin
  FSeenRequests.Free;
  inherited;
end;

function TDesktopSession.ValidateAndClaim(const RawJSON, SenderURL: string): TDesktopRequest;
begin
  TMonitor.Enter(Self);
  try
    if FRevoked then raise EInvalidOpException.Create('Desktop session is revoked.');
    Result := ValidateDesktopRequest(RawJSON, SenderURL, FSessionId, FProjectId, FGrants);
    if FSeenRequests.ContainsKey(Result.RequestId) then raise EInvalidOpException.Create('Desktop request was already used.');
    if FSeenRequests.Count >= 4096 then raise EInvalidOpException.Create('Desktop session request limit reached.');
    FSeenRequests.Add(Result.RequestId, 0);
  finally
    TMonitor.Exit(Self);
  end;
end;

procedure TDesktopSession.Revoke;
begin
  TMonitor.Enter(Self);
  try
    FRevoked := True;
    FGrants := [];
  finally
    TMonitor.Exit(Self);
  end;
end;

function ValidateDesktopRequest(const RawJSON, SenderURL, SessionId,
  ProjectId: string; Grants: TDesktopCapabilities): TDesktopRequest;
var
  Parsed: TJSONValue;
  Obj: TJSONObject;
  Value: TJSONValue;
  Id, CapabilityName, SourceTail: string;
  Index: Integer;
begin
  if TEncoding.UTF8.GetByteCount(RawJSON) > 16384 then
    raise EArgumentException.Create('Desktop request is too large.');
  if not SenderURL.StartsWith('https://webstudio.local/') then
    raise EArgumentException.Create('Untrusted desktop message source.');
  SourceTail := SenderURL.Substring(Length('https://webstudio.local/'));
  for Index := 1 to Length(SourceTail) do
    if (Ord(SourceTail[Index]) < 32) or (SourceTail[Index] = '\') then
      raise EArgumentException.Create('Untrusted desktop message source.');
  Parsed := TJSONObject.ParseJSONValue(RawJSON);
  try
    if not (Parsed is TJSONObject) then
      raise EArgumentException.Create('Invalid desktop request JSON.');
    Obj := TJSONObject(Parsed);
    if Obj.Count <> 5 then raise EArgumentException.Create('Invalid desktop request fields.');
    Value := Obj.GetValue('version');
    if not (Value is TJSONNumber) or (Value.Value <> '1') then
      raise EArgumentException.Create('Invalid desktop request version.');
    Value := Obj.GetValue('requestId');
    if not (Value is TJSONString) then raise EArgumentException.Create('Invalid desktop request identity.');
    Id := Value.Value;
    if (Length(Id) < 1) or (Length(Id) > 80) or
      not CharInSet(Id[1], ['A'..'Z', 'a'..'z', '0'..'9']) then
      raise EArgumentException.Create('Invalid desktop request identity.');
    for Index := 2 to Length(Id) do
      if not CharInSet(Id[Index], ['A'..'Z', 'a'..'z', '0'..'9', '_', '-']) then
        raise EArgumentException.Create('Invalid desktop request identity.');
    if (Id = 'constructor') or (Id = 'toString') or (Id = 'valueOf') or
      (Id = 'hasOwnProperty') or (Id = 'isPrototypeOf') or
      (Id = 'propertyIsEnumerable') or (Id = 'toLocaleString') then
      raise EArgumentException.Create('Invalid desktop request identity.');
    Value := Obj.GetValue('sessionId');
    if (SessionId = '') or not (Value is TJSONString) or (Value.Value <> SessionId) then
      raise EArgumentException.Create('Desktop session does not match.');
    Value := Obj.GetValue('projectId');
    if ProjectId = '' then begin
      if not (Value is TJSONNull) then raise EArgumentException.Create('Desktop project does not match.');
    end else if not (Value is TJSONString) or (Value.Value <> ProjectId) then
      raise EArgumentException.Create('Desktop project does not match.');
    Value := Obj.GetValue('capability');
    if not (Value is TJSONString) then raise EArgumentException.Create('Desktop capability is not granted.');
    CapabilityName := Value.Value;
    if CapabilityName = 'project.open' then Result.Capability := dcProjectOpen
    else if CapabilityName = 'project.save' then Result.Capability := dcProjectSave
    else if CapabilityName = 'media.import' then Result.Capability := dcMediaImport
    else if CapabilityName = 'site.export' then Result.Capability := dcSiteExport
    else raise EArgumentException.Create('Desktop capability is not granted.');
    if not (Result.Capability in Grants) then raise EArgumentException.Create('Desktop capability is not granted.');
    if (Result.Capability <> dcProjectOpen) and (ProjectId = '') then
      raise EArgumentException.Create('No project is open.');
    Result.RequestId := Id;
  finally
    Parsed.Free;
  end;
end;
end.
