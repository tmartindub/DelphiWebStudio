program DesktopRecoverySmoke;
{$APPTYPE CONSOLE}
uses
  Winapi.Windows, Winapi.Messages, Winapi.CommDlg, Winapi.Dlgs,
  System.SysUtils, System.IOUtils, System.Zip, Vcl.Forms, Vcl.Dialogs,
  WebStudio.Main in 'WebStudio.Main.pas' {MainForm};

type
  TDialogDriver = class
    SourceName: string;
    DestinationName: string;
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
  Folder, Source, Destination: string;
  Driver: TDialogDriver;
  Archive: TZipFile;
  BeforeBytes, AfterBytes, FixtureBytes: TBytes;
begin
  Folder := ExtractFilePath(ParamStr(0));
  Source := TPath.Combine(Folder, '.webstudio-download-test.tmp');
  Destination := TPath.Combine(Folder, 'recovered.webstudio.json');
  if TFile.Exists(Source) or TFile.Exists(Destination) then raise Exception.Create('Test files already exist.');
  Application.Initialize;
  Application.ShowMainForm := False;
  Application.CreateForm(TMainForm, MainForm);
  Driver := TDialogDriver.Create;
  try
    Driver.SourceName := ExtractFileName(Source);
    Driver.DestinationName := ExtractFileName(Destination);
    MainForm.RecoveryOpenDialog.InitialDir := Folder;
    MainForm.RecoveryOpenDialog.OnShow := Driver.OpenShown;
    MainForm.RecoverySaveDialog.OnShow := Driver.SaveShown;
    FixtureBytes := TFile.ReadAllBytes(TPath.Combine(GetCurrentDir, 'samples\five-page.webstudio.json'));
    TFile.WriteAllBytes(Source, FixtureBytes);
    Driver.CancelSave := True;
    MainForm.RecoverStageButtonClick(nil);
    if not TFile.Exists(Source) or TFile.Exists(Destination) then raise Exception.Create('Cancelled recovery changed files.');
    Driver.CancelSave := False;
    Driver.DestinationName := 'wrong.zip';
    MainForm.RecoverStageButtonClick(nil);
    if not TFile.Exists(Source) or TFile.Exists(TPath.Combine(Folder, 'wrong.zip')) then raise Exception.Create('Recovery accepted a wrong extension.');
    Driver.DestinationName := ExtractFileName(Destination);
    TFile.WriteAllText(Destination, 'existing');
    MainForm.RecoverStageButtonClick(nil);
    if not TFile.Exists(Source) or (TFile.ReadAllText(Destination) <> 'existing') then raise Exception.Create('Recovery replaced an existing destination.');
    TFile.Delete(Destination);
    MainForm.RecoverStageButtonClick(nil);
    AfterBytes := TFile.ReadAllBytes(Destination);
    if TFile.Exists(Source) or (Length(FixtureBytes) <> Length(AfterBytes)) or not CompareMem(@FixtureBytes[0], @AfterBytes[0], Length(FixtureBytes)) then raise Exception.Create('Recovery did not preserve project bytes.');
    if Pos('Recovered file may be incomplete.', MainForm.StatusLabel.Caption) <> 1 then raise Exception.Create('Recovery verification notice was not shown.');
    Archive := TZipFile.Create;
    try
      Archive.Open(Source, zmWrite);
      Archive.Add(FixtureBytes, 'project.webstudio.json');
      Archive.Close;
    finally Archive.Free end;
    BeforeBytes := TFile.ReadAllBytes(Source);
    Driver.DestinationName := 'recovered.webstudio.zip';
    MainForm.RecoverStageButtonClick(nil);
    AfterBytes := TFile.ReadAllBytes(TPath.Combine(Folder, Driver.DestinationName));
    if TFile.Exists(Source) or (Length(BeforeBytes) <> Length(AfterBytes)) or not CompareMem(@BeforeBytes[0], @AfterBytes[0], Length(BeforeBytes)) then raise Exception.Create('ZIP recovery did not preserve project bytes.');
    TFile.WriteAllBytes(Source, TEncoding.UTF8.GetBytes('not a project'));
    Driver.DestinationName := 'unrecognized.json';
    MainForm.RecoverStageButtonClick(nil);
    if not TFile.Exists(Source) or TFile.Exists(TPath.Combine(Folder, Driver.DestinationName)) then raise Exception.Create('Unrecognized stage was moved.');
    Writeln('Staged recovery cancel, extension, collision and successful recovery passed.');
  finally
    Driver.Free;
    MainForm.Free;
  end;
end.
