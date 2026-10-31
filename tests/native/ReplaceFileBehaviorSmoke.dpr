program ReplaceFileBehaviorSmoke;
{$APPTYPE CONSOLE}
{$B-}
{ Uses only uniquely created synthetic files. This probes Windows behavior;
  it is not an implementation of project replacement. }
uses Winapi.Windows, System.SysUtils, System.IOUtils;
var Root, Dir, Target, Stage, Backup, Alternate: string; Id: TGUID; Handle: THandle; I: Integer;
begin
  if CreateGUID(Id) <> 0 then raise Exception.Create('Could not make test ID.');
  Root := TPath.Combine(TPath.Combine(GetCurrentDir, 'test-results'), 'replace-behavior-' + GUIDToString(Id));
  if TDirectory.Exists(Root) then raise Exception.Create('Test folder already exists.');
  TDirectory.CreateDirectory(Root);
  for I := 1 to 2 do begin
    Dir := TPath.Combine(Root, IntToStr(I));
    TDirectory.CreateDirectory(Dir);
    Target := TPath.Combine(Dir, 'original.json');
    Stage := TPath.Combine(Dir, 'stage.tmp');
    Backup := TPath.Combine(Dir, 'backup.json');
    TFile.WriteAllText(Target, 'original');
    TFile.WriteAllText(Stage, 'replacement');
    Handle := INVALID_HANDLE_VALUE;
    if I = 1 then TFile.WriteAllText(Backup, 'existing backup')
    else begin
      Handle := CreateFile(PChar(Target), GENERIC_READ, FILE_SHARE_READ or FILE_SHARE_DELETE,
        nil, OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, 0);
      if Handle = INVALID_HANDLE_VALUE then RaiseLastOSError;
      Alternate := TPath.Combine(Dir, 'renamed.json');
      if not MoveFileEx(PChar(Target), PChar(Alternate), 0) then RaiseLastOSError;
      if not MoveFileEx(PChar(Alternate), PChar(Target), 0) then RaiseLastOSError;
    end;
    try
      if not ReplaceFile(PChar(Target), PChar(Stage), PChar(Backup), 0, nil, nil) then RaiseLastOSError;
      if TFile.Exists(Stage) or (TFile.ReadAllText(Target) <> 'replacement') or
        (TFile.ReadAllText(Backup) <> 'original') then
        raise Exception.Create('Replacement did not produce the expected synthetic files.');
    finally if Handle <> INVALID_HANDLE_VALUE then CloseHandle(Handle) end;
  end;
  Writeln('ReplaceFile replaced an existing backup; a read handle denying write sharing allowed rename and replacement.');
end.
