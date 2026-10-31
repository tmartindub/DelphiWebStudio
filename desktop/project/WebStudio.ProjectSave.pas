unit WebStudio.ProjectSave;
{$B-}

interface

uses Winapi.Windows, System.SysUtils;

{ Creates a new project file selected by a trusted native caller. This
  operation never replaces an existing path. The caller owns validation,
  user confirmation, session checks, and the in-memory project snapshot. }
procedure SaveNewProjectFile(const TargetPath: string; const Contents: TBytes);

{ Flushes a staged file and moves it to a new path in the same directory.
  Neither a failed move nor an existing target deletes the staged file. }
procedure CommitStagedProjectFile(const StagedPath, TargetPath: string);

{ Replaces a caller-confirmed existing project with a staged file, after a
  verified ZIP recovery copy. The caller must own and validate the staged file
  and obtain explicit confirmation. On failure, inspect all named files;
  Windows may have moved the original even when replacement reports an error. }
procedure ReplaceStagedProjectFile(const StagedPath, TargetPath: string;
  MaximumSourceBytes: UInt64; const ConfirmedOriginal, ValidatedStage: TByHandleFileInformation;
  out RecoveryZipPath, RetainedOriginalPath: string);

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

uses System.IOUtils, System.Classes, System.Zip, WebStudio.ProjectOpen;

function SetFileInformationByHandle(FileHandle: THandle; FileInformationClass: Integer;
  FileInformation: Pointer; BufferSize: DWORD): BOOL; stdcall;
  external 'kernel32.dll' name 'SetFileInformationByHandle';

procedure ReplaceStagedProjectFile(const StagedPath, TargetPath: string;
  MaximumSourceBytes: UInt64; const ConfirmedOriginal, ValidatedStage: TByHandleFileInformation;
  out RecoveryZipPath, RetainedOriginalPath: string);
const FileDispositionInfo = 4;
var
  FullStage, FullTarget, RecoveryDir, RawDir, RawPath: string;
  OriginalHandle, CurrentHandle, StageHandle, RawHandle: THandle;
  OriginalInfo, CurrentInfo, RawInfo, StageInfo, ResultInfo: TByHandleFileInformation;
  Id: TGUID;
  OriginalStream, EntryStream: TStream;
  ZipInput: TFileStream;
  Archive: TZipFile;
  Header: TZipHeader;
  SourceBuffer, EntryBuffer: array[0..65535] of Byte;
  Count, ReadCount: Integer;
  DeleteFlag: Byte;
  Replaced: Boolean;
