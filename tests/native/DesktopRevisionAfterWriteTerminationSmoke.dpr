program DesktopRevisionAfterWriteTerminationSmoke;
{$APPTYPE CONSOLE}
{$B-}
{ Run after DesktopRevisionWriteTerminationSmoke with the same isolated profile. }
uses Winapi.Windows, Winapi.Messages, Winapi.CommDlg, Winapi.Dlgs,
  System.SysUtils, System.Classes, System.IOUtils, System.JSON, System.Zip,
  Vcl.Forms, Vcl.Edge, Vcl.Dialogs, WebStudio.Main in 'WebStudio.Main.pas';
type TDialogDriver = class
  procedure SaveShown(Sender: TObject);
end;
procedure TDialogDriver.SaveShown(Sender: TObject);
var Window: HWND; Name: string;
begin
  Name := 'after-interrupted-revision.webstudio.zip';
  if TFile.Exists(TPath.Combine(ExtractFilePath(ParamStr(0)), Name)) then raise Exception.Create('Test output already exists.');
  Window := GetParent(TSaveDialog(Sender).Handle);
  SendMessage(Window, CDM_SETCONTROLTEXT, edt1, LPARAM(PChar(Name)));
  PostMessage(Window, WM_COMMAND, IDOK, 0);
end;
var Folder, Value, AssetPath: string; Deadline: UInt64; Driver: TDialogDriver;
  Archive: TZipFile; Manifest, Asset: TJSONValue; Assets: TJSONArray; Actual, Expected: TBytes;
begin
  Folder := ExtractFilePath(ParamStr(0));
  if not TFile.Exists(TPath.Combine(Folder, 'revision-write-active.txt')) or
    not TFile.Exists(TPath.Combine(Folder, 'editor\proof.pdf')) then raise Exception.Create('The isolated termination test must run first.');
  Application.Initialize; Application.ShowMainForm := False; Application.CreateForm(TMainForm, MainForm);
  Driver := TDialogDriver.Create;
  try
    Deadline := GetTickCount64 + 30000;
    while (MainForm.StatusLabel.Caption <> 'Local editor loaded.') and (GetTickCount64 < Deadline) do begin CheckSynchronize(0); Application.ProcessMessages; Sleep(20) end;
    if MainForm.StatusLabel.Caption <> 'Local editor loaded.' then raise Exception.Create('Test editor did not restart.');
    if Winapi.Windows.Failed(MainForm.EditorBrowser.ControllerInterface.Set_IsVisible(1)) then raise Exception.Create('Could not activate test WebView.');
    Deadline := GetTickCount64 + 15000;
    repeat CheckSynchronize(0); Application.ProcessMessages; Sleep(50);
      Value := MainForm.EditorBrowser.ExecuteScript('!!Array.from(document.querySelectorAll("summary")).find(e=>e.textContent.trim()==="All local revisions")', '');
    until (Value = 'true') or (GetTickCount64 >= Deadline);
    if Value <> 'true' then raise Exception.Create('Revision recovery list was not found.');
    MainForm.EditorBrowser.ExecuteScript('Array.from(document.querySelectorAll("summary")).find(e=>e.textContent.trim()==="All local revisions").click()');
    Deadline := GetTickCount64 + 15000;
    repeat CheckSynchronize(0); Application.ProcessMessages; Sleep(50);
      Value := MainForm.EditorBrowser.ExecuteScript('Array.from(document.querySelectorAll("button")).filter(e=>e.textContent.trim()==="Save revision as file").length', '');
    until (Value = '1') or (GetTickCount64 >= Deadline);
    if Value <> '1' then raise Exception.Create('Expected only the last-good revision after termination; found ' + Value);
    MainForm.ProjectSaveDialog.InitialDir := Folder; MainForm.ProjectSaveDialog.OnShow := Driver.SaveShown;
    MainForm.EditorBrowser.ExecuteScript('Array.from(document.querySelectorAll("button")).find(e=>e.textContent.trim()==="Save revision as file").click()');
    Deadline := GetTickCount64 + 30000;
    while (MainForm.StatusLabel.Caption <> 'Download completed: after-interrupted-revision.webstudio.zip') and (GetTickCount64 < Deadline) do begin CheckSynchronize(0); Application.ProcessMessages; Sleep(50) end;
    if MainForm.StatusLabel.Caption <> 'Download completed: after-interrupted-revision.webstudio.zip' then raise Exception.Create('Last-good revision did not save: ' + MainForm.StatusLabel.Caption);
    Expected := TFile.ReadAllBytes(TPath.Combine(Folder, 'editor\proof.pdf'));
    Archive := TZipFile.Create;
    try
      Archive.Open(TPath.Combine(Folder, 'after-interrupted-revision.webstudio.zip'), zmRead);
      Archive.Read('project.webstudio.json', Actual);
      Manifest := TJSONObject.ParseJSONValue(TEncoding.UTF8.GetString(Actual));
      try
        if not (Manifest is TJSONObject) or (Manifest.GetValue<TJSONObject>('config').GetValue<TJSONArray>('pages').Count <> 5) then raise Exception.Create('Recovered page count differs.');
        Assets := Manifest.GetValue<TJSONArray>('assets'); AssetPath := '';
        for Asset in Assets do if Asset.GetValue<string>('name') = 'Community_Bulletin_Sample.pdf' then AssetPath := Asset.GetValue<string>('path');
        if AssetPath = '' then raise Exception.Create('Recovered PDF is missing.');
      finally Manifest.Free end;
      Archive.Read(AssetPath, Actual);
      if (Length(Actual) <> Length(Expected)) or ((Length(Expected) > 0) and not CompareMem(@Actual[0], @Expected[0], Length(Expected))) then raise Exception.Create('Recovered PDF differs.');
    finally Archive.Free end;
    Writeln('After termination during a revision write, the last-good five-page revision and PDF were recovered.');
  finally Driver.Free; MainForm.Free end;
end.
