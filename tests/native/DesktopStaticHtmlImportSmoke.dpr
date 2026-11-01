program DesktopStaticHtmlImportSmoke;
{$APPTYPE CONSOLE}
{$B-}
{ Run with a fresh isolated WebView profile and HTML/CSS fixtures. }
uses Winapi.Windows, Winapi.Messages, Winapi.CommDlg, Winapi.Dlgs,
  System.Classes, System.SysUtils, System.IOUtils, System.JSON, System.Zip, Vcl.Forms, Vcl.Dialogs,
  WebStudio.Main in 'WebStudio.Main.pas' {MainForm};

type TDriver = class
  Count: Integer;
  procedure SaveShown(Sender: TObject);
end;

procedure TDriver.SaveShown(Sender: TObject);
var Window: HWND; Name: string;
begin
  Inc(Count);
  if Count = 1 then Name := 'html-project.webstudio.zip'
  else if Count = 2 then Name := 'html-website.zip'
  else raise Exception.Create('Unexpected save dialog.');
  if TFile.Exists(TPath.Combine(ExtractFilePath(ParamStr(0)), Name)) then
    raise Exception.Create('Test output already exists.');
  Window := GetParent(TSaveDialog(Sender).Handle);
  SendMessage(Window, CDM_SETCONTROLTEXT, edt1, LPARAM(PChar(Name)));
  PostMessage(Window, WM_COMMAND, IDOK, 0);
end;

