unit WebStudio.DeploymentReview;
{$B-}

interface

uses WebStudio.SftpInventory;

type
  TDeploymentTransfer = record
    Path: string;
    DesiredSize: UInt64;
    DesiredSha256: string;
    IsReplacement: Boolean;
    ExpectedSize: UInt64;
    ExpectedSha256: string;
  end;

  TDeploymentReview = record
    WebsiteSha256, ScanSha256, BackupSha256: string;
    Added, Changed, OnlyAtDestination: TArray<string>;
    Transfers: TArray<TDeploymentTransfer>;
    DestinationFiles: TArray<TSftpInventoryEntry>;
  end;

{ Local review only: does not contact or change a destination. The caller must
  recheck the three fingerprints and destination before any future transfer. }
function ReviewDeployment(const WebsiteZip, ScanFile, BackupZip: string): TDeploymentReview;

implementation

uses System.SysUtils, System.Classes, System.JSON, System.Zip, System.Hash,
  System.Generics.Collections;

procedure ValidatePath(const Path: string);
var Part: string; Index: Integer;
begin
  if (Path = '') or (Path[1] = '/') or (Pos('\', Path) > 0) or (Pos(':', Path) > 0) then
    raise EArgumentException.Create('A file path is invalid.');
  for Index := 1 to Length(Path) do
    if Path[Index] < #32 then raise EArgumentException.Create('A file path is invalid.');
  for Part in Path.Split(['/']) do
    if (Part = '') or (Part = '.') or (Part = '..') then raise EArgumentException.Create('A file path is invalid.');
end;

procedure AddFile(Map: TDictionary<string, TSftpInventoryEntry>;
  Names, Folders: TDictionary<string, Boolean>; const Entry: TSftpInventoryEntry);
var Key, Parent: string; Index: Integer;
begin
  ValidatePath(Entry.Path);
  Key := LowerCase(Entry.Path);
  if Names.ContainsKey(Key) or Folders.ContainsKey(Key) then raise EArgumentException.Create('File paths collide.');
  for Index := 1 to Length(Key) do
    if Key[Index] = '/' then begin
      Parent := Copy(Key, 1, Index - 1);
      if Names.ContainsKey(Parent) then raise EArgumentException.Create('A file conflicts with a folder.');
      Folders.AddOrSetValue(Parent, True);
    end;
  Names.Add(Key, True);
  Map.Add(Entry.Path, Entry);
end;

procedure ReadZip(Stream: TStream; Map: TDictionary<string, TSftpInventoryEntry>);
var
  Zip: TZipFile;
  Names, Folders: TDictionary<string, Boolean>;
  Index, Count: Integer;
  Total, ReadTotal: UInt64;
  Header, LocalHeader: TZipHeader;
  Entry: TSftpInventoryEntry;
  Data: TStream;
  Hash: THashSHA2;
  Buffer: array[0..65535] of Byte;
  Path, LocalName: string;
begin
  if (Stream.Size <= 0) or (Stream.Size > 520 * 1024 * 1024) then
    raise EArgumentException.Create('A ZIP file is empty or exceeds the size limit.');
  Zip := TZipFile.Create;
  Names := TDictionary<string, Boolean>.Create;
  Folders := TDictionary<string, Boolean>.Create;
  try
    Stream.Position := 0;
    Zip.Open(Stream, zmRead);
    if Zip.FileCount > 20000 then raise EArgumentException.Create('A ZIP contains too many entries.');
    Total := 0;
    for Index := 0 to Zip.FileCount - 1 do begin
      Path := Zip.FileNames[Index];
      Header := Zip.FileInfo[Index];
      if Header.IsEncrypted then raise EArgumentException.Create('Encrypted ZIP files are not supported.');
      if ((Header.MadeByVersion shr 8) = 3) and ((Header.ExternalAttributes shr 16) and $F000 = $A000) then
        raise EArgumentException.Create('A ZIP contains a symbolic link.');
      if Path.EndsWith('/') then begin
        Delete(Path, Length(Path), 1);
        ValidatePath(Path);
        Continue;
      end;
      if (Header.UncompressedSize64 > 64 * 1024 * 1024) or
         (Total + Header.UncompressedSize64 > 512 * 1024 * 1024) then
        raise EArgumentException.Create('A ZIP exceeds the supported file size limits.');
      Inc(Total, Header.UncompressedSize64);
      Entry.Path := Path;
      Entry.Size := Header.UncompressedSize64;
      Zip.Read(Index, Data, LocalHeader, True);
      try
        if not TEncoding.UTF8.IsBufferValid(LocalHeader.FileName) then raise EArgumentException.Create('A ZIP filename is not valid UTF-8.');
        LocalName := TEncoding.UTF8.GetString(LocalHeader.FileName);
        if (LocalName <> Path) or (LocalHeader.CRC32 <> Header.CRC32) or
           (LocalHeader.UncompressedSize64 <> Header.UncompressedSize64) then
          raise EArgumentException.Create('ZIP file headers do not match.');
        Hash := THashSHA2.Create;
        ReadTotal := 0;
        repeat
          Count := Data.Read(Buffer, SizeOf(Buffer));
          if Count > 0 then begin
            Inc(ReadTotal, Count);
            if ReadTotal > Entry.Size then raise EArgumentException.Create('A ZIP file exceeds its stated size.');
            Hash.Update(Buffer, Count);
          end;
        until Count = 0;
        if ReadTotal <> Entry.Size then raise EArgumentException.Create('A ZIP file is incomplete.');
        Entry.Sha256 := LowerCase(Hash.HashAsString);
      finally Data.Free end;
      if Map.Count >= 10000 then raise EArgumentException.Create('A ZIP contains too many files.');
      AddFile(Map, Names, Folders, Entry);
    end;
  finally
    Zip.Free;
    Names.Free;
    Folders.Free;
  end;
end;

procedure ReadScan(Stream: TStream; Map: TDictionary<string, TSftpInventoryEntry>);
var
  Bytes: TBytes;
  Value: TJSONValue;
  Document, Item: TJSONObject;
  Files: TJSONArray;
  Names, Folders: TDictionary<string, Boolean>;
  FormatValue, VersionValue, PathValue, SizeValue, HashValue: TJSONValue;
  Entry: TSftpInventoryEntry;
  Index: Integer;
begin
  if (Stream.Size <= 0) or (Stream.Size > 2 * 1024 * 1024) then raise EArgumentException.Create('The scan file exceeds its size limit.');
  SetLength(Bytes, Stream.Size); Stream.Position := 0; Stream.ReadBuffer(Bytes[0], Length(Bytes));
  if not TEncoding.UTF8.IsBufferValid(Bytes) then raise EArgumentException.Create('The scan is not valid UTF-8.');
  Value := TJSONObject.ParseJSONValue(TEncoding.UTF8.GetString(Bytes));
  Names := TDictionary<string, Boolean>.Create;
  Folders := TDictionary<string, Boolean>.Create;
  try
    if not (Value is TJSONObject) then raise EArgumentException.Create('Invalid destination scan.');
    Document := TJSONObject(Value);
    if Document.Count <> 3 then raise EArgumentException.Create('Invalid destination scan.');
    FormatValue := Document.GetValue('format'); VersionValue := Document.GetValue('version');
    if not (FormatValue is TJSONString) or (FormatValue.Value <> 'webstudio-website-manifest') or
       not (VersionValue is TJSONNumber) or (VersionValue.Value <> '1') or
       not (Document.GetValue('files') is TJSONArray) then raise EArgumentException.Create('Invalid destination scan.');
    Files := TJSONArray(Document.GetValue('files'));
    if Files.Count > 10000 then raise EArgumentException.Create('The destination scan contains too many files.');
    for Index := 0 to Files.Count - 1 do begin
      if not (Files.Items[Index] is TJSONObject) then raise EArgumentException.Create('Invalid destination file entry.');
      Item := TJSONObject(Files.Items[Index]);
      if Item.Count <> 3 then raise EArgumentException.Create('Invalid destination file entry.');
      PathValue := Item.GetValue('path'); SizeValue := Item.GetValue('size'); HashValue := Item.GetValue('sha256');
      if not (PathValue is TJSONString) or not (SizeValue is TJSONNumber) or not (HashValue is TJSONString) then
        raise EArgumentException.Create('Invalid destination file entry.');
      Entry.Path := PathValue.Value;
      if not TryStrToUInt64(SizeValue.Value, Entry.Size) or (Entry.Size > 64 * 1024 * 1024) then
        raise EArgumentException.Create('A destination file exceeds the backup size limit.');
      Entry.Sha256 := LowerCase(HashValue.Value);
      if (Length(Entry.Sha256) <> 64) then raise EArgumentException.Create('Invalid destination checksum.');
      for var Character in Entry.Sha256 do
        if not CharInSet(Character, ['0'..'9', 'a'..'f']) then raise EArgumentException.Create('Invalid destination checksum.');
      AddFile(Map, Names, Folders, Entry);
    end;
  finally
    Names.Free;
    Folders.Free;
    Value.Free;
  end;
end;

function ReviewDeployment(const WebsiteZip, ScanFile, BackupZip: string): TDeploymentReview;
var
  WebsiteStream, ScanStream, BackupStream: TFileStream;
  Website, Scan, Backup: TDictionary<string, TSftpInventoryEntry>;
  Added, Changed, OnlyDestination: TStringList;
  Pair: TPair<string, TSftpInventoryEntry>;
  Other, Desired: TSftpInventoryEntry;
  Index, Position: Integer;
begin
  WebsiteStream := TFileStream.Create(WebsiteZip, fmOpenRead or fmShareDenyWrite);
  try
    ScanStream := TFileStream.Create(ScanFile, fmOpenRead or fmShareDenyWrite);
    try
      BackupStream := TFileStream.Create(BackupZip, fmOpenRead or fmShareDenyWrite);
      try
        Website := TDictionary<string, TSftpInventoryEntry>.Create;
        Scan := TDictionary<string, TSftpInventoryEntry>.Create;
        Backup := TDictionary<string, TSftpInventoryEntry>.Create;
        Added := TStringList.Create; Changed := TStringList.Create; OnlyDestination := TStringList.Create;
        try
          ReadZip(WebsiteStream, Website); ReadScan(ScanStream, Scan); ReadZip(BackupStream, Backup);
          if Backup.Count <> Scan.Count then raise EArgumentException.Create('The backup does not match the destination scan.');
          for Pair in Scan do
            if not Backup.TryGetValue(Pair.Key, Other) or (Other.Size <> Pair.Value.Size) or (Other.Sha256 <> Pair.Value.Sha256) then
              raise EArgumentException.Create('The backup does not match the destination scan.');
          for Pair in Website do
            if not Scan.TryGetValue(Pair.Key, Other) then Added.Add(Pair.Key)
            else if (Other.Size <> Pair.Value.Size) or (Other.Sha256 <> Pair.Value.Sha256) then Changed.Add(Pair.Key);
          for Pair in Scan do if not Website.ContainsKey(Pair.Key) then OnlyDestination.Add(Pair.Key);
          Added.Sort; Changed.Sort; OnlyDestination.Sort;
          Result.Added := Added.ToStringArray; Result.Changed := Changed.ToStringArray;
          Result.OnlyAtDestination := OnlyDestination.ToStringArray;
          SetLength(Result.DestinationFiles, Scan.Count);
          Position := 0;
          for Pair in Scan do begin
            Result.DestinationFiles[Position] := Pair.Value;
            Inc(Position);
          end;
          SetLength(Result.Transfers, Added.Count + Changed.Count);
          Position := 0;
          for Index := 0 to Added.Count - 1 do begin
            Desired := Website.Items[Added[Index]];
            Result.Transfers[Position].Path := Desired.Path;
            Result.Transfers[Position].DesiredSize := Desired.Size;
            Result.Transfers[Position].DesiredSha256 := Desired.Sha256;
            Result.Transfers[Position].IsReplacement := False;
            Result.Transfers[Position].ExpectedSize := 0;
            Result.Transfers[Position].ExpectedSha256 := '';
            Inc(Position);
          end;
          for Index := 0 to Changed.Count - 1 do begin
            Desired := Website.Items[Changed[Index]];
            Other := Scan.Items[Changed[Index]];
            Result.Transfers[Position].Path := Desired.Path;
            Result.Transfers[Position].DesiredSize := Desired.Size;
            Result.Transfers[Position].DesiredSha256 := Desired.Sha256;
            Result.Transfers[Position].IsReplacement := True;
            Result.Transfers[Position].ExpectedSize := Other.Size;
            Result.Transfers[Position].ExpectedSha256 := Other.Sha256;
            Inc(Position);
          end;
          WebsiteStream.Position := 0; ScanStream.Position := 0; BackupStream.Position := 0;
          Result.WebsiteSha256 := LowerCase(THashSHA2.GetHashString(WebsiteStream));
          Result.ScanSha256 := LowerCase(THashSHA2.GetHashString(ScanStream));
          Result.BackupSha256 := LowerCase(THashSHA2.GetHashString(BackupStream));
        finally
          OnlyDestination.Free; Changed.Free; Added.Free; Backup.Free; Scan.Free; Website.Free;
        end;
      finally BackupStream.Free end;
    finally ScanStream.Free end;
  finally WebsiteStream.Free end;
end;

end.
