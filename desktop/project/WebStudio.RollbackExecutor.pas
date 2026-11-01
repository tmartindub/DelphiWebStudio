unit WebStudio.RollbackExecutor;
{$B-}

interface

uses WebStudio.DeploymentReview, WebStudio.SftpInventory;

{ Internal operation. The caller must display the reviewed list and destination,
  obtain explicit confirmation, and ensure the recovery folder is not web-served. }
procedure ExecuteAddedRollback(const OriginalZip, ScanFile, CurrentBackup, OriginalReceipt,
  RollbackReceipt: string; const Reviewed: TDeploymentReview; const ReviewedAdded: TArray<TSftpInventoryEntry>;
  const Host, UserName, KeyFile, KnownHostsFile: string; Port: Word;
  const RemoteDirectory, RecoveryDirectory: string; Confirmed: Boolean);

implementation

uses Winapi.Windows, System.SysUtils, System.Classes, System.JSON, System.Generics.Collections,
  WebStudio.RollbackReview, WebStudio.DeploymentPreflight;

procedure ExecuteAddedRollback(const OriginalZip, ScanFile, CurrentBackup, OriginalReceipt,
  RollbackReceipt: string; const Reviewed: TDeploymentReview; const ReviewedAdded: TArray<TSftpInventoryEntry>;
  const Host, UserName, KeyFile, KnownHostsFile: string; Port: Word;
  const RemoteDirectory, RecoveryDirectory: string; Confirmed: Boolean);
