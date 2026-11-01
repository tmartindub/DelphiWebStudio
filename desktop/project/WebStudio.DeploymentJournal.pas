unit WebStudio.DeploymentJournal;
{$B-}

interface

uses Winapi.Windows, System.JSON, System.Generics.Collections,
  WebStudio.DeploymentReview, WebStudio.SftpInventory;

type
  { Internal receipt writer only. It neither authorizes nor performs a
    transfer. The future publisher must revalidate inputs and destination and
    obtain explicit confirmation before using it. }
  TDeploymentJournal = class
  private
    FHandle: THandle;
    FRoot: string;
    FTransfers: TArray<TDeploymentTransfer>;
    FNext: Integer;
    FPending, FFinished, FBroken, FFinalVerified: Boolean;
    FPendingId: TGUID;
    FUsedIds: TDictionary<string, Boolean>;
    procedure WriteRecord(RecordValue: TJSONObject);
  public
    constructor CreateNew(const FileName, Host, RemoteDirectory: string; Port: Word;
      const Review: TDeploymentReview);
    destructor Destroy; override;
    procedure RecordDirectoryIntent(const RelativeDirectory: string);
    procedure BeginTransfer(Index: Integer; const OperationId: TGUID);
    procedure CompleteTransfer(const Receipt: TSftpTransferReceipt);
    procedure FailTransfer(const MessageText: string);
    procedure Stop(const MessageText: string);
    procedure RecordFinalVerification;
    procedure Finish;
  end;

implementation

uses System.SysUtils, System.Classes;

