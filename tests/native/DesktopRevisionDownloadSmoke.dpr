program DesktopRevisionDownloadSmoke;
{$APPTYPE CONSOLE}
{$B-}
{ Run in a fresh isolated folder and profile with editor\fixture.zip and
  editor\proof.pdf containing the five-page project and its original PDF. }
uses
  Winapi.Windows, Winapi.Messages, Winapi.CommDlg, Winapi.Dlgs,
  System.Classes, System.SysUtils, System.IOUtils, System.JSON, System.Zip,
  Vcl.Forms, Vcl.Edge, Vcl.Dialogs, WebStudio.Main in 'WebStudio.Main.pas';

type TDialogDriver = class
  procedure SaveShown(Sender: TObject);
end;

procedure TDialogDriver.SaveShown(Sender: TObject);
var Window: HWND; Name: string;
begin
  Name := 'recovered-revision.webstudio.zip';
  if TFile.Exists(TPath.Combine(ExtractFilePath(ParamStr(0)), Name)) then
    raise Exception.Create('Test output already exists.');
  Window := GetParent(TSaveDialog(Sender).Handle);
  SendMessage(Window, CDM_SETCONTROLTEXT, edt1, LPARAM(PChar(Name)));
  PostMessage(Window, WM_COMMAND, IDOK, 0);
end;

var
  Folder, Value, AssetPath: string;
  Deadline: UInt64;
  Driver: TDialogDriver;
  Archive: TZipFile;
  Manifest, Asset: TJSONValue;
  Assets: TJSONArray;
  Actual, Expected: TBytes;
begin
  Folder := ExtractFilePath(ParamStr(0));
  if not TFile.Exists(TPath.Combine(Folder, 'editor\fixture.zip')) or
    not TFile.Exists(TPath.Combine(Folder, 'editor\proof.pdf')) or
    TFile.Exists(TPath.Combine(Folder, 'recovered-revision.webstudio.zip')) then
    raise Exception.Create('A fresh test folder and fixtures are required.');
  Application.Initialize;
  Application.ShowMainForm := False;
  Application.CreateForm(TMainForm, MainForm);
  Driver := TDialogDriver.Create;
  try
    Deadline := GetTickCount64 + 30000;
    while (MainForm.StatusLabel.Caption <> 'Local editor loaded.') and (GetTickCount64 < Deadline) do begin CheckSynchronize(0); Application.ProcessMessages; Sleep(20) end;
    if MainForm.StatusLabel.Caption <> 'Local editor loaded.' then raise Exception.Create('Test editor did not load.');
    if Winapi.Windows.Failed(MainForm.EditorBrowser.ControllerInterface.Set_IsVisible(1)) then raise Exception.Create('Could not activate WebView.');
    MainForm.ProjectSaveDialog.InitialDir := Folder;
    MainForm.ProjectSaveDialog.OnShow := Driver.SaveShown;
    MainForm.EditorBrowser.ExecuteScript('fetch("/fixture.zip").then(r=>r.blob()).then(b=>{const i=document.querySelector("input[aria-label=\"Choose project file\"]"),d=new DataTransfer();d.items.add(new File([b],"fixture.zip",{type:"application/zip"}));i.files=d.files;i.dispatchEvent(new Event("change",{bubbles:true}));})');
    Deadline := GetTickCount64 + 30000;
    repeat
      CheckSynchronize(0); Application.ProcessMessages; Sleep(50);
      Value := MainForm.EditorBrowser.ExecuteScript('!!Array.from(document.querySelectorAll("button")).find(b=>b.textContent.trim()==="News") && !!localStorage.getItem("openpage-projects")?.includes("Tested announcement.")', '');
    until (Value = 'true') or (GetTickCount64 >= Deadline);
    if Value <> 'true' then raise Exception.Create('Five-page fixture did not open.');
    MainForm.EditorBrowser.ExecuteScript('Array.from(document.querySelectorAll("summary")).find(e=>e.textContent.trim()==="Local revisions").click()');
    MainForm.EditorBrowser.ExecuteScript('Array.from(document.querySelectorAll("button")).find(e=>e.textContent.trim()==="Create local revision").click()');
    Deadline := GetTickCount64 + 30000;
    repeat
      CheckSynchronize(0); Application.ProcessMessages; Sleep(50);
      Value := MainForm.EditorBrowser.ExecuteScript('!!Array.from(document.querySelectorAll("button")).find(e=>e.textContent.trim()==="Save revision as file" && !e.disabled)', '');
    until (Value = 'true') or (GetTickCount64 >= Deadline);
    if Value <> 'true' then raise Exception.Create('Revision was not created.');
    MainForm.EditorBrowser.ExecuteScript('Array.from(document.querySelectorAll("button")).find(e=>e.textContent.trim()==="Save revision as file").click()');
    Deadline := GetTickCount64 + 30000;
    while (MainForm.StatusLabel.Caption <> 'Download completed: recovered-revision.webstudio.zip') and (GetTickCount64 < Deadline) do begin CheckSynchronize(0); Application.ProcessMessages; Sleep(50) end;
    if MainForm.StatusLabel.Caption <> 'Download completed: recovered-revision.webstudio.zip' then raise Exception.Create('Revision download failed: ' + MainForm.StatusLabel.Caption);
    Expected := TFile.ReadAllBytes(TPath.Combine(Folder, 'editor\proof.pdf'));
    Archive := TZipFile.Create;
    try
      Archive.Open(TPath.Combine(Folder, 'recovered-revision.webstudio.zip'), zmRead);
      Archive.Read('project.webstudio.json', Actual);
      Manifest := TJSONObject.ParseJSONValue(TEncoding.UTF8.GetString(Actual));
      try
        if not (Manifest is TJSONObject) or (Manifest.GetValue<TJSONObject>('config').GetValue<TJSONArray>('pages').Count <> 5) then raise Exception.Create('Recovered page count differs.');
        Assets := Manifest.GetValue<TJSONArray>('assets');
        AssetPath := '';
        for Asset in Assets do if Asset.GetValue<string>('name') = 'Community_Bulletin_Sample.pdf' then AssetPath := Asset.GetValue<string>('path');
        if AssetPath = '' then raise Exception.Create('Recovered PDF is missing.');
      finally Manifest.Free end;
      Archive.Read(AssetPath, Actual);
      if (Length(Actual) <> Length(Expected)) or ((Length(Expected) > 0) and not CompareMem(@Actual[0], @Expected[0], Length(Expected))) then raise Exception.Create('Recovered PDF bytes differ.');
    finally Archive.Free end;
    Writeln('Desktop revision download retained five pages and the original PDF bytes.');
  finally Driver.Free; MainForm.Free end;
end.
