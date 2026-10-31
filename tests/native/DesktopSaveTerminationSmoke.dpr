program DesktopSaveTerminationSmoke;
{$APPTYPE CONSOLE}
{ Run only in an isolated test folder and profile, with the sample PDF staged
  as editor\proof.pdf. This test intentionally terminates its own process. }
uses
  Winapi.Windows, Winapi.Messages, Winapi.WebView2, Winapi.CommDlg, Winapi.Dlgs,
  System.Classes, System.SysUtils, System.IOUtils, Vcl.Forms, Vcl.Edge, Vcl.Dialogs,
  WebStudio.Main in 'WebStudio.Main.pas' {MainForm};

type
  TDownloadObserver = class
    Operation: ICoreWebView2DownloadOperation;
    DialogShown: Boolean;
    procedure SaveShown(Sender: TObject);
    procedure DownloadStarting(Sender: TCustomEdgeBrowser; Args: TDownloadStartingEventArgs);
  end;

procedure TDownloadObserver.SaveShown(Sender: TObject);
var Window: HWND; Target: string;
begin
  Target := TPath.Combine(ExtractFilePath(ParamStr(0)), 'new-project.webstudio.zip');
  if TFile.Exists(Target) then raise Exception.Create('Test destination already exists.');
  Window := GetParent(TSaveDialog(Sender).Handle);
  SendMessage(Window, CDM_SETCONTROLTEXT, edt1, LPARAM(PChar(ExtractFileName(Target))));
  DialogShown := True;
  PostMessage(Window, WM_COMMAND, IDOK, 0);
end;

procedure TDownloadObserver.DownloadStarting(Sender: TCustomEdgeBrowser; Args: TDownloadStartingEventArgs);
begin
  if Winapi.Windows.Failed(Args.ArgsInterface.Get_DownloadOperation(Operation)) or (Operation = nil) then
    raise Exception.Create('Could not inspect the test download.');
  MainForm.EditorBrowserDownloadStarting(Sender, Args);
end;

