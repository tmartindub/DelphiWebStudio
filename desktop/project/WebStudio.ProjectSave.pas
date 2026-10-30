unit WebStudio.ProjectSave;
{$B-}

interface

uses System.SysUtils;

{ Creates a new project file selected by a trusted native caller. This
  operation never replaces an existing path. The caller owns validation,
  user confirmation, session checks, and the in-memory project snapshot. }
procedure SaveNewProjectFile(const TargetPath: string; const Contents: TBytes);

implementation

uses Winapi.Windows, System.IOUtils, System.Classes;

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
end.
