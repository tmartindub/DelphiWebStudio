unit WebStudio.DeploymentExecutor;

interface

uses WebStudio.DeploymentReview;

type
  TDeploymentExecution = record
    JournalPath: string;
    VerifiedTransfers: Integer;
    PreservedFiles: Integer;
  end;

{ Internal executor, not connected to any user interface. A future caller must
  show the destination and complete reviewed diff, obtain explicit confirmation,
  and then call this function. The caller must ensure the recovery folder is
  not served by the host. Destination-only files are never deleted. }
function ExecuteReviewedDeployment(const WebsiteZip, ScanFile, BackupZip, JournalFile: string;
  const Reviewed: TDeploymentReview; const Host, UserName, KeyFile, KnownHostsFile: string;
  Port: Word; const RemoteDirectory, RecoveryDirectory: string; Confirmed: Boolean): TDeploymentExecution;

implementation

uses System.SysUtils, System.Classes, System.Zip, System.Hash, System.Generics.Collections,
  WebStudio.DeploymentPreflight, WebStudio.DeploymentJournal, WebStudio.SftpInventory;

function ExecuteReviewedDeployment(const WebsiteZip, ScanFile, BackupZip, JournalFile: string;
  const Reviewed: TDeploymentReview; const Host, UserName, KeyFile, KnownHostsFile: string;
  Port: Word; const RemoteDirectory, RecoveryDirectory: string; Confirmed: Boolean): TDeploymentExecution;
var
  WebsiteStream, ScanStream, BackupStream: TFileStream;
  Verified: TDeploymentReview;
  Zip: TZipFile;
  Journal: TDeploymentJournal;
  Transfer: TDeploymentTransfer;
  Receipt: TSftpTransferReceipt;
  Destination, Expected: TSftpInventoryEntry;
  Live: TArray<TSftpInventoryEntry>;
  ExpectedFiles: TDictionary<string, TSftpInventoryEntry>;
  Index, ZipIndex, Slash, Count: Integer;
  Root, RecoveryRoot, Parent, RelativeFolder, Name, FailureMessage: string;
  Data: TStream;
  Memory: TMemoryStream;
  Header: TZipHeader;
  Hash: THashSHA2;
  Buffer: array[0..65535] of Byte;
  Total, ProjectedSize: UInt64;
  OperationId: TGUID;
  Pending, HasReplacement: Boolean;
