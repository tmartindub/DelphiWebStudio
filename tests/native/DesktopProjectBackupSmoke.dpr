program DesktopProjectBackupSmoke;
{$APPTYPE CONSOLE}
{$B-}
{ Run only in a fresh isolated folder and profile. The test writes test files
  under its executable directory and uses legacy test-dialog hooks. }
uses
  Winapi.Windows, Winapi.Messages, Winapi.CommDlg, Winapi.Dlgs,
  System.SysUtils, System.IOUtils, System.Zip, Vcl.Forms, Vcl.Dialogs,
  WebStudio.Main in 'WebStudio.Main.pas' {MainForm};

type
  TDialogDriver = class
    SourceName, DestinationName: string;
    CancelSave: Boolean;
    procedure OpenShown(Sender: TObject);
    procedure SaveShown(Sender: TObject);
  end;

procedure TDialogDriver.OpenShown(Sender: TObject);
var Window: HWND;
begin
  Window := GetParent(TOpenDialog(Sender).Handle);
  SendMessage(Window, CDM_SETCONTROLTEXT, edt1, LPARAM(PChar(SourceName)));
  PostMessage(Window, WM_COMMAND, IDOK, 0);
end;

procedure TDialogDriver.SaveShown(Sender: TObject);
var Window: HWND;
begin
  Window := GetParent(TSaveDialog(Sender).Handle);
  if CancelSave then PostMessage(Window, WM_COMMAND, IDCANCEL, 0)
  else begin
    SendMessage(Window, CDM_SETCONTROLTEXT, edt1, LPARAM(PChar(DestinationName)));
    PostMessage(Window, WM_COMMAND, IDOK, 0);
  end;
end;

var
  Folder, Source, Backup, Restored: string;
  FixtureBytes, Actual, Archived: TBytes;
  Driver: TDialogDriver;
  Archive: TZipFile;