begin
  RecoveryZipPath := '';
  RetainedOriginalPath := '';
  if (Length(StagedPath) < 4) or not CharInSet(StagedPath[1], ['A'..'Z', 'a'..'z']) or
    (StagedPath[2] <> ':') or not CharInSet(StagedPath[3], ['\', '/']) or
    (Length(TargetPath) < 4) or not CharInSet(TargetPath[1], ['A'..'Z', 'a'..'z']) or
    (TargetPath[2] <> ':') or not CharInSet(TargetPath[3], ['\', '/']) then
    raise EArgumentException.Create('Select absolute drive paths for the project files.');
  FullStage := TPath.GetFullPath(StagedPath);
  FullTarget := TPath.GetFullPath(TargetPath);
  if SameText(FullStage, FullTarget) or
    not SameText(TPath.GetDirectoryName(FullStage), TPath.GetDirectoryName(FullTarget)) then
    raise EArgumentException.Create('The staged file and existing project must have different names in the same folder.');
  OriginalHandle := CreateFile(PChar(FullTarget), GENERIC_READ, FILE_SHARE_READ or FILE_SHARE_DELETE,
    nil, OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, 0);
  if OriginalHandle = INVALID_HANDLE_VALUE then RaiseLastOSError;
  Replaced := False;
  RecoveryDir := '';
  RawPath := '';
  try
    try
      if not GetFileInformationByHandle(OriginalHandle, OriginalInfo) then RaiseLastOSError;
      if (OriginalInfo.dwVolumeSerialNumber <> ConfirmedOriginal.dwVolumeSerialNumber) or
        (OriginalInfo.nFileIndexHigh <> ConfirmedOriginal.nFileIndexHigh) or
        (OriginalInfo.nFileIndexLow <> ConfirmedOriginal.nFileIndexLow) or
        (OriginalInfo.nFileSizeHigh <> ConfirmedOriginal.nFileSizeHigh) or
        (OriginalInfo.nFileSizeLow <> ConfirmedOriginal.nFileSizeLow) or
        not CompareMem(@OriginalInfo.ftLastWriteTime, @ConfirmedOriginal.ftLastWriteTime, SizeOf(TFileTime)) then
        raise EWriteError.Create('The project changed after replacement was confirmed.');
      StageHandle := CreateFile(PChar(FullStage), GENERIC_WRITE, 0, nil, OPEN_EXISTING,
        FILE_ATTRIBUTE_NORMAL or FILE_FLAG_WRITE_THROUGH, 0);
      if StageHandle = INVALID_HANDLE_VALUE then RaiseLastOSError;
      try
        if not FlushFileBuffers(StageHandle) or not GetFileInformationByHandle(StageHandle, StageInfo) then RaiseLastOSError;
      finally CloseHandle(StageHandle) end;
      if (StageInfo.dwVolumeSerialNumber <> ValidatedStage.dwVolumeSerialNumber) or
        (StageInfo.nFileIndexHigh <> ValidatedStage.nFileIndexHigh) or
        (StageInfo.nFileIndexLow <> ValidatedStage.nFileIndexLow) or
        (StageInfo.nFileSizeHigh <> ValidatedStage.nFileSizeHigh) or
        (StageInfo.nFileSizeLow <> ValidatedStage.nFileSizeLow) or
        not CompareMem(@StageInfo.ftLastWriteTime, @ValidatedStage.ftLastWriteTime, SizeOf(TFileTime)) then
        raise EWriteError.Create('The staged file changed after validation.');
      if CreateGUID(Id) <> 0 then raise EInvalidOpException.Create('Could not create a recovery folder name.');
      RecoveryDir := TPath.Combine(TPath.GetDirectoryName(FullTarget), '.webstudio-recovery-' + GUIDToString(Id));
      if not CreateDirectory(PChar(RecoveryDir), nil) then RaiseLastOSError;
      RawDir := TPath.Combine(RecoveryDir, 'original');
      if not CreateDirectory(PChar(RawDir), nil) then RaiseLastOSError;
      RawPath := TPath.Combine(RawDir, TPath.GetFileName(FullTarget));
      RecoveryZipPath := TPath.Combine(RecoveryDir, 'previous-project.zip');
      SaveProjectRecoveryZip(FullTarget, RecoveryZipPath, MaximumSourceBytes);
      OriginalStream := THandleStream.Create(OriginalHandle);
      try
        OriginalStream.Position := 0;
        ZipInput := TFileStream.Create(RecoveryZipPath, fmOpenRead or fmShareDenyWrite);
        try
          Archive := TZipFile.Create;
          try
            Archive.Open(ZipInput, zmRead);
            if (Archive.FileCount <> 1) or (Archive.FileName[0] <> TPath.GetFileName(FullTarget)) then
              raise EWriteError.Create('Recovery ZIP has an unexpected entry.');
            Archive.Read(0, EntryStream, Header, True);
            try
              repeat
                Count := OriginalStream.Read(SourceBuffer, SizeOf(SourceBuffer));
                ReadCount := EntryStream.Read(EntryBuffer, Count);
                if (ReadCount <> Count) or ((Count > 0) and not CompareMem(@SourceBuffer[0], @EntryBuffer[0], Count)) then
                  raise EWriteError.Create('Recovery ZIP does not match the selected project.');
              until Count = 0;
              if EntryStream.Read(EntryBuffer, 1) <> 0 then raise EWriteError.Create('Recovery ZIP contains unexpected data.');
            finally EntryStream.Free end;
          finally Archive.Free end;
      CurrentHandle := CreateFile(PChar(FullTarget), GENERIC_READ, FILE_SHARE_READ or FILE_SHARE_DELETE,
        nil, OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, 0);
      if CurrentHandle = INVALID_HANDLE_VALUE then RaiseLastOSError;
      try
        if not GetFileInformationByHandle(CurrentHandle, CurrentInfo) then RaiseLastOSError;
        if (CurrentInfo.dwVolumeSerialNumber <> OriginalInfo.dwVolumeSerialNumber) or
          (CurrentInfo.nFileIndexHigh <> OriginalInfo.nFileIndexHigh) or
          (CurrentInfo.nFileIndexLow <> OriginalInfo.nFileIndexLow) then
          raise EWriteError.Create('The selected project changed before replacement.');
      finally CloseHandle(CurrentHandle) end;
      CurrentHandle := CreateFile(PChar(FullStage), GENERIC_READ, FILE_SHARE_READ or FILE_SHARE_DELETE,
        nil, OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, 0);
      if CurrentHandle = INVALID_HANDLE_VALUE then RaiseLastOSError;
      try
        if not GetFileInformationByHandle(CurrentHandle, CurrentInfo) then RaiseLastOSError;
        if (CurrentInfo.dwVolumeSerialNumber <> StageInfo.dwVolumeSerialNumber) or
          (CurrentInfo.nFileIndexHigh <> StageInfo.nFileIndexHigh) or
          (CurrentInfo.nFileIndexLow <> StageInfo.nFileIndexLow) or
          (CurrentInfo.nFileSizeHigh <> StageInfo.nFileSizeHigh) or
          (CurrentInfo.nFileSizeLow <> StageInfo.nFileSizeLow) or
          not CompareMem(@CurrentInfo.ftLastWriteTime, @StageInfo.ftLastWriteTime, SizeOf(TFileTime)) then
          raise EWriteError.Create('The staged file changed before replacement.');
      finally CloseHandle(CurrentHandle) end;
      if not ReplaceFile(PChar(FullTarget), PChar(FullStage), PChar(RawPath), 0, nil, nil) then RaiseLastOSError;
      Replaced := True;
          CurrentHandle := CreateFile(PChar(FullTarget), GENERIC_READ, FILE_SHARE_READ or FILE_SHARE_DELETE,
            nil, OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, 0);
          if CurrentHandle = INVALID_HANDLE_VALUE then RaiseLastOSError;
          try
            if not GetFileInformationByHandle(CurrentHandle, ResultInfo) then RaiseLastOSError;
            if (ResultInfo.dwVolumeSerialNumber <> StageInfo.dwVolumeSerialNumber) or
              (ResultInfo.nFileIndexHigh <> StageInfo.nFileIndexHigh) or
              (ResultInfo.nFileIndexLow <> StageInfo.nFileIndexLow) or
              (ResultInfo.nFileSizeHigh <> StageInfo.nFileSizeHigh) or
              (ResultInfo.nFileSizeLow <> StageInfo.nFileSizeLow) or
              not CompareMem(@ResultInfo.ftLastWriteTime, @StageInfo.ftLastWriteTime, SizeOf(TFileTime)) then
              raise EWriteError.Create('The staged file changed during replacement. The original was retained for inspection.');
          finally CloseHandle(CurrentHandle) end;
          RawHandle := CreateFile(PChar(RawPath), GENERIC_READ or _DELETE, FILE_SHARE_READ or FILE_SHARE_DELETE,
            nil, OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, 0);
          if RawHandle = INVALID_HANDLE_VALUE then RaiseLastOSError;
          try
            if not GetFileInformationByHandle(RawHandle, RawInfo) then RaiseLastOSError;
            if (RawInfo.dwVolumeSerialNumber <> OriginalInfo.dwVolumeSerialNumber) or
              (RawInfo.nFileIndexHigh <> OriginalInfo.nFileIndexHigh) or
              (RawInfo.nFileIndexLow <> OriginalInfo.nFileIndexLow) then
              raise EWriteError.Create('A different project was replaced. Its original was retained for inspection.');
            DeleteFlag := 1;
            if not SetFileInformationByHandle(RawHandle, FileDispositionInfo, @DeleteFlag, SizeOf(DeleteFlag)) then
              RetainedOriginalPath := RawPath;
          finally CloseHandle(RawHandle) end;
        finally ZipInput.Free end;
      finally OriginalStream.Free end;
    except
      on E: Exception do begin
        if Replaced then
          raise EInOutError.CreateFmt('Replacement completed but needs inspection. Recovery ZIP: %s; original path: %s. %s', [RecoveryZipPath, RawPath, E.Message])
        else
          raise EInOutError.CreateFmt('Replacement did not complete. Check the project, staged file and recovery folder %s. %s', [RecoveryDir, E.Message]);
      end;
    end;
  finally CloseHandle(OriginalHandle) end;
end;

procedure CommitStagedProjectFile(const StagedPath, TargetPath: string);
var
  FullStage, FullTarget: string;
  FileHandle: THandle;
begin
  if (Length(StagedPath) < 4) or not CharInSet(StagedPath[1], ['A'..'Z', 'a'..'z']) or
    (StagedPath[2] <> ':') or not CharInSet(StagedPath[3], ['\', '/']) or
    (Length(TargetPath) < 4) or not CharInSet(TargetPath[1], ['A'..'Z', 'a'..'z']) or
    (TargetPath[2] <> ':') or not CharInSet(TargetPath[3], ['\', '/']) then
    raise EArgumentException.Create('Select absolute drive paths for the project files.');
  FullStage := TPath.GetFullPath(StagedPath);
  FullTarget := TPath.GetFullPath(TargetPath);
  if SameText(FullStage, FullTarget) or
    not SameText(TPath.GetDirectoryName(FullStage), TPath.GetDirectoryName(FullTarget)) or
    (TPath.GetFileName(FullStage) = '') or (TPath.GetFileName(FullTarget) = '') then
    raise EArgumentException.Create('The staged file and new project must have different names in the same folder.');
  FileHandle := CreateFile(PChar(FullStage), GENERIC_WRITE, 0, nil, OPEN_EXISTING,
    FILE_ATTRIBUTE_NORMAL or FILE_FLAG_WRITE_THROUGH, 0);
  if FileHandle = INVALID_HANDLE_VALUE then RaiseLastOSError;
  try
    if not FlushFileBuffers(FileHandle) then RaiseLastOSError;
  finally
    CloseHandle(FileHandle);
  end;
  if not MoveFileEx(PChar(FullStage), PChar(FullTarget), MOVEFILE_WRITE_THROUGH) then RaiseLastOSError;
end;

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
  Source: TFileStream;
  StagedStream, EntryStream: TStream;
  Archive: TZipFile;
  Header: TZipHeader;
  SourceBuffer, EntryBuffer: array[0..65535] of Byte;
  Count, ReadCount: Integer;
  StageHandle: THandle;
  StagePath, FullRecovery: string;
  Id: TGUID;
  StageCreated: Boolean;
begin
  if not SameText(TPath.GetExtension(RecoveryZipPath), '.zip') then
    raise EArgumentException.Create('The recovery file must have a .zip extension.');
  if (Length(SourcePath) < 4) or not CharInSet(SourcePath[1], ['A'..'Z', 'a'..'z']) or
    (SourcePath[2] <> ':') or not CharInSet(SourcePath[3], ['\', '/']) or
    (Length(RecoveryZipPath) < 4) or not CharInSet(RecoveryZipPath[1], ['A'..'Z', 'a'..'z']) or
    (RecoveryZipPath[2] <> ':') or not CharInSet(RecoveryZipPath[3], ['\', '/']) then
    raise EArgumentException.Create('Select absolute drive paths for the project files.');
  FullRecovery := TPath.GetFullPath(RecoveryZipPath);
  Source := TFileStream.Create(TPath.GetFullPath(SourcePath), fmOpenRead or fmShareDenyWrite);
  try
    if (Source.Size < 0) or (UInt64(Source.Size) > MaximumSourceBytes) then
      raise EArgumentException.Create('Project file exceeds the allowed size.');
    if CreateGUID(Id) <> 0 then raise EInvalidOpException.Create('Could not create a temporary file name.');
    StagePath := TPath.Combine(TPath.GetDirectoryName(FullRecovery), '.webstudio-' + GUIDToString(Id) + '.tmp');
    StageHandle := CreateFile(PChar(StagePath), GENERIC_READ or GENERIC_WRITE, 0, nil, CREATE_NEW,
      FILE_ATTRIBUTE_NORMAL or FILE_FLAG_WRITE_THROUGH, 0);
    if StageHandle = INVALID_HANDLE_VALUE then RaiseLastOSError;
    StageCreated := True;
    try
      try
        StagedStream := THandleStream.Create(StageHandle);
        try
          Archive := TZipFile.Create;
          try
            Archive.Open(StagedStream, zmWrite);
            Archive.Add(Source, TPath.GetFileName(SourcePath));
            Archive.Close;
            StagedStream.Position := 0;
            Archive.Open(StagedStream, zmRead);
            if (Archive.FileCount <> 1) or (Archive.FileName[0] <> TPath.GetFileName(SourcePath)) then
              raise EWriteError.Create('Recovery ZIP has an unexpected entry. The project was not changed.');
            Source.Position := 0;
            Archive.Read(0, EntryStream, Header, True);
            try
              repeat
                Count := Source.Read(SourceBuffer, SizeOf(SourceBuffer));
                ReadCount := EntryStream.Read(EntryBuffer, Count);
                if (ReadCount <> Count) or ((Count > 0) and not CompareMem(@SourceBuffer[0], @EntryBuffer[0], Count)) then
                  raise EWriteError.Create('Recovery ZIP contents could not be verified. The project was not changed.');
              until Count = 0;
              if EntryStream.Read(EntryBuffer, 1) <> 0 then
                raise EWriteError.Create('Recovery ZIP contains unexpected data. The project was not changed.');
            finally EntryStream.Free end;
          finally Archive.Free end;
          if not FlushFileBuffers(StageHandle) then RaiseLastOSError;
        finally StagedStream.Free end;
      finally CloseHandle(StageHandle) end;
      CommitStagedProjectFile(StagePath, FullRecovery);
      StageCreated := False;
    finally
      if StageCreated then Winapi.Windows.DeleteFile(PChar(StagePath));
    end;
  finally Source.Free end;
end;

procedure RestoreProjectRecoveryZip(const RecoveryZipPath, NewTargetPath: string;
  MaximumArchiveBytes, MaximumProjectBytes: UInt64);
var
  ArchiveInput: TFileStream;
  EntryStream, StagedStream: TStream;
  Archive: TZipFile;
  Header, LocalHeader: TZipHeader;
  EntryName, FullTarget, StagePath: string;
  Remaining: UInt64;
  ChunkSize: Integer;
  EntryBuffer, StageBuffer: array[0..65535] of Byte;
  ExtraByte: Byte;
  StageHandle: THandle;
  StageCreated: Boolean;
  Id: TGUID;
begin
  if not SameText(TPath.GetExtension(RecoveryZipPath), '.zip') then
    raise EArgumentException.Create('The recovery file must have a .zip extension.');
  if (Length(RecoveryZipPath) < 4) or not CharInSet(RecoveryZipPath[1], ['A'..'Z', 'a'..'z']) or
    (RecoveryZipPath[2] <> ':') or not CharInSet(RecoveryZipPath[3], ['\', '/']) or
    (Length(NewTargetPath) < 4) or not CharInSet(NewTargetPath[1], ['A'..'Z', 'a'..'z']) or
    (NewTargetPath[2] <> ':') or not CharInSet(NewTargetPath[3], ['\', '/']) then
    raise EArgumentException.Create('Select absolute drive paths for the project files.');
  FullTarget := TPath.GetFullPath(NewTargetPath);
  ArchiveInput := TFileStream.Create(TPath.GetFullPath(RecoveryZipPath), fmOpenRead or fmShareDenyWrite);
  try
    if (ArchiveInput.Size < 0) or (UInt64(ArchiveInput.Size) > MaximumArchiveBytes) then
      raise EArgumentException.Create('Recovery ZIP exceeds the allowed size.');
    Archive := TZipFile.Create;
    try
      Archive.Open(ArchiveInput, zmRead);
      if Archive.FileCount <> 1 then raise EArgumentException.Create('Recovery ZIP must contain exactly one project file.');
      EntryName := Archive.FileName[0];
      if (EntryName = '') or (EntryName = '.') or (EntryName = '..') or
        (Pos('/', EntryName) > 0) or (Pos('\', EntryName) > 0) then
        raise EArgumentException.Create('Recovery ZIP contains an invalid filename.');
      Header := Archive.FileInfo[0];
      if Header.IsEncrypted or (Header.UncompressedSize64 > MaximumProjectBytes) then
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
        if CreateGUID(Id) <> 0 then raise EInvalidOpException.Create('Could not create a temporary file name.');
        StagePath := TPath.Combine(TPath.GetDirectoryName(FullTarget), '.webstudio-' + GUIDToString(Id) + '.tmp');
        StageHandle := CreateFile(PChar(StagePath), GENERIC_READ or GENERIC_WRITE, 0, nil, CREATE_NEW,
          FILE_ATTRIBUTE_NORMAL or FILE_FLAG_WRITE_THROUGH, 0);
        if StageHandle = INVALID_HANDLE_VALUE then RaiseLastOSError;
        StageCreated := True;
        try
          try
            StagedStream := THandleStream.Create(StageHandle);
            try
              Remaining := Header.UncompressedSize64;
              while Remaining > 0 do begin
                if Remaining > SizeOf(EntryBuffer) then ChunkSize := SizeOf(EntryBuffer)
                else ChunkSize := Integer(Remaining);
                EntryStream.ReadBuffer(EntryBuffer, ChunkSize);
                StagedStream.WriteBuffer(EntryBuffer, ChunkSize);
                Dec(Remaining, UInt64(ChunkSize));
              end;
              if EntryStream.Read(ExtraByte, 1) <> 0 then
                raise EArgumentException.Create('Recovery ZIP contains unexpected project data.');
              EntryStream.Free;
              EntryStream := nil;
              StagedStream.Position := 0;
              Archive.Read(0, EntryStream, LocalHeader, True);
              Remaining := Header.UncompressedSize64;
              while Remaining > 0 do begin
                if Remaining > SizeOf(EntryBuffer) then ChunkSize := SizeOf(EntryBuffer)
                else ChunkSize := Integer(Remaining);
                EntryStream.ReadBuffer(EntryBuffer, ChunkSize);
                StagedStream.ReadBuffer(StageBuffer, ChunkSize);
                if not CompareMem(@EntryBuffer[0], @StageBuffer[0], ChunkSize) then
                  raise EWriteError.Create('Recovered project could not be verified. The recovery ZIP was not changed.');
                Dec(Remaining, UInt64(ChunkSize));
              end;
              if (EntryStream.Read(ExtraByte, 1) <> 0) or (StagedStream.Read(ExtraByte, 1) <> 0) then
                raise EWriteError.Create('Recovered project contains unexpected data. The recovery ZIP was not changed.');
              if not FlushFileBuffers(StageHandle) then RaiseLastOSError;
            finally StagedStream.Free end;
          finally CloseHandle(StageHandle) end;
          CommitStagedProjectFile(StagePath, FullTarget);
          StageCreated := False;
        finally
          if StageCreated then Winapi.Windows.DeleteFile(PChar(StagePath));
        end;
      finally
        EntryStream.Free;
      end;
    finally
      Archive.Free;
    end;
  finally
    ArchiveInput.Free;
  end;
end;
end.