begin
  if not Confirmed then raise EInvalidOpException.Create('Explicit confirmation is required before any transfer.');
  WebsiteStream := TFileStream.Create(WebsiteZip, fmOpenRead or fmShareDenyWrite);
  try
    ScanStream := TFileStream.Create(ScanFile, fmOpenRead or fmShareDenyWrite);
    try
      BackupStream := TFileStream.Create(BackupZip, fmOpenRead or fmShareDenyWrite);
      try
        Verified := ReviewDeployment(WebsiteZip, ScanFile, BackupZip);
        if (Verified.WebsiteSha256 <> Reviewed.WebsiteSha256) or
           (Verified.ScanSha256 <> Reviewed.ScanSha256) or
           (Verified.BackupSha256 <> Reviewed.BackupSha256) then
          raise EInvalidOpException.Create('The reviewed files changed. Review them again.');
        HasReplacement := False;
        for Transfer in Verified.Transfers do if Transfer.IsReplacement then HasReplacement := True;
        RecoveryRoot := '';
        if HasReplacement then RecoveryRoot := NormalizePrivateRecoveryDirectory(RemoteDirectory, RecoveryDirectory);
        CheckDeploymentPreflight(WebsiteZip, ScanFile, BackupZip, Reviewed,
          Host, UserName, KeyFile, KnownHostsFile, Port, RemoteDirectory);
        if HasReplacement then CheckPrivateSftpRecovery(Host, UserName, KeyFile, KnownHostsFile,
          Port, RemoteDirectory, RecoveryRoot);
        Verified := ReviewDeployment(WebsiteZip, ScanFile, BackupZip);
        if (Verified.WebsiteSha256 <> Reviewed.WebsiteSha256) or
           (Verified.ScanSha256 <> Reviewed.ScanSha256) or
           (Verified.BackupSha256 <> Reviewed.BackupSha256) then
          raise EInvalidOpException.Create('The reviewed files changed. Review them again.');
        Root := RemoteDirectory;
        while (Length(Root) > 1) and Root.EndsWith('/') do Delete(Root, Length(Root), 1);
        if not Root.EndsWith('/') then Root := Root + '/';
        ExpectedFiles := TDictionary<string, TSftpInventoryEntry>.Create;
        try
        ProjectedSize := 0;
        for Destination in Verified.DestinationFiles do begin
          Inc(ProjectedSize, Destination.Size);
          ExpectedFiles.Add(Destination.Path, Destination);
        end;
        for Transfer in Verified.Transfers do begin
          if Transfer.IsReplacement then begin
            if ProjectedSize < Transfer.ExpectedSize then raise EInvalidOpException.Create('Invalid destination size.');
            Dec(ProjectedSize, Transfer.ExpectedSize);
          end;
          Inc(ProjectedSize, Transfer.DesiredSize);
          if ProjectedSize > 512 * 1024 * 1024 then
            raise EInvalidOpException.Create('The resulting destination would exceed the 512 MiB verification limit.');
        end;
        Zip := TZipFile.Create;
        try
          WebsiteStream.Position := 0;
          Zip.Open(WebsiteStream, zmRead);
          Journal := TDeploymentJournal.CreateNew(JournalFile, Host, Root, RecoveryRoot, Port, Verified);
          try
            Pending := False;
            try
              for Index := 0 to High(Verified.Transfers) do begin
                Transfer := Verified.Transfers[Index];
                ZipIndex := Zip.IndexOf(Transfer.Path);
                if (ZipIndex < 0) or (Zip.FileNames[ZipIndex] <> Transfer.Path) then
                  raise EInvalidOpException.Create('A reviewed website file is missing from the ZIP.');
                Zip.Read(ZipIndex, Data, Header, True);
                Memory := TMemoryStream.Create;
                try
                  try
                    Hash := THashSHA2.Create;
                    Total := 0;
                    repeat
                      Count := Data.Read(Buffer, SizeOf(Buffer));
                      if Count > 0 then begin
                        Inc(Total, Count);
                        if Total > Transfer.DesiredSize then raise EInvalidOpException.Create('A reviewed website file changed size.');
                        Hash.Update(Buffer, Count);
                        Memory.WriteBuffer(Buffer, Count);
                      end;
                    until Count = 0;
                    if (Total <> Transfer.DesiredSize) or (LowerCase(Hash.HashAsString) <> Transfer.DesiredSha256) then
                      raise EInvalidOpException.Create('A reviewed website file failed verification.');
                  finally Data.Free end;
                  Slash := LastDelimiter('/', Transfer.Path);
                  if Slash > 0 then begin
                    RelativeFolder := Copy(Transfer.Path, 1, Slash - 1);
                    Name := Copy(Transfer.Path, Slash + 1, MaxInt);
                    Journal.RecordDirectoryIntent(RelativeFolder);
                    EnsureSftpDirectories(Host, UserName, KeyFile, KnownHostsFile, Port, Root, RelativeFolder);
                    Parent := Root + RelativeFolder;
                  end else begin
                    Name := Transfer.Path;
                    EnsureSftpDirectories(Host, UserName, KeyFile, KnownHostsFile, Port, Root, '');
                    Parent := Root;
                  end;
                  if CreateGUID(OperationId) <> 0 then raise EInvalidOpException.Create('Could not create a transfer identifier.');
                  Journal.BeginTransfer(Index, OperationId);
                  Pending := True;
                  Memory.Position := 0;
                  Receipt := TransferSftpStreamWithId(Host, UserName, KeyFile, KnownHostsFile,
                    Port, Parent, RecoveryRoot, Name, Memory, Transfer.IsReplacement, Transfer.ExpectedSize,
                    Transfer.ExpectedSha256, OperationId);
                  Journal.CompleteTransfer(Receipt);
                  Pending := False;
                  Destination.Path := Transfer.Path;
                  Destination.Size := Transfer.DesiredSize;
                  Destination.Sha256 := Transfer.DesiredSha256;
                  ExpectedFiles.AddOrSetValue(Destination.Path, Destination);
                  if Transfer.IsReplacement then begin
                    if not Receipt.PreviousPath.StartsWith(RecoveryRoot) then
                      raise EInvalidOpException.Create('The retained original is outside the recovery folder.');
                  end;
                finally Memory.Free end;
              end;
              Live := ScanSftpInventory(Host, UserName, KeyFile, KnownHostsFile, Port, Root);
              if Length(Live) <> ExpectedFiles.Count then
                raise EInvalidOpException.Create('The destination changed during transfer; the final scan did not match.');
              for Destination in Live do begin
                if not ExpectedFiles.TryGetValue(Destination.Path, Expected) or
                   (Destination.Size <> Expected.Size) or (Destination.Sha256 <> Expected.Sha256) then
                  raise EInvalidOpException.Create('The destination changed during transfer; the final scan did not match.');
                ExpectedFiles.Remove(Destination.Path);
              end;
              if ExpectedFiles.Count <> 0 then
                raise EInvalidOpException.Create('The final destination scan was incomplete.');
              Journal.RecordFinalVerification;
              Journal.Finish;
            except
              on E: Exception do begin
                FailureMessage := E.Message;
                try
                  if Pending then Journal.FailTransfer(FailureMessage) else Journal.Stop(FailureMessage);
                except
                  on JournalError: Exception do FailureMessage := FailureMessage + ' Journal error: ' + JournalError.Message;
                end;
                raise EInvalidOpException.Create(FailureMessage + ' Inspect the journal at ' + JournalFile + ' before retrying.');
              end;
            end;
          finally Journal.Free end;
        finally Zip.Free end;
        finally ExpectedFiles.Free end;
        Result.JournalPath := JournalFile;
        Result.VerifiedTransfers := Length(Verified.Transfers);
        Result.PreservedFiles := Length(Verified.OnlyAtDestination);
      finally BackupStream.Free end;
    finally ScanStream.Free end;
  finally WebsiteStream.Free end;
end;

end.