begin
  Folder := ExtractFilePath(ParamStr(0));
  Source := TPath.Combine(Folder, 'test-project.webstudio.json');
  Backup := TPath.Combine(Folder, 'test-backup.zip');
  Restored := TPath.Combine(Folder, 'restored.webstudio.json');
  if TFile.Exists(Source) or TFile.Exists(Backup) or TFile.Exists(Restored) then raise Exception.Create('Test files already exist.');
  FixtureBytes := TFile.ReadAllBytes(TPath.Combine(GetCurrentDir, 'samples\five-page.webstudio.json'));
  TFile.WriteAllBytes(Source, FixtureBytes);
  Application.Initialize;
  Application.ShowMainForm := False;
  Application.CreateForm(TMainForm, MainForm);
  Driver := TDialogDriver.Create;
  try
    Driver.SourceName := ExtractFileName(Source);
    Driver.DestinationName := ExtractFileName(Backup);
    MainForm.BackupSourceDialog.InitialDir := Folder;
    MainForm.BackupSourceDialog.OnShow := Driver.OpenShown;
    MainForm.BackupSaveDialog.OnShow := Driver.SaveShown;
    MainForm.BackupOpenDialog.InitialDir := Folder;
    MainForm.BackupOpenDialog.OnShow := Driver.OpenShown;
    MainForm.BackupRestoreDialog.OnShow := Driver.SaveShown;
    Driver.CancelSave := True;
    MainForm.BackupProjectItemClick(nil);
    if TFile.Exists(Backup) then raise Exception.Create('Cancelled backup created a file.');
    Driver.CancelSave := False;
    Driver.DestinationName := 'existing-backup.zip';
    TFile.WriteAllText(TPath.Combine(Folder, Driver.DestinationName), 'existing backup');
    MainForm.BackupProjectItemClick(nil);
    if TFile.ReadAllText(TPath.Combine(Folder, Driver.DestinationName)) <> 'existing backup' then raise Exception.Create('Existing backup was replaced.');
    Driver.DestinationName := ExtractFileName(Backup);
    MainForm.BackupProjectItemClick(nil);
    if Pos('Project backup created:', MainForm.StatusLabel.Caption) <> 1 then raise Exception.Create('Backup was not reported.');
    Archive := TZipFile.Create;
    try
      Archive.Open(Backup, zmRead);
      if (Archive.FileCount <> 1) or (Archive.FileName[0] <> ExtractFileName(Source)) then raise Exception.Create('Backup entry differs.');
      Archive.Read(0, Archived);
    finally Archive.Free end;
    if (Length(Archived) <> Length(FixtureBytes)) or ((Length(Archived) > 0) and not CompareMem(@Archived[0], @FixtureBytes[0], Length(Archived))) then raise Exception.Create('Backup bytes differ.');
    Driver.SourceName := ExtractFileName(Backup);
    Driver.DestinationName := ExtractFileName(Restored);
    Driver.CancelSave := True;
    MainForm.RestoreBackupItemClick(nil);
    if TFile.Exists(Restored) then raise Exception.Create('Cancelled restore created a file.');
    Driver.CancelSave := False;
    Driver.DestinationName := 'wrong-extension.zip';
    MainForm.RestoreBackupItemClick(nil);
    if TFile.Exists(TPath.Combine(Folder, Driver.DestinationName)) then raise Exception.Create('Wrong restore extension was accepted.');
    Driver.DestinationName := 'existing-project.json';
    TFile.WriteAllText(TPath.Combine(Folder, Driver.DestinationName), 'existing project');
    MainForm.RestoreBackupItemClick(nil);
    if TFile.ReadAllText(TPath.Combine(Folder, Driver.DestinationName)) <> 'existing project' then raise Exception.Create('Existing project was replaced.');
    Driver.DestinationName := ExtractFileName(Restored);
    MainForm.RestoreBackupItemClick(nil);
    if Pos('Backup restored; open to verify:', MainForm.StatusLabel.Caption) <> 1 then raise Exception.Create('Restore verification notice was not shown.');
    Actual := TFile.ReadAllBytes(Restored);
    if (Length(Actual) <> Length(FixtureBytes)) or ((Length(Actual) > 0) and not CompareMem(@Actual[0], @FixtureBytes[0], Length(Actual))) then raise Exception.Create('Restored project differs.');
    Actual := TFile.ReadAllBytes(Source);
    if (Length(Actual) <> Length(FixtureBytes)) or ((Length(Actual) > 0) and not CompareMem(@Actual[0], @FixtureBytes[0], Length(Actual))) then raise Exception.Create('Source project changed.');
    Driver.SourceName := 'invalid-backup.zip';
    TFile.WriteAllText(TPath.Combine(Folder, Driver.SourceName), 'not a ZIP');
    Driver.DestinationName := 'invalid-restored.json';
    MainForm.RestoreBackupItemClick(nil);
    if (Pos('Restore failed:', MainForm.StatusLabel.Caption) <> 1) or TFile.Exists(TPath.Combine(Folder, Driver.DestinationName)) then raise Exception.Create('Invalid backup was accepted.');
    Driver.SourceName := 'test-project.webstudio.zip';
    Archive := TZipFile.Create;
    try
      Archive.Open(TPath.Combine(Folder, Driver.SourceName), zmWrite);
      Archive.Add(FixtureBytes, 'project.webstudio.json');
      Archive.Close;
    finally Archive.Free end;
    FixtureBytes := TFile.ReadAllBytes(TPath.Combine(Folder, Driver.SourceName));
    Driver.DestinationName := 'zip-project-backup.zip';
    MainForm.BackupProjectItemClick(nil);
    if Pos('Project backup created:', MainForm.StatusLabel.Caption) <> 1 then raise Exception.Create('ZIP project backup failed.');
    Driver.SourceName := Driver.DestinationName;
    Driver.DestinationName := 'restored-project.webstudio.zip';
    MainForm.RestoreBackupItemClick(nil);
    Actual := TFile.ReadAllBytes(TPath.Combine(Folder, Driver.DestinationName));
    if (Length(Actual) <> Length(FixtureBytes)) or ((Length(Actual) > 0) and not CompareMem(@Actual[0], @FixtureBytes[0], Length(Actual))) then raise Exception.Create('Restored ZIP project differs.');
    Writeln('Project ZIP backup and restore passed cancellation, collision, extension and byte checks.');
  finally Driver.Free; MainForm.Free end;
end.
