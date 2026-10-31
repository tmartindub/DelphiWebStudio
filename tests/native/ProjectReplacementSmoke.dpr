program ProjectReplacementSmoke;
{$APPTYPE CONSOLE}
{$B-}
{ Uses only newly created synthetic files; never points at user projects. }
uses Winapi.Windows, System.SysUtils, System.Classes, System.IOUtils, System.Zip,
  WebStudio.ProjectSave in '..\..\desktop\project\WebStudio.ProjectSave.pas',
  WebStudio.ProjectOpen in '..\..\desktop\project\WebStudio.ProjectOpen.pas';
procedure CaptureVersion(const Path: string; out Info: TByHandleFileInformation);
var Handle: THandle;
begin
  Handle := CreateFile(PChar(Path), GENERIC_READ, FILE_SHARE_READ or FILE_SHARE_DELETE, nil, OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, 0);
  if Handle = INVALID_HANDLE_VALUE then RaiseLastOSError;
  try if not GetFileInformationByHandle(Handle, Info) then RaiseLastOSError finally CloseHandle(Handle) end;
end;
var Id: TGUID; Folder, Target, Stage, Recovery, Retained, Missing, FirstRecovery, Restored, HardTarget, HardStage: string;
  Original, NewData, Actual: TBytes; Locked: TFileStream; Rejected: Boolean; Archive: TZipFile;
  Expected, ExpectedStage, Stale: TByHandleFileInformation;