var Deadline: UInt64; Value, Folder, AssetPath, Html: string; Driver: TDriver; Project: TJSONValue; Zip: TZipFile; Bytes: TBytes;
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
    MainForm.SaveDownloadDialog.InitialDir := Folder;
    MainForm.SaveDownloadDialog.OnShow := Driver.SaveShown;
    Deadline := GetTickCount64 + 15000;
    repeat
      CheckSynchronize(0); Application.ProcessMessages; Sleep(50);
      Value := MainForm.EditorBrowser.ExecuteScript('!!document.querySelector("input[aria-label=\"Choose static website folder\"]")', '');
    until (Value = 'true') or (GetTickCount64 >= Deadline);
    if Value <> 'true' then raise Exception.Create('HTML input missing.');
    Value := MainForm.EditorBrowser.ExecuteScript('document.querySelector("input[aria-label=\"Choose static website folder\"]").webkitdirectory === true', '');
    if Value <> 'true' then raise Exception.Create('Folder selection is not enabled.');
    MainForm.EditorBrowser.ExecuteScript('Promise.all([fetch("/index.html.fixture").then(r=>r.blob()),fetch("/about.html.fixture").then(r=>r.blob()),fetch("/site.css.fixture").then(r=>r.blob())]).then(f=>{const i=document.querySelector("input[aria-label=\"Choose static website folder\"]"),d=new DataTransfer();d.items.add(new File([f[0]],"index.html"));d.items.add(new File([f[1]],"about.html"));d.items.add(new File([f[2]],"site.css"));d.items.add(new File(["<svg xmlns=\"http://www.w3.org/2000/svg\"><rect width=\"1\" height=\"1\"/></svg>"],"image.svg",{type:"image/svg+xml"}));i.files=d.files;i.dispatchEvent(new Event("change",{bubbles:true}));})');
    Deadline := GetTickCount64 + 15000;
    repeat
      CheckSynchronize(0); Application.ProcessMessages; Sleep(50);
      Value := MainForm.EditorBrowser.ExecuteScript('document.querySelector("[aria-label=\"HTML import report\"]")?.innerText.includes("2 HTML pages, 1 stylesheets and 1 images") === true', '');
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
    while (MainForm.StatusLabel.Caption <> 'Download completed: html-project.webstudio.zip') and (GetTickCount64 < Deadline) do begin CheckSynchronize(0); Application.ProcessMessages; Sleep(50) end;
    if MainForm.StatusLabel.Caption <> 'Download completed: html-project.webstudio.zip' then raise Exception.Create('Imported project did not save.');
    Zip := TZipFile.Create;
    try
      Zip.Open(TPath.Combine(Folder, 'html-project.webstudio.zip'), zmRead);
      Zip.Read('project.webstudio.json', Bytes);
      Project := TJSONObject.ParseJSONValue(TEncoding.UTF8.GetString(Bytes));
      try
        if not Assigned(Project) or (Project.GetValue<TJSONArray>('webstudioStaticSource').Count <> 3) then raise Exception.Create('Original HTML and CSS were not retained.');
        if Project.GetValue<TJSONObject>('config').GetValue<TJSONArray>('pages').Count <> 2 then raise Exception.Create('Imported page count differs.');
        if not Project.GetValue<TJSONObject>('config').ToJSON.Contains('Welcome from HTML') then raise Exception.Create('Editable content missing.');
        if not Project.GetValue<TJSONObject>('config').ToJSON.Contains('## Welcome from HTML') then raise Exception.Create('Imported heading missing.');
        if not Project.GetValue<TJSONObject>('config').ToJSON.Contains('[About](/imported-page-2)') then raise Exception.Create('Imported page link missing.');
        if Project.GetValue<TJSONArray>('assets').Count <> 1 then raise Exception.Create('Imported image missing from project.');
        AssetPath := Project.GetValue<TJSONArray>('assets').Items[0].GetValue<string>('path');
        if not Project.GetValue<TJSONObject>('config').ToJSON.Contains(AssetPath) then raise Exception.Create('Imported page image reference missing.');
        Zip.Read(AssetPath, Bytes);
        if not TEncoding.UTF8.GetString(Bytes).Contains('<svg') then raise Exception.Create('Imported image content missing.');
      finally Project.Free end;
    finally Zip.Free end;
    MainForm.EditorBrowser.ExecuteScript('Array.from(document.querySelectorAll("button")).find(b=>b.textContent.trim()==="Export").click()');
    Deadline := GetTickCount64 + 30000;
    while (MainForm.StatusLabel.Caption <> 'Download completed: html-website.zip') and (GetTickCount64 < Deadline) do begin CheckSynchronize(0); Application.ProcessMessages; Sleep(50) end;
    if MainForm.StatusLabel.Caption <> 'Download completed: html-website.zip' then raise Exception.Create('Imported website did not export.');
    Zip := TZipFile.Create;
    try
      Zip.Open(TPath.Combine(Folder, 'html-website.zip'), zmRead);
      Zip.Read('index.html', Bytes);
      Html := TEncoding.UTF8.GetString(Bytes);
      if not Html.Contains('Welcome from HTML') or not Html.Contains('href="imported-page-2.html"') then raise Exception.Create('Exported heading or page link missing.');
      if not Html.Contains(AssetPath) or (Zip.IndexOf(AssetPath) < 0) then raise Exception.Create('Exported image reference or file missing.');
    finally Zip.Free end;
    TFile.Copy(TPath.Combine(Folder, 'html-project.webstudio.zip'), TPath.Combine(Folder, 'editor\reopen.zip'));
    MainForm.EditorBrowser.ExecuteScript('fetch("/reopen.zip").then(r=>r.blob()).then(b=>{const i=document.querySelector("input[aria-label=\"Choose project file\"]"),d=new DataTransfer();d.items.add(new File([b],"reopen.zip",{type:"application/zip"}));i.files=d.files;i.dispatchEvent(new Event("change",{bubbles:true}));})');
    Deadline := GetTickCount64 + 30000;
    repeat
      CheckSynchronize(0); Application.ProcessMessages; Sleep(50);
      Value := MainForm.EditorBrowser.ExecuteScript('(()=>{const p=JSON.parse(localStorage.getItem("openpage-projects")||"{}").state?.projects;return p?.length===2 && p[0]?.projectFile?.webstudioStaticSource?.some(f=>f.text.includes("<script>"))})()', '');
    until (Value = 'true') or (GetTickCount64 >= Deadline);
    if Value <> 'true' then raise Exception.Create('Saved import did not reopen with its original HTML.');
    MainForm.EditorBrowser.ExecuteScript('document.body.dispatchEvent(new KeyboardEvent("keydown",{key:"j",bubbles:true}))');
    Deadline := GetTickCount64 + 5000;
    repeat
      CheckSynchronize(0); Application.ProcessMessages; Sleep(50);
      Value := MainForm.EditorBrowser.ExecuteScript('!!Array.from(document.querySelectorAll("#editor-code-panel button")).find(b=>b.textContent.trim()==="Inspect imported source")', '');
    until (Value = 'true') or (GetTickCount64 >= Deadline);
    if Value <> 'true' then raise Exception.Create('Imported source view control missing.');
    MainForm.EditorBrowser.ExecuteScript('Array.from(document.querySelectorAll("#editor-code-panel button")).find(b=>b.textContent.trim()==="Inspect imported source").click()');
    Deadline := GetTickCount64 + 5000;
    repeat
      CheckSynchronize(0); Application.ProcessMessages; Sleep(50);
      Value := MainForm.EditorBrowser.ExecuteScript('document.querySelector("textarea[aria-label=\"Imported source text\"]")?.value.includes("<script>") && window.htmlUnsafe === undefined', '');
    until (Value = 'true') or (GetTickCount64 >= Deadline);
    if Value <> 'true' then raise Exception.Create('Original HTML is not safely visible.');
    MainForm.EditorBrowser.ExecuteScript('(()=>{const s=document.querySelector("select[aria-label=\"Imported source file\"]");s.value="2";s.dispatchEvent(new Event("change",{bubbles:true}))})()');
    Deadline := GetTickCount64 + 5000;
    repeat
      CheckSynchronize(0); Application.ProcessMessages; Sleep(50);
      Value := MainForm.EditorBrowser.ExecuteScript('document.querySelector("textarea[aria-label=\"Imported source text\"]")?.value.includes("color: blue")', '');
    until (Value = 'true') or (GetTickCount64 >= Deadline);
    if Value <> 'true' then raise Exception.Create('Original CSS is not visible.');
    Writeln('HTML and image import, save, export, reopen and read-only source review passed.');
  finally Driver.Free; MainForm.Free end;
end.
