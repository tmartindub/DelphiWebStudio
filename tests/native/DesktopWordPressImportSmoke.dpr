program DesktopWordPressImportSmoke;
{$APPTYPE CONSOLE}
{$B-}
{ Run with a fresh isolated WebView profile and editor/wordpress.xml fixture. }
uses Winapi.Windows, Winapi.Messages, Winapi.CommDlg, Winapi.Dlgs,
  System.Classes, System.SysUtils, System.IOUtils, System.JSON, Vcl.Forms, Vcl.Dialogs,
  WebStudio.Main in 'WebStudio.Main.pas' {MainForm};

type TDriver = class
  procedure SaveShown(Sender: TObject);
end;

procedure TDriver.SaveShown(Sender: TObject);
var Window: HWND;
begin
  if TFile.Exists(TPath.Combine(ExtractFilePath(ParamStr(0)), 'wordpress-project.webstudio.json')) then
    raise Exception.Create('Test output already exists.');
  Window := GetParent(TSaveDialog(Sender).Handle);
  SendMessage(Window, CDM_SETCONTROLTEXT, edt1, LPARAM(PChar('wordpress-project.webstudio.json')));
  PostMessage(Window, WM_COMMAND, IDOK, 0);
end;

var Deadline: UInt64; Value, Folder: string; Driver: TDriver; Project: TJSONValue;
begin
  Folder := ExtractFilePath(ParamStr(0));
  if not TFile.Exists(TPath.Combine(Folder, 'editor\wordpress.xml')) then raise Exception.Create('WXR fixture missing.');
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
      Value := MainForm.EditorBrowser.ExecuteScript('!!document.querySelector("input[aria-label=\"Choose WordPress XML export\"]")', '');
    until (Value = 'true') or (GetTickCount64 >= Deadline);
    if Value <> 'true' then raise Exception.Create('WordPress input missing.');
    MainForm.EditorBrowser.ExecuteScript('fetch("/wordpress.xml").then(r=>r.blob()).then(b=>{const i=document.querySelector("input[aria-label=\"Choose WordPress XML export\"]"),d=new DataTransfer();d.items.add(new File([b],"wordpress.xml",{type:"application/xml"}));i.files=d.files;i.dispatchEvent(new Event("change",{bubbles:true}));})');
    Deadline := GetTickCount64 + 15000;
    repeat
      CheckSynchronize(0); Application.ProcessMessages; Sleep(50);
      Value := MainForm.EditorBrowser.ExecuteScript('document.querySelector("[aria-label=\"WordPress import report\"]")?.innerText.includes("1 pages and 1 posts") === true', '');
    until (Value = 'true') or (GetTickCount64 >= Deadline);
    if Value <> 'true' then raise Exception.Create('Import report missing: ' + MainForm.EditorBrowser.ExecuteScript('document.body.innerText', ''));
    Value := MainForm.EditorBrowser.ExecuteScript('(()=>{const r=document.querySelector("[aria-label=\"WordPress import report\"]");return r.innerText.includes("5 conversion issues") && r.textContent.includes("attachment") && r.textContent.includes("media.jpg") && r.textContent.includes("Script or style") && r.textContent.includes("fragment was omitted") && r.textContent.includes("not matched")})()', '');
    if Value <> 'true' then raise Exception.Create('WordPress conversion issues were not reported.');
    MainForm.EditorBrowser.ExecuteScript('Array.from(document.querySelectorAll("button")).find(b=>b.textContent.trim()==="Create imported project").click()');
    Deadline := GetTickCount64 + 15000;
    repeat
      CheckSynchronize(0); Application.ProcessMessages; Sleep(50);
      Value := MainForm.EditorBrowser.ExecuteScript('!!Array.from(document.querySelectorAll("button")).find(b=>b.textContent.trim()==="Save project")', '');
    until (Value = 'true') or (GetTickCount64 >= Deadline);
    if Value <> 'true' then raise Exception.Create('Imported project did not open.');
    Value := MainForm.EditorBrowser.ExecuteScript('window.wpUnsafe === undefined', '');
    if Value <> 'true' then raise Exception.Create('Imported script executed.');
    MainForm.EditorBrowser.ExecuteScript('Array.from(document.querySelectorAll("button")).find(b=>b.textContent.trim()==="Save project").click()');
    Deadline := GetTickCount64 + 30000;
    while (MainForm.StatusLabel.Caption <> 'Download completed: wordpress-project.webstudio.json') and (GetTickCount64 < Deadline) do begin CheckSynchronize(0); Application.ProcessMessages; Sleep(50) end;
    if MainForm.StatusLabel.Caption <> 'Download completed: wordpress-project.webstudio.json' then raise Exception.Create('Imported project did not save.');
    Project := TJSONObject.ParseJSONValue(TFile.ReadAllText(TPath.Combine(Folder, 'wordpress-project.webstudio.json'), TEncoding.UTF8));
    try
      if not Assigned(Project) or not Project.GetValue<string>('webstudioWordPressSource').Contains('<script>') then raise Exception.Create('Original WXR was not retained.');
      if Project.GetValue<TJSONObject>('webstudioWordPressImportReport').GetValue<TJSONArray>('issues').Count <> 5 then raise Exception.Create('WordPress import report was not retained.');
      if Project.GetValue<TJSONObject>('config').GetValue<TJSONArray>('pages').Count <> 3 then raise Exception.Create('Imported page count differs.');
      if not Project.GetValue<TJSONObject>('config').ToJSON.Contains('Welcome from WordPress') then raise Exception.Create('Editable content missing.');
      if not Project.GetValue<TJSONObject>('config').ToJSON.Contains('## Welcome from WordPress') then raise Exception.Create('Imported heading missing.');
      if not Project.GetValue<TJSONObject>('config').ToJSON.Contains('[News](/imported-post-1)') then raise Exception.Create('Imported page link missing.');
      if Project.GetValue<TJSONObject>('config').GetValue<TJSONArray>('pages').Items[1].GetValue<TJSONObject>('webstudioArticle').GetValue<string>('status') <> 'draft' then raise Exception.Create('Unpublished page was not kept as a draft.');
      if Project.GetValue<TJSONObject>('config').GetValue<TJSONArray>('pages').Items[2].GetValue<TJSONObject>('webstudioArticle').GetValue<string>('status') <> 'draft' then raise Exception.Create('Imported post was not a draft.');
    finally Project.Free end;
    TFile.Copy(TPath.Combine(Folder, 'wordpress-project.webstudio.json'), TPath.Combine(Folder, 'editor\reopen.json'));
    MainForm.EditorBrowser.ExecuteScript('fetch("/reopen.json").then(r=>r.blob()).then(b=>{const i=document.querySelector("input[aria-label=\"Choose project file\"]"),d=new DataTransfer();d.items.add(new File([b],"reopen.json",{type:"application/json"}));i.files=d.files;i.dispatchEvent(new Event("change",{bubbles:true}));})');
    Deadline := GetTickCount64 + 30000;
    repeat
      CheckSynchronize(0); Application.ProcessMessages; Sleep(50);
      Value := MainForm.EditorBrowser.ExecuteScript('(()=>{const p=JSON.parse(localStorage.getItem("openpage-projects")||"{}").state?.projects;return p?.length===2 && p[0]?.projectFile?.webstudioWordPressSource?.includes("<script>")})()', '');
    until (Value = 'true') or (GetTickCount64 >= Deadline);
    if Value <> 'true' then raise Exception.Create('Saved import did not reopen with its original WXR.');
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
      Value := MainForm.EditorBrowser.ExecuteScript('document.querySelector("textarea[aria-label=\"Imported source text\"]")?.value.includes("<script>") && window.wpUnsafe === undefined', '');
    until (Value = 'true') or (GetTickCount64 >= Deadline);
    if Value <> 'true' then raise Exception.Create('Original WXR is not safely visible.');
    MainForm.EditorBrowser.ExecuteScript('(()=>{const s=document.querySelector("select[aria-label=\"Imported source file\"]");s.value="1";s.dispatchEvent(new Event("change",{bubbles:true}))})()');
    Deadline := GetTickCount64 + 5000;
    repeat
      CheckSynchronize(0); Application.ProcessMessages; Sleep(50);
      Value := MainForm.EditorBrowser.ExecuteScript('document.querySelector("textarea[aria-label=\"Imported source text\"]")?.value.includes("media.jpg") && document.querySelector("textarea[aria-label=\"Imported source text\"]")?.value.includes("attachment")', '');
    until (Value = 'true') or (GetTickCount64 >= Deadline);
    if Value <> 'true' then raise Exception.Create('Retained WordPress report is not visible.');
    Writeln('WordPress conversion report, save, reopen and read-only review passed.');
  finally Driver.Free; MainForm.Free end;
end.
