unit WebStudio.DeploymentPreflight;

interface

uses WebStudio.DeploymentReview;

{ Read-only check. It does not authorize or perform a transfer. A future
  publisher must hold inputs stable and repeat preconditions immediately before
  changing the destination. }
procedure CheckDeploymentPreflight(const WebsiteZip, ScanFile, BackupZip: string;
  const Reviewed: TDeploymentReview; const Host, UserName, KeyFile, KnownHostsFile: string;
  Port: Word; const RemoteDirectory: string);

implementation

uses System.SysUtils, System.Generics.Collections, WebStudio.SftpInventory;

procedure CheckDeploymentPreflight(const WebsiteZip, ScanFile, BackupZip: string;
  const Reviewed: TDeploymentReview; const Host, UserName, KeyFile, KnownHostsFile: string;
  Port: Word; const RemoteDirectory: string);
var
  Candidate: TDeploymentReview;
  Live: TArray<TSftpInventoryEntry>;
  Entry, Expected: TSftpInventoryEntry;
  ExpectedFiles: TDictionary<string, TSftpInventoryEntry>;
begin
  Candidate := ReviewDeployment(WebsiteZip, ScanFile, BackupZip);
  if (Candidate.WebsiteSha256 <> Reviewed.WebsiteSha256) or
     (Candidate.ScanSha256 <> Reviewed.ScanSha256) or
     (Candidate.BackupSha256 <> Reviewed.BackupSha256) then
    raise EInvalidOpException.Create('The reviewed files changed. Review them again.');
  Live := ScanSftpInventory(Host, UserName, KeyFile, KnownHostsFile, Port, RemoteDirectory);
  ExpectedFiles := TDictionary<string, TSftpInventoryEntry>.Create;
  try
    for Entry in Candidate.DestinationFiles do ExpectedFiles.Add(Entry.Path, Entry);
    if Length(Live) <> ExpectedFiles.Count then
      raise EInvalidOpException.Create('The destination changed. Scan and back it up again.');
    for Entry in Live do begin
      if not ExpectedFiles.TryGetValue(Entry.Path, Expected) or
         (Entry.Size <> Expected.Size) or (Entry.Sha256 <> Expected.Sha256) then
        raise EInvalidOpException.Create('The destination changed. Scan and back it up again.');
      ExpectedFiles.Remove(Entry.Path);
    end;
    if ExpectedFiles.Count <> 0 then raise EInvalidOpException.Create('The destination changed. Scan and back it up again.');
  finally ExpectedFiles.Free end;
  Candidate := ReviewDeployment(WebsiteZip, ScanFile, BackupZip);
  if (Candidate.WebsiteSha256 <> Reviewed.WebsiteSha256) or
     (Candidate.ScanSha256 <> Reviewed.ScanSha256) or
     (Candidate.BackupSha256 <> Reviewed.BackupSha256) then
    raise EInvalidOpException.Create('The reviewed files changed. Review them again.');
end;

end.
