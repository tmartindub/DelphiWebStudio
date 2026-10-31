program DesktopFivePageRoundtripSmoke;
{$APPTYPE CONSOLE}
{$B-}
{ Run only in a fresh isolated folder and profile. Stage the five-page
  PDF/link browser round-trip project as editor\fixture.zip and the original
  Community_Bulletin_Sample.pdf as editor\proof.pdf before starting. }
uses
  Winapi.Windows, Winapi.Messages, Winapi.CommDlg, Winapi.Dlgs,
  System.Classes, System.SysUtils, System.IOUtils, System.JSON, System.Zip, Vcl.Forms, Vcl.Edge, Vcl.Dialogs,
  WebStudio.Main in 'WebStudio.Main.pas' {MainForm};

type
  TDialogDriver = class
    Count: Integer;
    procedure SaveShown(Sender: TObject);
  end;

procedure TDialogDriver.SaveShown(Sender: TObject);
var Window: HWND; FileName: string;
begin
  Inc(Count);
  if Count = 1 then FileName := 'five-page-saved.zip'
  else if Count = 2 then FileName := 'five-page-website.zip'
  else raise Exception.Create('Unexpected save dialog.');
  if TFile.Exists(TPath.Combine(ExtractFilePath(ParamStr(0)), FileName)) then
    raise Exception.Create('Test output already exists.');
  Window := GetParent(TSaveDialog(Sender).Handle);
  SendMessage(Window, CDM_SETCONTROLTEXT, edt1, LPARAM(PChar(FileName)));
  PostMessage(Window, WM_COMMAND, IDOK, 0);
end;

var
  Deadline: UInt64;
  Value, Folder, SavedFile, ReopenFile, AssetPath, Html: string;
  Driver: TDialogDriver;
  Archive: TZipFile;
  Manifest: TJSONValue;
  Pages, Assets: TJSONArray;
  Asset: TJSONValue;
  Actual, Expected: TBytes;
