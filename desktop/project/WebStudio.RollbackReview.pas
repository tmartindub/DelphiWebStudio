unit WebStudio.RollbackReview;
{$B-}

interface

uses WebStudio.DeploymentReview, WebStudio.SftpInventory;

{ Read-only: returns receipt-added files that still match the current scan and
  are absent from the selected original backup. It does not change a host. }
function ReviewAddedRollback(const ReceiptFile, Host, RemoteDirectory: string;
  Port: Word; const RestoreReview: TDeploymentReview): TArray<TSftpInventoryEntry>;

implementation

uses System.SysUtils, System.Classes, System.JSON, System.Generics.Collections;

function ReviewAddedRollback(const ReceiptFile, Host, RemoteDirectory: string;
  Port: Word; const RestoreReview: TDeploymentReview): TArray<TSftpInventoryEntry>;
var
  Stream: TFileStream;
  Lines: TStringList;
  Entries: TList<TSftpInventoryEntry>;
  Value: TJSONValue;
  Obj: TJSONObject;
  Line, EventName, Root, ReceiptHost, ReceiptRoot, BackupHash, FormatName,
    Action, PendingPath, PendingHash, Path, Hash, OnlyPath: string;
  Index, Version, ReceiptPort, Count, NextIndex, RecordIndex, DoneCount: Integer;
  PendingSize, Size: Int64;
  Header, Pending, PendingNew, Verified, Complete, Found, IsOnly: Boolean;
  Entry, Candidate: TSftpInventoryEntry;
begin
  Root := RemoteDirectory;
  while (Length(Root) > 1) and Root.EndsWith('/') do Delete(Root, Length(Root), 1);
  if not Root.EndsWith('/') then Root := Root + '/';
  Lines := TStringList.Create;
  Entries := TList<TSftpInventoryEntry>.Create;
  try
    Stream := TFileStream.Create(ReceiptFile, fmOpenRead or fmShareDenyWrite);
    try
      if (Stream.Size <= 0) or (Stream.Size > 32 * 1024 * 1024) then
        raise EArgumentException.Create('The deployment receipt is empty or too large.');
      Lines.LoadFromStream(Stream, TEncoding.UTF8);
    finally Stream.Free end;
    Header := False; Pending := False; PendingNew := False; Verified := False; Complete := False; NextIndex := 0; Count := -1;
    for Line in Lines do begin
      if (Line = '') or Complete then raise EArgumentException.Create('The deployment receipt is incomplete or invalid.');
      Value := TJSONObject.ParseJSONValue(Line);
      try
        if not (Value is TJSONObject) then raise EArgumentException.Create('Invalid receipt record.');
        Obj := TJSONObject(Value);
        if not Obj.TryGetValue<string>('event', EventName) then raise EArgumentException.Create('Invalid receipt event.');
        if not Header then begin
          if (EventName <> 'reviewed') or not Obj.TryGetValue<string>('format', FormatName) or
             (FormatName <> 'webstudio-transfer-journal') or not Obj.TryGetValue<Integer>('version', Version) or (Version <> 1) or
             not Obj.TryGetValue<string>('host', ReceiptHost) or not SameText(ReceiptHost, Host) or
             not Obj.TryGetValue<Integer>('port', ReceiptPort) or (ReceiptPort <> Port) or
             not Obj.TryGetValue<string>('destination', ReceiptRoot) or (ReceiptRoot <> Root) or
             not Obj.TryGetValue<string>('backupSha256', BackupHash) or (BackupHash <> RestoreReview.WebsiteSha256) or
             not Obj.TryGetValue<Integer>('transferCount', Count) or (Count < 0) or (Count > 10000) then
            raise EArgumentException.Create('The receipt does not match this host, folder and original backup.');
          Header := True;
        end else if EventName = 'directory-intent' then begin
          if Pending or Verified then raise EArgumentException.Create('Invalid receipt order.');
        end else if EventName = 'transfer-started' then begin
          if Pending or Verified or (NextIndex >= Count) or not Obj.TryGetValue<Integer>('index', RecordIndex) or
             (RecordIndex <> NextIndex) or not Obj.TryGetValue<string>('path', PendingPath) or
             not PendingPath.StartsWith(Root) or not Obj.TryGetValue<string>('action', Action) or
             ((Action <> 'new') and (Action <> 'replace')) or not Obj.TryGetValue<Int64>('desiredSize', PendingSize) or
             (PendingSize < 0) or not Obj.TryGetValue<string>('desiredSha256', PendingHash) then
            raise EArgumentException.Create('Invalid receipt transfer.');
          Pending := True; PendingNew := Action = 'new';
        end else if EventName = 'transfer-verified' then begin
          if not Pending or not Obj.TryGetValue<Integer>('index', RecordIndex) or (RecordIndex <> NextIndex) or
             not Obj.TryGetValue<string>('path', Path) or (Path <> PendingPath) or
             not Obj.TryGetValue<Int64>('size', Size) or (Size <> PendingSize) or
             not Obj.TryGetValue<string>('sha256', Hash) or (Hash <> PendingHash) then
            raise EArgumentException.Create('Invalid verified transfer.');
          if PendingNew then begin
            Path := Copy(Path, Length(Root) + 1, MaxInt);
            IsOnly := False;
            for OnlyPath in RestoreReview.OnlyAtDestination do if OnlyPath = Path then begin IsOnly := True; Break end;
            Found := False;
            for Candidate in RestoreReview.DestinationFiles do if Candidate.Path = Path then begin Entry := Candidate; Found := True; Break end;
            if not IsOnly or not Found or (Entry.Size <> UInt64(Size)) or (Entry.Sha256 <> Hash) then
              raise EInvalidOpException.Create('A receipt-added file changed or is missing. Scan and review again.');
            for Index := 0 to Entries.Count - 1 do if Entries[Index].Path = Path then raise EArgumentException.Create('Duplicate receipt path.');
            Entries.Add(Entry);
          end;
          Pending := False; Inc(NextIndex);
        end else if EventName = 'destination-verified' then begin
          if Pending or Verified or (NextIndex <> Count) then raise EArgumentException.Create('Invalid receipt verification.');
          Verified := True;
        end else if EventName = 'complete' then begin
          if not Verified or Pending or not Obj.TryGetValue<Integer>('verifiedTransfers', DoneCount) or (DoneCount <> Count) then
            raise EArgumentException.Create('The deployment receipt is incomplete.');
          Complete := True;
        end else raise EArgumentException.Create('The deployment receipt did not complete successfully.');
      finally Value.Free end;
    end;
    if not Header or not Complete then raise EArgumentException.Create('The deployment receipt is incomplete.');
    Result := Entries.ToArray;
  finally Entries.Free; Lines.Free end;
end;

end.