var
  OriginalStream, ScanStream, BackupStream, ReceiptStream: TFileStream;
  Current: TDeploymentReview;
  Added, Live: TArray<TSftpInventoryEntry>;
  Entry, Expected: TSftpInventoryEntry;
  ExpectedFiles: TDictionary<string, TSftpInventoryEntry>;
  Journal: THandle;
  RecordValue: TJSONObject;
  Receipt: TSftpTransferReceipt;
  Root, RecoveryRoot, Parent, Name, RetainedPath, Failure: string;
  Id: TGUID;
  Index, Slash: Integer;
  Pending: Boolean;

  procedure WriteRecord(Value: TJSONObject);
  var Bytes: TBytes; Written: Cardinal;
  begin
    Bytes := TEncoding.UTF8.GetBytes(Value.ToJSON + #10);
    if not WriteFile(Journal, Bytes[0], Length(Bytes), Written, nil) or
       (Written <> Cardinal(Length(Bytes))) or not FlushFileBuffers(Journal) then
      raise EInvalidOpException.Create('Could not safely write the rollback receipt.');
  end;

begin
  if not Confirmed then raise EInvalidOpException.Create('Explicit confirmation is required before rollback.');
  OriginalStream := TFileStream.Create(OriginalZip, fmOpenRead or fmShareDenyWrite);
  try
    ScanStream := TFileStream.Create(ScanFile, fmOpenRead or fmShareDenyWrite);
    try
      BackupStream := TFileStream.Create(CurrentBackup, fmOpenRead or fmShareDenyWrite);
      try
        ReceiptStream := TFileStream.Create(OriginalReceipt, fmOpenRead or fmShareDenyWrite);
        try
          Current := ReviewDeployment(OriginalZip, ScanFile, CurrentBackup);
          if (Current.WebsiteSha256 <> Reviewed.WebsiteSha256) or (Current.ScanSha256 <> Reviewed.ScanSha256) or
             (Current.BackupSha256 <> Reviewed.BackupSha256) then raise EInvalidOpException.Create('The reviewed files changed.');
          Added := ReviewAddedRollback(OriginalReceipt, Host, RemoteDirectory, Port, Current);
          if Length(Added) <> Length(ReviewedAdded) then raise EInvalidOpException.Create('The rollback plan changed.');
          for Index := 0 to High(Added) do
            if (Added[Index].Path <> ReviewedAdded[Index].Path) or (Added[Index].Size <> ReviewedAdded[Index].Size) or
               (Added[Index].Sha256 <> ReviewedAdded[Index].Sha256) then raise EInvalidOpException.Create('The rollback plan changed.');
          if Length(Added) = 0 then raise EInvalidOpException.Create('The receipt has no added files to retain.');
          RecoveryRoot := NormalizePrivateRecoveryDirectory(RemoteDirectory, RecoveryDirectory);
          CheckDeploymentPreflight(OriginalZip, ScanFile, CurrentBackup, Reviewed, Host, UserName, KeyFile, KnownHostsFile, Port, RemoteDirectory);
          CheckPrivateSftpRecovery(Host, UserName, KeyFile, KnownHostsFile, Port, RemoteDirectory, RecoveryRoot);
          Root := RemoteDirectory;
          while (Length(Root) > 1) and Root.EndsWith('/') do Delete(Root, Length(Root), 1);
          if not Root.EndsWith('/') then Root := Root + '/';
          ExpectedFiles := TDictionary<string, TSftpInventoryEntry>.Create;
          try
            for Entry in Current.DestinationFiles do ExpectedFiles.Add(Entry.Path, Entry);
            Journal := CreateFile(PChar(RollbackReceipt), GENERIC_WRITE, FILE_SHARE_READ, nil, CREATE_NEW, FILE_ATTRIBUTE_NORMAL, 0);
            if Journal = INVALID_HANDLE_VALUE then RaiseLastOSError;
            try
              RecordValue := TJSONObject.Create;
              try
                RecordValue.AddPair('event', 'reviewed'); RecordValue.AddPair('host', Host);
                RecordValue.AddPair('destination', Root); RecordValue.AddPair('originalReceipt', OriginalReceipt);
                RecordValue.AddPair('recoveryDirectory', RecoveryRoot); WriteRecord(RecordValue);
              finally RecordValue.Free end;
              Pending := False;
              try
                for Entry in Added do begin
                  Slash := LastDelimiter('/', Entry.Path);
                  Parent := Root + Copy(Entry.Path, 1, Slash);
                  Name := Copy(Entry.Path, Slash + 1, MaxInt);
                  if CreateGUID(Id) <> 0 then raise EInvalidOpException.Create('Could not create a recovery identifier.');
                  RetainedPath := RecoveryRoot + '.webstudio-added-' + GUIDToString(Id) + '.bak';
                  RecordValue := TJSONObject.Create;
                  try
                    RecordValue.AddPair('event', 'retain-started'); RecordValue.AddPair('path', Root + Entry.Path);
                    RecordValue.AddPair('retainedPath', RetainedPath); RecordValue.AddPair('sha256', Entry.Sha256);
                    RecordValue.AddPair('size', TJSONNumber.Create(Int64(Entry.Size))); WriteRecord(RecordValue);
                  finally RecordValue.Free end;
                  Pending := True;
                  Receipt := RetainAddedSftpFileWithId(Host, UserName, KeyFile, KnownHostsFile, Port,
                    Parent, RecoveryRoot, Name, Entry.Size, Entry.Sha256, Id);
                  if (Receipt.Path <> Root + Entry.Path) or (Receipt.PreviousPath <> RetainedPath) or
                     (Receipt.Size <> Entry.Size) or (Receipt.Sha256 <> Entry.Sha256) then
                    raise EInvalidOpException.Create('The retained file did not match the reviewed plan.');
                  RecordValue := TJSONObject.Create;
                  try RecordValue.AddPair('event', 'retain-verified'); RecordValue.AddPair('path', Receipt.Path);
                    RecordValue.AddPair('retainedPath', Receipt.PreviousPath); WriteRecord(RecordValue);
                  finally RecordValue.Free end;
                  Pending := False;
                  ExpectedFiles.Remove(Entry.Path);
                end;
                Live := ScanSftpInventory(Host, UserName, KeyFile, KnownHostsFile, Port, Root);
                if Length(Live) <> ExpectedFiles.Count then raise EInvalidOpException.Create('The destination changed during rollback.');
                for Entry in Live do begin
                  if not ExpectedFiles.TryGetValue(Entry.Path, Expected) or (Entry.Size <> Expected.Size) or
                     (Entry.Sha256 <> Expected.Sha256) then raise EInvalidOpException.Create('The destination changed during rollback.');
                  ExpectedFiles.Remove(Entry.Path);
                end;
                if ExpectedFiles.Count <> 0 then raise EInvalidOpException.Create('The destination scan was incomplete.');
                RecordValue := TJSONObject.Create;
                try RecordValue.AddPair('event', 'complete'); WriteRecord(RecordValue) finally RecordValue.Free end;
              except
                on E: Exception do begin
                  Failure := E.Message;
                  try
                    RecordValue := TJSONObject.Create;
                    try
                      if Pending then RecordValue.AddPair('event', 'retain-failed') else RecordValue.AddPair('event', 'stopped');
                      RecordValue.AddPair('message', Copy(Failure, 1, 2048)); WriteRecord(RecordValue);
                    finally RecordValue.Free end;
                  except on JournalError: Exception do Failure := Failure + ' Receipt error: ' + JournalError.Message end;
                  raise EInvalidOpException.Create(Failure + ' Inspect the rollback receipt at ' + RollbackReceipt + ' before retrying.');
                end;
              end;
            finally CloseHandle(Journal) end;
          finally ExpectedFiles.Free end;
        finally ReceiptStream.Free end;
      finally BackupStream.Free end;
    finally ScanStream.Free end;
  finally OriginalStream.Free end;
end;

end.
