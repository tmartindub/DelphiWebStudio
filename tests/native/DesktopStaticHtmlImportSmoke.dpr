program DesktopStaticHtmlImportSmoke;
{$APPTYPE CONSOLE}
{$B-}
{ Run with a fresh isolated WebView profile and HTML/CSS fixtures. }
uses Winapi.Windows, Winapi.Messages, Winapi.CommDlg, Winapi.Dlgs,
  System.Classes, System.SysUtils, System.IOUtils, System.JSON, Vcl.Forms, Vcl.Dialogs,
  WebStudio.Main in 'WebStudio.Main.pas' {MainForm};

type TDriver = class
  procedure SaveShown(Sender: TObject);
end;

procedure TDriver.SaveShown(Sender: TObject);
var Window: HWND;
begin
  if TFile.Exists(TPath.Combine(ExtractFilePath(ParamStr(0)), 'html-project.webstudio.json')) then
    raise Exception.Create('Test output already exists.');
  Window := GetParent(TSaveDialog(Sender).Handle);
  SendMessage(Window, CDM_SETCONTROLTEXT, edt1, LPARAM(PChar('html-project.webstudio.json')));
  PostMessage(Window, WM_COMMAND, IDOK, 0);
end;

var Deadline: UInt64; Value, Folder: string; Driver: TDriver; Project: TJSONValue;
begin
  Folder := ExtractFilePath(ParamStr(0));
  if not TFile.Exists(TPath.Combine(Folder, 'editor\index.html.fixture')) then raise Exception.Create('HTML fixture missing.');
  Application.Initialize;
  UseLatestCommonDialogs := False;
  Application.ShowMainForm := False;
  Application.CreateForm(TMainForm, MainForm);
  Driver := TDriver.Create;
  try
    Deadline := GetTickCount64 + 30000;
    while (MainForm.StatusLabel.Caption <> 'Local editor loaded.') and (GetTickCount64 < Deadline) do begin CheckSynchronize(0); Application.ProcessMessages; Sleep(20) end;
    if MainForm.StatusLabel.Caption <> 'Local editor loaded.' then raise Exception.Create('Editor did not load.');
    if Failed(MainForm.EditorBrowser.ControllerInterface.Set_IsVisible(1)) then raise Exception.Create('Could not activate WebView.');
    MainForm.ProjectSaveDialog.InitialDir := Folder;
    MainForm.ProjectSaveDialog.OnShow := Driver.SaveShown;
    Deadline := GetTickCount64 + 15000;
    repeat
      CheckSynchronize(0); Application.ProcessMessages; Sleep(50);
      Value := MainForm.EditorBrowser.ExecuteScript('!!document.querySelector("input[aria-label=\"Choose static website folder\"]")', '');
    until (Value = 'true') or (GetTickCount64 >= Deadline);
    if Value <> 'true' then raise Exception.Create('HTML input missing.');
    Value := MainForm.EditorBrowser.ExecuteScript('document.querySelector("input[aria-label=\"Choose static website folder\"]").webkitdirectory === true', '');
    if Value <> 'true' then raise Exception.Create('Folder selection is not enabled.');
    MainForm.EditorBrowser.ExecuteScript('Promise.all([fetch("/index.html.fixture").then(r=>r.blob()),fetch("/about.html.fixture").then(r=>r.blob()),fetch("/site.css.fixture").then(r=>r.blob())]).then(f=>{const i=document.querySelector("input[aria-label=\"Choose static website folder\"]"),d=new DataTransfer();d.items.add(new File([f[0]],"index.html"));d.items.add(new File([f[1]],"about.html"));d.items.add(new File([f[2]],"site.css"));d.items.add(new File(["image"],"image.png"));i.files=d.files;i.dispatchEvent(new Event("change",{bubbles:true}));})');
    Deadline := GetTickCount64 + 15000;
    repeat
      CheckSynchronize(0); Application.ProcessMessages; Sleep(50);
      Value := MainForm.EditorBrowser.ExecuteScript('document.querySelector("[aria-label=\"HTML import report\"]")?.innerText.includes("2 HTML pages and 1 stylesheets") === true', '');
    until (Value = 'true') or (GetTickCount64 >= Deadline);
    if Value <> 'true' then raise Exception.Create('Import report missing: ' + MainForm.EditorBrowser.ExecuteScript('document.body.innerText', ''));
    MainForm.EditorBrowser.ExecuteScript('Array.from(document.querySelectorAll("button")).find(b=>b.textContent.trim()==="Create HTML project").click()');
    Deadline := GetTickCount64 + 15000;
    repeat
      CheckSynchronize(0); Application.ProcessMessages; Sleep(50);
      Value := MainForm.EditorBrowser.ExecuteScript('!!Array.from(document.querySelectorAll("button")).find(b=>b.textContent.trim()==="Save project")', '');
    until (Value = 'true') or (GetTickCount64 >= Deadline);
    if Value <> 'true' then raise Exception.Create('Imported project did not open.');
    Value := MainForm.EditorBrowser.ExecuteScript('window.htmlUnsafe === undefined', '');
    if Value <> 'true' then raise Exception.Create('Imported script executed.');
    MainForm.EditorBrowser.ExecuteScript('Array.from(document.querySelectorAll("button")).find(b=>b.textContent.trim()==="Save project").click()');
    Deadline := GetTickCount64 + 30000;
    while (MainForm.StatusLabel.Caption <> 'Download completed: html-project.webstudio.json') and (GetTickCount64 < Deadline) do begin CheckSynchronize(0); Application.ProcessMessages; Sleep(50) end;
    if MainForm.StatusLabel.Caption <> 'Download completed: html-project.webstudio.json' then raise Exception.Create('Imported project did not save.');
    Project := TJSONObject.ParseJSONValue(TFile.ReadAllText(TPath.Combine(Folder, 'html-project.webstudio.json'), TEncoding.UTF8));
    try
      if not Assigned(Project) or (Project.GetValue<TJSONArray>('webstudioStaticSource').Count <> 3) then raise Exception.Create('Original HTML and CSS were not retained.');
      if Project.GetValue<TJSONObject>('config').GetValue<TJSONArray>('pages').Count <> 2 then raise Exception.Create('Imported page count differs.');
      if not Project.GetValue<TJSONObject>('config').ToJSON.Contains('Welcome from HTML') then raise Exception.Create('Editable content missing.');
    finally Project.Free end;
    TFile.Copy(TPath.Combine(Folder, 'html-project.webstudio.json'), TPath.Combine(Folder, 'editor\reopen.json'));
    MainForm.EditorBrowser.ExecuteScript('fetch("/reopen.json").then(r=>r.blob()).then(b=>{const i=document.querySelector("input[aria-label=\"Choose project file\"]"),d=new DataTransfer();d.items.add(new File([b],"reopen.json",{type:"application/json"}));i.files=d.files;i.dispatchEvent(new Event("change",{bubbles:true}));})');
    Deadline := GetTickCount64 + 30000;
    repeat
      CheckSynchronize(0); Application.ProcessMessages; Sleep(50);
      Value := MainForm.EditorBrowser.ExecuteScript('(()=>{const p=JSON.parse(localStorage.getItem("openpage-projects")||"{}").state?.projects;return p?.length===2 && p[0]?.projectFile?.webstudioStaticSource?.some(f=>f.text.includes("<script>"))})()', '');
    until (Value = 'true') or (GetTickCount64 >= Deadline);
    if Value <> 'true' then raise Exception.Create('Saved import did not reopen with its original HTML.');
    Writeln('HTML preview, separate-project creation, save and reopen retained the original HTML and CSS.');
  finally Driver.Free; MainForm.Free end;
end.
