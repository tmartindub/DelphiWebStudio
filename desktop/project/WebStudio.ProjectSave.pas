unit WebStudio.ProjectSave;
{$B-}

interface

uses System.SysUtils;

{ Creates a new project file selected by a trusted native caller. This
  operation never replaces an existing path. The caller owns validation,
  user confirmation, session checks, and the in-memory project snapshot. }
procedure SaveNewProjectFile(const TargetPath: string; const Contents: TBytes);

{ Creates a ZIP containing the current source file at a new, caller-selected
  recovery path. This does not replace the project or grant permission to do
  so. The caller must choose paths, a byte limit and a recovery policy. }
procedure SaveProjectRecoveryZip(const SourcePath, RecoveryZipPath: string;
  MaximumSourceBytes: UInt64);

{ Restores one ZIP entry to a new caller-selected file. Existing files are
  never replaced. The caller validates project contents before opening them. }
procedure RestoreProjectRecoveryZip(const RecoveryZipPath, NewTargetPath: string;
  MaximumArchiveBytes, MaximumProjectBytes: UInt64);

implementation

uses Winapi.Windows, System.IOUtils, System.Classes, System.Zip, WebStudio.ProjectOpen;

procedure SaveNewProjectFile(const TargetPath: string; const Contents: TBytes);
var
  DirectoryName, TemporaryPath, FullTarget: string;
  FileHandle: THandle;
  Id: TGUID;
  Offset: NativeInt;
  ChunkSize, Written: DWORD;
  TemporaryCreated: Boolean;