begin
  if CreateGUID(Id) <> 0 then raise Exception.Create('Could not make test ID.');
  Folder := TPath.Combine(TPath.Combine(GetCurrentDir, 'test-results'), 'replace-project-' + GUIDToString(Id));
  if TDirectory.Exists(Folder) then raise Exception.Create('Test folder already exists.');
  TDirectory.CreateDirectory(Folder);
  Target := TPath.Combine(Folder, 'project.webstudio.json');
  Stage := TPath.Combine(Folder, 'stage.tmp');
  Missing := TPath.Combine(Folder, 'missing.webstudio.json');
  Original := TEncoding.UTF8.GetBytes('last good project');
  NewData := TEncoding.UTF8.GetBytes('new project data');
  SaveNewProjectFile(Target, Original); SaveNewProjectFile(Stage, NewData);
  CaptureVersion(Target, Expected);
  CaptureVersion(Stage, ExpectedStage);
  Rejected := False;
  try ReplaceStagedProjectFile(Stage, Missing, 1024, Expected, ExpectedStage, Recovery, Retained) except on E: Exception do Rejected := True end;
  if not Rejected or not TFile.Exists(Stage) or TFile.Exists(Missing) then raise Exception.Create('Missing target was accepted.');
  Rejected := False;
  try ReplaceStagedProjectFile(Target, Target, 1024, Expected, ExpectedStage, Recovery, Retained) except on E: EArgumentException do Rejected := True end;
  if not Rejected or not TFile.Exists(Target) then raise Exception.Create('Identical stage and target were accepted.');
  Locked := TFileStream.Create(Target, fmOpenWrite or fmShareExclusive);
  try
    Rejected := False;
    try ReplaceStagedProjectFile(Stage, Target, 1024, Expected, ExpectedStage, Recovery, Retained) except on E: Exception do Rejected := True end;
    if not Rejected or not TFile.Exists(Stage) then raise Exception.Create('Locked target was replaced.');
  finally Locked.Free end;
  Locked := TFileStream.Create(Stage, fmOpenRead or fmShareExclusive);
  try
    Rejected := False;
    try ReplaceStagedProjectFile(Stage, Target, 1024, Expected, ExpectedStage, Recovery, Retained) except on E: Exception do Rejected := True end;
    if not Rejected or (TFile.ReadAllText(Target) <> 'last good project') then raise Exception.Create('Locked stage replaced the project.');
  finally Locked.Free end;
  Rejected := False;
  try ReplaceStagedProjectFile(Stage, Target, 1, Expected, ExpectedStage, Recovery, Retained) except on E: Exception do Rejected := True end;
  if not Rejected or not TFile.Exists(Stage) or (TFile.ReadAllText(Target) <> 'last good project') then raise Exception.Create('Oversized original was replaced.');
  Stale := Expected; Inc(Stale.nFileSizeLow);
  Rejected := False;
  try ReplaceStagedProjectFile(Stage, Target, 1024, Stale, ExpectedStage, Recovery, Retained) except on E: Exception do Rejected := True end;
  if not Rejected or not TFile.Exists(Stage) or (TFile.ReadAllText(Target) <> 'last good project') then raise Exception.Create('Changed original was replaced.');
  Stale := ExpectedStage; Inc(Stale.nFileSizeLow);
  Rejected := False;
  try ReplaceStagedProjectFile(Stage, Target, 1024, Expected, Stale, Recovery, Retained) except on E: Exception do Rejected := True end;
  if not Rejected or not TFile.Exists(Stage) or (TFile.ReadAllText(Target) <> 'last good project') then raise Exception.Create('Changed stage was accepted.');
  ReplaceStagedProjectFile(Stage, Target, 1024, Expected, ExpectedStage, Recovery, Retained);
  if TFile.Exists(Stage) or (TFile.ReadAllText(Target) <> 'new project data') then raise Exception.Create('Replacement did not reach the target.');
  if not TFile.Exists(Recovery) then raise Exception.Create('Recovery ZIP was not retained.');
  Archive := TZipFile.Create;
  try
    Archive.Open(Recovery, zmRead);
    if Archive.FileCount <> 1 then raise Exception.Create('Recovery ZIP has unexpected entries.');
    Archive.Read('project.webstudio.json', Actual);
  finally Archive.Free end;
  if (Length(Actual) <> Length(Original)) or not CompareMem(@Actual[0], @Original[0], Length(Original)) then raise Exception.Create('Recovery ZIP does not contain the original project.');
  if (Retained <> '') and (not TFile.Exists(Retained) or (TFile.ReadAllText(Retained) <> 'last good project')) then raise Exception.Create('Retained original is invalid.');
  FirstRecovery := Recovery;
  Restored := TPath.Combine(Folder, 'restored.webstudio.json');
  RestoreProjectRecoveryZip(FirstRecovery, Restored, TFile.GetSize(FirstRecovery), 1024);
  if TFile.ReadAllText(Restored) <> 'last good project' then raise Exception.Create('The original project could not be restored.');
  SaveNewProjectFile(Stage, TEncoding.UTF8.GetBytes('third project data'));
  CaptureVersion(Stage, ExpectedStage);
  CaptureVersion(Target, Expected);
  ReplaceStagedProjectFile(Stage, Target, 1024, Expected, ExpectedStage, Recovery, Retained);
  if SameText(FirstRecovery, Recovery) or not TFile.Exists(FirstRecovery) or (TFile.ReadAllText(Target) <> 'third project data') then raise Exception.Create('Repeated replacement did not retain separate recovery ZIPs.');
  Archive := TZipFile.Create;
  try Archive.Open(Recovery, zmRead); Archive.Read('project.webstudio.json', Actual) finally Archive.Free end;
  if TEncoding.UTF8.GetString(Actual) <> 'new project data' then raise Exception.Create('Second recovery ZIP did not preserve the previous project.');
  Archive := TZipFile.Create;
  try Archive.Open(FirstRecovery, zmRead); Archive.Read('project.webstudio.json', Actual) finally Archive.Free end;
  if TEncoding.UTF8.GetString(Actual) <> 'last good project' then raise Exception.Create('First recovery ZIP changed after replacement.');
  Target := TPath.Combine(Folder, 'caf' + #$00E9 + '-' + #$4F1A + '.webstudio.json');
  SaveNewProjectFile(Target, TEncoding.UTF8.GetBytes('unicode original'));
  SaveNewProjectFile(Stage, TEncoding.UTF8.GetBytes('unicode replacement'));
  CaptureVersion(Stage, ExpectedStage);
  CaptureVersion(Target, Expected);
  ReplaceStagedProjectFile(Stage, Target, 1024, Expected, ExpectedStage, Recovery, Retained);
  Archive := TZipFile.Create;
  try Archive.Open(Recovery, zmRead); Archive.Read(ExtractFileName(Target), Actual) finally Archive.Free end;
  if (TEncoding.UTF8.GetString(Actual) <> 'unicode original') or (TFile.ReadAllText(Target) <> 'unicode replacement') then raise Exception.Create('Unicode replacement did not preserve the original.');
  HardTarget := TPath.Combine(Folder, 'hardlink-target.webstudio.json');
  HardStage := TPath.Combine(Folder, 'hardlink-stage.tmp');
  SaveNewProjectFile(HardTarget, TEncoding.UTF8.GetBytes('hardlink original'));
  if not CreateHardLink(PChar(HardStage), PChar(HardTarget), nil) then RaiseLastOSError;
  CaptureVersion(HardTarget, Expected);
  CaptureVersion(HardStage, ExpectedStage);
  Rejected := False;
  try ReplaceStagedProjectFile(HardStage, HardTarget, 1024, Expected, ExpectedStage, Recovery, Retained) except on E: Exception do Rejected := True end;
  if not Rejected or not TFile.Exists(HardStage) or (TFile.ReadAllText(HardTarget) <> 'hardlink original') then raise Exception.Create('A stage hardlinked to the target was accepted.');
  Writeln('Guarded replacements retained separate verified ZIPs and rejected missing, locked and oversized files.');
end.