procedure ValidateRelative(const Path: string);
var Part: string; Index: Integer;
begin
  if (Path = '') or (Path[1] = '/') or (Pos('\', Path) > 0) or (Pos(':', Path) > 0) then
    raise EArgumentException.Create('Invalid reviewed path.');
  for Part in Path.Split(['/']) do
    if (Part = '') or (Part = '.') or (Part = '..') then raise EArgumentException.Create('Invalid reviewed path.');
  for Index := 1 to Length(Path) do
    if Path[Index] < #32 then raise EArgumentException.Create('Invalid reviewed path.');
end;

procedure ValidateHash(const Value: string);
var Character: Char;
begin
  if Length(Value) <> 64 then raise EArgumentException.Create('Invalid reviewed checksum.');
  for Character in Value do
    if not CharInSet(Character, ['0'..'9', 'a'..'f']) then raise EArgumentException.Create('Invalid reviewed checksum.');
end;

constructor TDeploymentJournal.CreateNew(const FileName, Host, RemoteDirectory: string; Port: Word;
  const Review: TDeploymentReview);
var
  Index: Integer;
  Part: string;
  RecordValue: TJSONObject;
  Preserved: TJSONArray;
  Transfer: TDeploymentTransfer;
begin
  inherited Create;
  FHandle := INVALID_HANDLE_VALUE;
  FUsedIds := TDictionary<string, Boolean>.Create;
  if (FileName = '') or (Host = '') or (Port = 0) or (RemoteDirectory = '') or
     (RemoteDirectory[1] <> '/') or (Pos('\', RemoteDirectory) > 0) then
    raise EArgumentException.Create('Invalid journal destination.');
  for Index := 1 to Length(Host) do
    if not CharInSet(Host[Index], ['A'..'Z', 'a'..'z', '0'..'9', '.', '-']) then
      raise EArgumentException.Create('Invalid destination host.');
  for Part in RemoteDirectory.Split(['/']) do
    if (Part = '.') or (Part = '..') then raise EArgumentException.Create('Invalid destination folder.');
  for Index := 1 to Length(RemoteDirectory) do
    if RemoteDirectory[Index] < #32 then raise EArgumentException.Create('Invalid destination folder.');
  ValidateHash(Review.WebsiteSha256); ValidateHash(Review.ScanSha256); ValidateHash(Review.BackupSha256);
  if (Length(Review.Transfers) <> Length(Review.Added) + Length(Review.Changed)) or
     (Length(Review.Transfers) > 10000) or (Length(Review.OnlyAtDestination) > 10000) then
    raise EArgumentException.Create('Invalid reviewed transfer plan.');
  for Index := 0 to High(Review.Transfers) do begin
    Transfer := Review.Transfers[Index];
    ValidateRelative(Transfer.Path); ValidateHash(Transfer.DesiredSha256);
    if Transfer.DesiredSize > 64 * 1024 * 1024 then raise EArgumentException.Create('A reviewed file exceeds the transfer limit.');
    if Index < Length(Review.Added) then begin
      if Transfer.IsReplacement or (Transfer.Path <> Review.Added[Index]) or
         (Transfer.ExpectedSize <> 0) or (Transfer.ExpectedSha256 <> '') then
        raise EArgumentException.Create('Invalid reviewed new-file transfer.');
    end else begin
      if not Transfer.IsReplacement or (Transfer.Path <> Review.Changed[Index - Length(Review.Added)]) or
         (Transfer.ExpectedSize > 64 * 1024 * 1024) then raise EArgumentException.Create('Invalid reviewed replacement.');
      ValidateHash(Transfer.ExpectedSha256);
    end;
  end;
  for Part in Review.OnlyAtDestination do ValidateRelative(Part);
  FRoot := RemoteDirectory;
  while (Length(FRoot) > 1) and FRoot.EndsWith('/') do Delete(FRoot, Length(FRoot), 1);
  if not FRoot.EndsWith('/') then FRoot := FRoot + '/';
  FTransfers := Copy(Review.Transfers);
  FHandle := CreateFile(PChar(FileName), GENERIC_WRITE, FILE_SHARE_READ, nil,
    CREATE_NEW, FILE_ATTRIBUTE_NORMAL, 0);
  if FHandle = INVALID_HANDLE_VALUE then RaiseLastOSError;
  RecordValue := TJSONObject.Create;
  try
    RecordValue.AddPair('event', 'reviewed');
    RecordValue.AddPair('format', 'webstudio-transfer-journal');
    RecordValue.AddPair('version', TJSONNumber.Create(1));
    RecordValue.AddPair('host', Host);
    RecordValue.AddPair('port', TJSONNumber.Create(Port));
    RecordValue.AddPair('destination', FRoot);
    RecordValue.AddPair('websiteSha256', Review.WebsiteSha256);
    RecordValue.AddPair('scanSha256', Review.ScanSha256);
    RecordValue.AddPair('backupSha256', Review.BackupSha256);
    RecordValue.AddPair('transferCount', TJSONNumber.Create(Length(FTransfers)));
    Preserved := TJSONArray.Create;
    RecordValue.AddPair('onlyAtDestination', Preserved);
    for Part in Review.OnlyAtDestination do Preserved.Add(Part);
    WriteRecord(RecordValue);
  finally RecordValue.Free end;
end;

destructor TDeploymentJournal.Destroy;
begin
  if FHandle <> INVALID_HANDLE_VALUE then CloseHandle(FHandle);
  FUsedIds.Free;
  inherited;
end;

procedure TDeploymentJournal.WriteRecord(RecordValue: TJSONObject);
var Bytes: TBytes; Written: Cardinal;
begin
  if FBroken or FFinished then raise EInvalidOpException.Create('The journal is no longer writable.');
  Bytes := TEncoding.UTF8.GetBytes(RecordValue.ToJSON + #10);
  if (Length(Bytes) > 4 * 1024 * 1024) or
     not WriteFile(FHandle, Bytes[0], Length(Bytes), Written, nil) or
     (Written <> Cardinal(Length(Bytes))) or not FlushFileBuffers(FHandle) then begin
    FBroken := True;
    raise EInvalidOpException.Create('Could not safely write the transfer journal. Stop and inspect it.');
  end;
end;

procedure TDeploymentJournal.RecordDirectoryIntent(const RelativeDirectory: string);
var RecordValue: TJSONObject; Transfer: TDeploymentTransfer; Allowed: Boolean;
begin
  if FPending then raise EInvalidOpException.Create('Finish the pending transfer first.');
  ValidateRelative(RelativeDirectory);
  Allowed := False;
  for Transfer in FTransfers do
    if Transfer.Path.StartsWith(RelativeDirectory + '/') then begin Allowed := True; Break end;
  if not Allowed then raise EArgumentException.Create('The folder is not part of the reviewed transfers.');
  RecordValue := TJSONObject.Create;
  try
    RecordValue.AddPair('event', 'directory-intent');
    RecordValue.AddPair('path', FRoot + RelativeDirectory);
    WriteRecord(RecordValue);
  finally RecordValue.Free end;
end;

procedure TDeploymentJournal.BeginTransfer(Index: Integer; const OperationId: TGUID);
var RecordValue: TJSONObject; Transfer: TDeploymentTransfer; Id, Parent: string; Slash: Integer;
begin
  if FPending or (Index <> FNext) or (Index < 0) or (Index >= Length(FTransfers)) then
    raise EInvalidOpException.Create('Transfers must follow the reviewed order.');
  Id := GUIDToString(OperationId);
  if (Id = '{00000000-0000-0000-0000-000000000000}') or FUsedIds.ContainsKey(Id) then
    raise EArgumentException.Create('A unique transfer identifier is required.');
  Transfer := FTransfers[Index];
  Slash := LastDelimiter('/', Transfer.Path);
  Parent := FRoot + Copy(Transfer.Path, 1, Slash);
  RecordValue := TJSONObject.Create;
  try
    RecordValue.AddPair('event', 'transfer-started');
    RecordValue.AddPair('index', TJSONNumber.Create(Index));
    RecordValue.AddPair('path', FRoot + Transfer.Path);
    RecordValue.AddPair('operationId', Id);
    RecordValue.AddPair('stagedPath', Parent + '.webstudio-upload-' + Id + '.tmp');
    if Transfer.IsReplacement then begin
      RecordValue.AddPair('action', 'replace');
      RecordValue.AddPair('originalPath', Parent + '.webstudio-original-' + Id + '.bak');
      RecordValue.AddPair('expectedSize', TJSONNumber.Create(Int64(Transfer.ExpectedSize)));
      RecordValue.AddPair('expectedSha256', Transfer.ExpectedSha256);
    end else RecordValue.AddPair('action', 'new');
    RecordValue.AddPair('desiredSize', TJSONNumber.Create(Int64(Transfer.DesiredSize)));
    RecordValue.AddPair('desiredSha256', Transfer.DesiredSha256);
    WriteRecord(RecordValue);
  finally RecordValue.Free end;
  FUsedIds.Add(Id, True);
  FPendingId := OperationId;
  FPending := True;
end;

procedure TDeploymentJournal.CompleteTransfer(const Receipt: TSftpTransferReceipt);
var Transfer: TDeploymentTransfer; RecordValue: TJSONObject; Parent, Previous: string; Slash: Integer;
begin
  if not FPending then raise EInvalidOpException.Create('No transfer is pending.');
  Transfer := FTransfers[FNext];
  Slash := LastDelimiter('/', Transfer.Path);
  Parent := FRoot + Copy(Transfer.Path, 1, Slash);
  Previous := '';
  if Transfer.IsReplacement then Previous := Parent + '.webstudio-original-' + GUIDToString(FPendingId) + '.bak';
  if (Receipt.Path <> FRoot + Transfer.Path) or (Receipt.Size <> Transfer.DesiredSize) or
     (Receipt.Sha256 <> Transfer.DesiredSha256) or (Receipt.PreviousPath <> Previous) then
    raise EInvalidOpException.Create('The verified transfer does not match the reviewed plan.');
  RecordValue := TJSONObject.Create;
  try
    RecordValue.AddPair('event', 'transfer-verified');
    RecordValue.AddPair('index', TJSONNumber.Create(FNext));
    RecordValue.AddPair('path', Receipt.Path);
    RecordValue.AddPair('size', TJSONNumber.Create(Int64(Receipt.Size)));
    RecordValue.AddPair('sha256', Receipt.Sha256);
    if Previous <> '' then RecordValue.AddPair('originalPath', Previous);
    WriteRecord(RecordValue);
  finally RecordValue.Free end;
  FPending := False;
  Inc(FNext);
end;

procedure TDeploymentJournal.FailTransfer(const MessageText: string);
var RecordValue: TJSONObject;
begin
  if not FPending then raise EInvalidOpException.Create('No transfer is pending.');
  RecordValue := TJSONObject.Create;
  try
    RecordValue.AddPair('event', 'transfer-failed');
    RecordValue.AddPair('index', TJSONNumber.Create(FNext));
    RecordValue.AddPair('message', Copy(MessageText, 1, 2048));
    WriteRecord(RecordValue);
  finally RecordValue.Free end;
  FBroken := True;
end;

procedure TDeploymentJournal.Finish;
var RecordValue: TJSONObject;
begin
  if FPending or (FNext <> Length(FTransfers)) or not FFinalVerified then raise EInvalidOpException.Create('The reviewed transfers and destination verification are not complete.');
  RecordValue := TJSONObject.Create;
  try
    RecordValue.AddPair('event', 'complete');
    RecordValue.AddPair('verifiedTransfers', TJSONNumber.Create(FNext));
    WriteRecord(RecordValue);
  finally RecordValue.Free end;
  FFinished := True;
end;

procedure TDeploymentJournal.RecordFinalVerification;
var RecordValue: TJSONObject;
begin
  if FPending or (FNext <> Length(FTransfers)) or FFinalVerified then
    raise EInvalidOpException.Create('The destination cannot yet be marked verified.');
  RecordValue := TJSONObject.Create;
  try
    RecordValue.AddPair('event', 'destination-verified');
    WriteRecord(RecordValue);
  finally RecordValue.Free end;
  FFinalVerified := True;
end;

procedure TDeploymentJournal.Stop(const MessageText: string);
var RecordValue: TJSONObject;
begin
  if FPending then raise EInvalidOpException.Create('Record the pending transfer failure first.');
  RecordValue := TJSONObject.Create;
  try
    RecordValue.AddPair('event', 'stopped');
    RecordValue.AddPair('nextIndex', TJSONNumber.Create(FNext));
    RecordValue.AddPair('message', Copy(MessageText, 1, 2048));
    WriteRecord(RecordValue);
  finally RecordValue.Free end;
  FBroken := True;
end;

end.