begin
  if (Length(TargetPath) < 4) or not CharInSet(TargetPath[1], ['A'..'Z', 'a'..'z']) or
    (TargetPath[2] <> ':') or not CharInSet(TargetPath[3], ['\', '/']) then
    raise EArgumentException.Create('Select an absolute drive path for the project file.');
  FullTarget := TPath.GetFullPath(TargetPath);
  DirectoryName := TPath.GetDirectoryName(FullTarget);
  if (DirectoryName = '') or (TPath.GetFileName(FullTarget) = '') then
    raise EArgumentException.Create('A project filename is required.');
  if CreateGUID(Id) <> 0 then raise EInvalidOpException.Create('Could not create a temporary file name.');
  TemporaryPath := TPath.Combine(DirectoryName, '.webstudio-' + GUIDToString(Id) + '.tmp');
  FileHandle := CreateFile(PChar(TemporaryPath), GENERIC_WRITE, 0, nil, CREATE_NEW,
    FILE_ATTRIBUTE_NORMAL or FILE_FLAG_WRITE_THROUGH, 0);
  if FileHandle = INVALID_HANDLE_VALUE then RaiseLastOSError;
  TemporaryCreated := True;
  try
    try
      Offset := 0;
      while Offset < Length(Contents) do begin
        if Length(Contents) - Offset > 1048576 then ChunkSize := 1048576
        else ChunkSize := DWORD(Length(Contents) - Offset);
        if not WriteFile(FileHandle, Contents[Offset], ChunkSize, Written, nil) then RaiseLastOSError;
        if Written = 0 then raise EWriteError.Create('Project file write made no progress.');
        Inc(Offset, Written);
      end;
      if not FlushFileBuffers(FileHandle) then RaiseLastOSError;
    finally
      CloseHandle(FileHandle);
    end;
    if not MoveFileEx(PChar(TemporaryPath), PChar(FullTarget), MOVEFILE_WRITE_THROUGH) then RaiseLastOSError;
    TemporaryCreated := False;
  finally
    if TemporaryCreated then Winapi.Windows.DeleteFile(PChar(TemporaryPath));
  end;
end;

procedure SaveProjectRecoveryZip(const SourcePath, RecoveryZipPath: string;
  MaximumSourceBytes: UInt64);
var
  ProjectBytes, ZipBytes, VerifiedBytes: TBytes;
  Archive: TZipFile;
  Buffer: TMemoryStream;
begin
  if not SameText(TPath.GetExtension(RecoveryZipPath), '.zip') then
    raise EArgumentException.Create('The recovery file must have a .zip extension.');
  ProjectBytes := ReadProjectFile(SourcePath, MaximumSourceBytes);
  Buffer := TMemoryStream.Create;
  try
    Archive := TZipFile.Create;
    try
      Archive.Open(Buffer, zmWrite);
      Archive.Add(ProjectBytes, TPath.GetFileName(SourcePath));
      Archive.Close;
    finally
      Archive.Free;
    end;
    Buffer.Position := 0;
    Archive := TZipFile.Create;
    try
      Archive.Open(Buffer, zmRead);
      if (Archive.FileCount <> 1) or (Archive.FileName[0] <> TPath.GetFileName(SourcePath)) then
        raise EWriteError.Create('Recovery ZIP has an unexpected entry. The project was not changed.');
      Archive.Read(0, VerifiedBytes);
      if (Length(VerifiedBytes) <> Length(ProjectBytes)) or
        ((Length(ProjectBytes) > 0) and not CompareMem(@VerifiedBytes[0], @ProjectBytes[0], Length(ProjectBytes))) then
        raise EWriteError.Create('Recovery ZIP contents could not be verified. The project was not changed.');
    finally
      Archive.Free;
    end;
    if UInt64(Buffer.Size) > UInt64(High(NativeInt)) then
      raise EArgumentException.Create('Recovery ZIP is too large.');
    SetLength(ZipBytes, NativeInt(Buffer.Size));
    if Length(ZipBytes) > 0 then Move(Buffer.Memory^, ZipBytes[0], Length(ZipBytes));
    SaveNewProjectFile(RecoveryZipPath, ZipBytes);
    VerifiedBytes := ReadProjectFile(RecoveryZipPath, UInt64(Length(ZipBytes)));
    if (Length(VerifiedBytes) <> Length(ZipBytes)) or
      ((Length(ZipBytes) > 0) and not CompareMem(@VerifiedBytes[0], @ZipBytes[0], Length(ZipBytes))) then
      raise EWriteError.CreateFmt('Recovery ZIP could not be verified: %s. The project was not changed.', [RecoveryZipPath]);
    VerifiedBytes := ReadProjectFile(SourcePath, MaximumSourceBytes);
    if (Length(VerifiedBytes) <> Length(ProjectBytes)) or
      ((Length(ProjectBytes) > 0) and not CompareMem(@VerifiedBytes[0], @ProjectBytes[0], Length(ProjectBytes))) then
      raise EWriteError.CreateFmt('The project changed during recovery creation. The earlier ZIP remains at %s.', [RecoveryZipPath]);
  finally
    Buffer.Free;
  end;
end;

procedure RestoreProjectRecoveryZip(const RecoveryZipPath, NewTargetPath: string;
  MaximumArchiveBytes, MaximumProjectBytes: UInt64);
var
  ArchiveBytes, ProjectBytes, VerifiedBytes: TBytes;
  Buffer: TBytesStream;
  EntryStream: TStream;
  Archive: TZipFile;
  Header, LocalHeader: TZipHeader;
  EntryName: string;
  Offset: NativeInt;
  ChunkSize: Integer;
  ExtraByte: Byte;
begin
  if not SameText(TPath.GetExtension(RecoveryZipPath), '.zip') then
    raise EArgumentException.Create('The recovery file must have a .zip extension.');
  ArchiveBytes := ReadProjectFile(RecoveryZipPath, MaximumArchiveBytes);
  Buffer := TBytesStream.Create(ArchiveBytes);
  try
    Archive := TZipFile.Create;
    try
      Archive.Open(Buffer, zmRead);
      if Archive.FileCount <> 1 then raise EArgumentException.Create('Recovery ZIP must contain exactly one project file.');
      EntryName := Archive.FileName[0];
      if (EntryName = '') or (EntryName = '.') or (EntryName = '..') or
        (Pos('/', EntryName) > 0) or (Pos('\', EntryName) > 0) then
        raise EArgumentException.Create('Recovery ZIP contains an invalid filename.');
      Header := Archive.FileInfo[0];
      if Header.IsEncrypted or (Header.UncompressedSize64 > MaximumProjectBytes) or
        (Header.UncompressedSize64 > UInt64(High(NativeInt))) then
        raise EArgumentException.Create('Recovery project is encrypted or exceeds the allowed size.');
      Archive.Read(0, EntryStream, LocalHeader, True);
      try
        if (LocalHeader.CompressedSize64 <> Header.CompressedSize64) or
          (LocalHeader.UncompressedSize64 <> Header.UncompressedSize64) or
          (LocalHeader.CRC32 <> Header.CRC32) or
          (LocalHeader.CompressionMethod <> Header.CompressionMethod) or
          (LocalHeader.IsEncrypted <> Header.IsEncrypted) or
          (Archive.GetHeaderFileName(LocalHeader) <> EntryName) then
          raise EArgumentException.Create('Recovery ZIP entry headers do not match.');
        SetLength(ProjectBytes, NativeInt(Header.UncompressedSize64));
        Offset := 0;
        while Offset < Length(ProjectBytes) do begin
          if Length(ProjectBytes) - Offset > 1048576 then ChunkSize := 1048576
          else ChunkSize := Integer(Length(ProjectBytes) - Offset);
          EntryStream.ReadBuffer(ProjectBytes[Offset], ChunkSize);
          Inc(Offset, ChunkSize);
        end;
        if EntryStream.Read(ExtraByte, 1) <> 0 then
          raise EArgumentException.Create('Recovery ZIP contains unexpected project data.');
      finally
        EntryStream.Free;
      end;
    finally
      Archive.Free;
    end;
  finally
    Buffer.Free;
  end;
  SaveNewProjectFile(NewTargetPath, ProjectBytes);
  VerifiedBytes := ReadProjectFile(NewTargetPath, MaximumProjectBytes);
  if (Length(VerifiedBytes) <> Length(ProjectBytes)) or
    ((Length(ProjectBytes) > 0) and not CompareMem(@VerifiedBytes[0], @ProjectBytes[0], Length(ProjectBytes))) then
    raise EWriteError.CreateFmt('Recovered project could not be verified: %s. The recovery ZIP was not changed.', [NewTargetPath]);
end;
end.