var Deadline: UInt64; Observer: TDownloadObserver; State: COREWEBVIEW2_DOWNLOAD_STATE; Folder, LastGood, Marker, Value: string;
begin
  Folder := ExtractFilePath(ParamStr(0));
  LastGood := TPath.Combine(Folder, 'last-good-project.webstudio.json');
  Marker := TPath.Combine(Folder, 'termination-ready.txt');
  if TFile.Exists(LastGood) or TFile.Exists(Marker) then raise Exception.Create('Test files already exist.');
  TFile.WriteAllText(LastGood, 'last good project');
  Application.Initialize;
  Application.ShowMainForm := False;
  Application.CreateForm(TMainForm, MainForm);
  Observer := TDownloadObserver.Create;
  Deadline := GetTickCount64 + 30000;
  while (MainForm.StatusLabel.Caption <> 'Local editor loaded.') and (GetTickCount64 < Deadline) do begin CheckSynchronize(0); Application.ProcessMessages; Sleep(20) end;
  if MainForm.StatusLabel.Caption <> 'Local editor loaded.' then raise Exception.Create('Test editor did not load.');
  if Winapi.Windows.Failed(MainForm.EditorBrowser.ControllerInterface.Set_IsVisible(1)) then raise Exception.Create('Could not activate test WebView.');
  Deadline := GetTickCount64 + 15000;
  repeat
    CheckSynchronize(0); Application.ProcessMessages; Sleep(50);
    Value := MainForm.EditorBrowser.ExecuteScript('!!Array.from(document.querySelectorAll("button")).find(b=>b.textContent.includes("Connect a community or club"))', '');
  until (Value = 'true') or (GetTickCount64 >= Deadline);
  if Value <> 'true' then raise Exception.Create('Community starter was not found.');
  MainForm.EditorBrowser.ExecuteScript('Array.from(document.querySelectorAll("button")).find(b=>b.textContent.includes("Connect a community or club")).click()');
  Deadline := GetTickCount64 + 15000;
  repeat
    CheckSynchronize(0); Application.ProcessMessages; Sleep(50);
    Value := MainForm.EditorBrowser.ExecuteScript('!!document.querySelector("[aria-label=\"hero block\"]")', '');
  until (Value = 'true') or (GetTickCount64 >= Deadline);
  if Value <> 'true' then raise Exception.Create('Hero block was not found.');
  MainForm.EditorBrowser.ExecuteScript('document.querySelector("[aria-label=\"hero block\"]").click()');
  Deadline := GetTickCount64 + 15000;
  repeat
    CheckSynchronize(0); Application.ProcessMessages; Sleep(50);
    Value := MainForm.EditorBrowser.ExecuteScript('!!Array.from(document.querySelectorAll("input")).find(i=>i.value==="Community")', '');
  until (Value = 'true') or (GetTickCount64 >= Deadline);
  if Value <> 'true' then raise Exception.Create('Headline editor was not found.');
  MainForm.EditorBrowser.ExecuteScript('(()=>{const i=Array.from(document.querySelectorAll("input")).find(e=>e.value==="Community");Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(i,"Draft survives forced termination");i.dispatchEvent(new Event("input",{bubbles:true}));})()');
  Deadline := GetTickCount64 + 15000;
  repeat
    CheckSynchronize(0); Application.ProcessMessages; Sleep(50);
    Value := MainForm.EditorBrowser.ExecuteScript('!!localStorage.getItem("openpage-projects")?.includes("Draft survives forced termination")', '');
  until (Value = 'true') or (GetTickCount64 >= Deadline);
  if Value <> 'true' then raise Exception.Create('Test edit did not reach local draft storage.');
  MainForm.EditorBrowser.ExecuteScript('Array.from(document.querySelectorAll("button")).find(b=>b.textContent.trim()==="Media").click()');
  Deadline := GetTickCount64 + 15000;
  repeat
    CheckSynchronize(0); Application.ProcessMessages; Sleep(50);
    Value := MainForm.EditorBrowser.ExecuteScript('!!document.querySelector("input[aria-label=\"Import media files\"]")', '');
  until (Value = 'true') or (GetTickCount64 >= Deadline);
  if Value <> 'true' then raise Exception.Create('Media import control was not found.');
  MainForm.EditorBrowser.ExecuteScript('fetch("/proof.pdf").then(r=>r.blob()).then(b=>{const i=document.querySelector("input[aria-label=\"Import media files\"]"),d=new DataTransfer();d.items.add(new File([b],"proof.pdf",{type:"application/pdf"}));i.files=d.files;i.dispatchEvent(new Event("change",{bubbles:true}));})');
  Deadline := GetTickCount64 + 30000;
  repeat
    CheckSynchronize(0); Application.ProcessMessages; Sleep(50);
    Value := MainForm.EditorBrowser.ExecuteScript('!!Array.from(document.querySelectorAll("button")).find(b=>b.textContent.trim()==="Preview PDF")', '');
  until (Value = 'true') or (GetTickCount64 >= Deadline);
  if Value <> 'true' then raise Exception.Create('Sample PDF was not imported before termination.');
  MainForm.EditorBrowser.ExecuteScript('Array.from(document.querySelectorAll("summary")).find(e=>e.textContent.trim()==="Local revisions").click();Array.from(document.querySelectorAll("button")).find(e=>e.textContent.trim()==="Create local revision").click()');
  Deadline := GetTickCount64 + 30000;
  repeat
    CheckSynchronize(0); Application.ProcessMessages; Sleep(50);
    Value := MainForm.EditorBrowser.ExecuteScript('!!Array.from(document.querySelectorAll("button")).find(e=>e.textContent.trim()==="Open as a separate project")', '');
  until (Value = 'true') or (GetTickCount64 >= Deadline);
  if Value <> 'true' then raise Exception.Create('Local revision was not saved before termination.');
  MainForm.EditorBrowser.ExecuteScript('(()=>{const i=Array.from(document.querySelectorAll("input")).find(e=>e.value==="Draft survives forced termination");Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(i,"Newer draft survives termination");i.dispatchEvent(new Event("input",{bubbles:true}));})()');
  Deadline := GetTickCount64 + 15000;
  repeat
    CheckSynchronize(0); Application.ProcessMessages; Sleep(50);
    Value := MainForm.EditorBrowser.ExecuteScript('!!localStorage.getItem("openpage-projects")?.includes("Newer draft survives termination")', '');
  until (Value = 'true') or (GetTickCount64 >= Deadline);
  if Value <> 'true' then raise Exception.Create('Newer draft did not reach storage before termination.');
  MainForm.SaveDownloadDialog.InitialDir := Folder;
  MainForm.SaveDownloadDialog.OnShow := Observer.SaveShown;
  MainForm.EditorBrowser.OnDownloadStarting := Observer.DownloadStarting;
  MainForm.EditorBrowser.ExecuteScript('(()=>{const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([new Uint8Array(128*1024*1024)]));a.download="termination-test.webstudio.zip";a.click()})()');
  Deadline := GetTickCount64 + 30000;
  while not Observer.DialogShown and (GetTickCount64 < Deadline) do begin CheckSynchronize(0); Application.ProcessMessages; Sleep(20) end;
  if not Observer.DialogShown then raise Exception.Create('The save dialog did not open.');
  if Winapi.Windows.Failed(Observer.Operation.Get_State(State)) or (State <> COREWEBVIEW2_DOWNLOAD_STATE_IN_PROGRESS) then raise Exception.Create('The download finished before termination.');
  TFile.WriteAllText(Marker, 'active project download');
  TerminateProcess(GetCurrentProcess, 91);
end.