begin
  Folder := ExtractFilePath(ParamStr(0));
  SavedFile := TPath.Combine(Folder, 'five-page-saved.zip');
  ReopenFile := TPath.Combine(Folder, 'editor\reopen.zip');
  if not TFile.Exists(TPath.Combine(Folder, 'editor\fixture.zip')) or
    not TFile.Exists(TPath.Combine(Folder, 'editor\proof.pdf')) or TFile.Exists(ReopenFile) then
    raise Exception.Create('A fresh test fixture is required.');
  Application.Initialize;
  Application.ShowMainForm := False;
  Application.CreateForm(TMainForm, MainForm);
  Driver := TDialogDriver.Create;
  try
    Deadline := GetTickCount64 + 30000;
    while (MainForm.StatusLabel.Caption <> 'Local editor loaded.') and (GetTickCount64 < Deadline) do begin CheckSynchronize(0); Application.ProcessMessages; Sleep(20) end;
    if MainForm.StatusLabel.Caption <> 'Local editor loaded.' then raise Exception.Create('Test editor did not load.');
    if Winapi.Windows.Failed(MainForm.EditorBrowser.ControllerInterface.Set_IsVisible(1)) then raise Exception.Create('Could not activate test WebView.');
    MainForm.SaveDownloadDialog.InitialDir := Folder;
    MainForm.ProjectSaveDialog.InitialDir := Folder;
    MainForm.SaveDownloadDialog.OnShow := Driver.SaveShown;
    MainForm.ProjectSaveDialog.OnShow := Driver.SaveShown;
    Deadline := GetTickCount64 + 15000;
    repeat
      CheckSynchronize(0); Application.ProcessMessages; Sleep(50);
      Value := MainForm.EditorBrowser.ExecuteScript('!!document.querySelector("input[aria-label=\"Choose project file\"]")', '');
    until (Value = 'true') or (GetTickCount64 >= Deadline);
    if Value <> 'true' then raise Exception.Create('Project file control was not found.');
    MainForm.EditorBrowser.ExecuteScript('fetch("/fixture.zip").then(r=>r.blob()).then(b=>{const i=document.querySelector("input[aria-label=\"Choose project file\"]"),d=new DataTransfer();d.items.add(new File([b],"fixture.zip",{type:"application/zip"}));i.files=d.files;i.dispatchEvent(new Event("change",{bubbles:true}));})');
    Deadline := GetTickCount64 + 30000;
    repeat
      CheckSynchronize(0); Application.ProcessMessages; Sleep(50);
      Value := MainForm.EditorBrowser.ExecuteScript('!!Array.from(document.querySelectorAll("button")).find(b=>b.textContent.trim()==="News") && !!localStorage.getItem("openpage-projects")?.includes("Tested announcement.")', '');
    until (Value = 'true') or (GetTickCount64 >= Deadline);
    if Value <> 'true' then raise Exception.Create('Five-page fixture did not open.');
    MainForm.EditorBrowser.ExecuteScript('Array.from(document.querySelectorAll("button")).find(b=>b.textContent.trim()==="News").click()');
    Deadline := GetTickCount64 + 15000;
    repeat
      CheckSynchronize(0); Application.ProcessMessages; Sleep(50);
      Value := MainForm.EditorBrowser.ExecuteScript('document.body.innerText.includes("Tested announcement.")', '');
    until (Value = 'true') or (GetTickCount64 >= Deadline);
    if Value <> 'true' then raise Exception.Create('Saved News content did not render.');
    MainForm.EditorBrowser.ExecuteScript('Array.from(document.querySelectorAll("button")).find(b=>b.textContent.trim()==="Save project").click()');
    Deadline := GetTickCount64 + 30000;
    while (MainForm.StatusLabel.Caption <> 'Download completed: five-page-saved.zip') and (GetTickCount64 < Deadline) do begin CheckSynchronize(0); Application.ProcessMessages; Sleep(50) end;
    if MainForm.StatusLabel.Caption <> 'Download completed: five-page-saved.zip' then raise Exception.Create('Five-page project was not saved.');
    TFile.Copy(SavedFile, ReopenFile);
    MainForm.EditorBrowser.ExecuteScript('fetch("/reopen.zip").then(r=>r.blob()).then(b=>{const i=document.querySelector("input[aria-label=\"Choose project file\"]"),d=new DataTransfer();d.items.add(new File([b],"reopen.zip",{type:"application/zip"}));i.files=d.files;i.dispatchEvent(new Event("change",{bubbles:true}));})');
    Deadline := GetTickCount64 + 30000;
    repeat
      CheckSynchronize(0); Application.ProcessMessages; Sleep(50);
      Value := MainForm.EditorBrowser.ExecuteScript('JSON.parse(localStorage.getItem("openpage-projects")||"{}").state?.projects?.length===2', '');
    until (Value = 'true') or (GetTickCount64 >= Deadline);
    if Value <> 'true' then raise Exception.Create('Saved project did not reopen separately.');
    MainForm.EditorBrowser.ExecuteScript('Array.from(document.querySelectorAll("button")).find(b=>b.textContent.trim()==="Export").click()');
    Deadline := GetTickCount64 + 30000;
    while (MainForm.StatusLabel.Caption <> 'Download completed: five-page-website.zip') and (GetTickCount64 < Deadline) do begin CheckSynchronize(0); Application.ProcessMessages; Sleep(50) end;
    if MainForm.StatusLabel.Caption <> 'Download completed: five-page-website.zip' then raise Exception.Create('Five-page website was not exported.');
    Expected := TFile.ReadAllBytes(TPath.Combine(Folder, 'editor\proof.pdf'));
    Archive := TZipFile.Create;
    try
      Archive.Open(SavedFile, zmRead);
      Archive.Read('project.webstudio.json', Actual);
      Manifest := TJSONObject.ParseJSONValue(TEncoding.UTF8.GetString(Actual));
      try
        if not (Manifest is TJSONObject) or not (Manifest.GetValue<TJSONObject>('config').GetValue('pages') is TJSONArray) then raise Exception.Create('Saved manifest is invalid.');
        Pages := Manifest.GetValue<TJSONObject>('config').GetValue<TJSONArray>('pages');
        if Pages.Count <> 5 then raise Exception.Create('Saved page count differs.');
        Assets := Manifest.GetValue<TJSONArray>('assets');
        AssetPath := '';
        for Asset in Assets do
          if Asset.GetValue<string>('name') = 'Community_Bulletin_Sample.pdf' then AssetPath := Asset.GetValue<string>('path');
        if AssetPath = '' then raise Exception.Create('Saved PDF is missing.');
      finally Manifest.Free end;
      Archive.Read(AssetPath, Actual);
      if (Length(Actual) <> Length(Expected)) or ((Length(Expected) > 0) and not CompareMem(@Actual[0], @Expected[0], Length(Expected))) then raise Exception.Create('Saved PDF differs.');
      Archive.Close;
      Archive.Open(TPath.Combine(Folder, 'five-page-website.zip'), zmRead);
      for Value in ['index.html', 'about.html', 'news.html', 'documents.html', 'contact.html'] do
        if Archive.IndexOf(Value) < 0 then raise Exception.Create('Exported page is missing: ' + Value);
      Archive.Read('news.html', Actual);
      Html := TEncoding.UTF8.GetString(Actual);
      if (Pos('Tested announcement.', Html) = 0) or (Pos('href="about.html"', Html) = 0) then raise Exception.Create('Exported News content or link differs.');
      Archive.Read(AssetPath, Actual);
      if (Length(Actual) <> Length(Expected)) or ((Length(Expected) > 0) and not CompareMem(@Actual[0], @Expected[0], Length(Expected))) then raise Exception.Create('Exported PDF differs.');
    finally Archive.Free end;
    Writeln('Five-page project, page link and original PDF survived desktop save, reopen and export.');
  finally Driver.Free; MainForm.Free end;
end.
