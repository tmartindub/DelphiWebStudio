program DesktopRevisionWriteTerminationSmoke;
{$APPTYPE CONSOLE}
{$B-}
{ Uses a fresh isolated profile and editor\fixture.zip; deliberately
  terminates only this test process while its revision transaction is open. }
uses Winapi.Windows, System.SysUtils, System.Classes, System.IOUtils,
  Vcl.Forms, Vcl.Edge, WebStudio.Main in 'WebStudio.Main.pas';
var Folder, Value: string; Deadline: UInt64;
begin
  Folder := ExtractFilePath(ParamStr(0));
  if not TFile.Exists(TPath.Combine(Folder, 'editor\fixture.zip')) or
    TFile.Exists(TPath.Combine(Folder, 'revision-write-active.txt')) then
    raise Exception.Create('A fresh isolated test folder and fixture are required.');
  Application.Initialize;
  Application.ShowMainForm := False;
  Application.CreateForm(TMainForm, MainForm);
  Deadline := GetTickCount64 + 30000;
  while (MainForm.StatusLabel.Caption <> 'Local editor loaded.') and (GetTickCount64 < Deadline) do begin CheckSynchronize(0); Application.ProcessMessages; Sleep(20) end;
  if MainForm.StatusLabel.Caption <> 'Local editor loaded.' then raise Exception.Create('Test editor did not load.');
  if Winapi.Windows.Failed(MainForm.EditorBrowser.ControllerInterface.Set_IsVisible(1)) then raise Exception.Create('Could not activate test WebView.');
  MainForm.EditorBrowser.ExecuteScript('fetch("/fixture.zip").then(r=>r.blob()).then(b=>{const i=document.querySelector("input[aria-label=\"Choose project file\"]"),d=new DataTransfer();d.items.add(new File([b],"fixture.zip",{type:"application/zip"}));i.files=d.files;i.dispatchEvent(new Event("change",{bubbles:true}));})');
  Deadline := GetTickCount64 + 30000;
  repeat CheckSynchronize(0); Application.ProcessMessages; Sleep(50);
    Value := MainForm.EditorBrowser.ExecuteScript('!!Array.from(document.querySelectorAll("button")).find(b=>b.textContent.trim()==="News")', '');
  until (Value = 'true') or (GetTickCount64 >= Deadline);
  if Value <> 'true' then raise Exception.Create('Five-page fixture did not open.');
  MainForm.EditorBrowser.ExecuteScript('Array.from(document.querySelectorAll("summary")).find(e=>e.textContent.trim()==="Local revisions").click();Array.from(document.querySelectorAll("button")).find(e=>e.textContent.trim()==="Create local revision").click()');
  Deadline := GetTickCount64 + 30000;
  repeat CheckSynchronize(0); Application.ProcessMessages; Sleep(50);
    Value := MainForm.EditorBrowser.ExecuteScript('!!Array.from(document.querySelectorAll("button")).find(e=>e.textContent.trim()==="Save revision as file"&&!e.disabled)', '');
  until (Value = 'true') or (GetTickCount64 >= Deadline);
  if Value <> 'true' then raise Exception.Create('The last-good revision was not created.');
  MainForm.EditorBrowser.ExecuteScript('(()=>{const add=IDBObjectStore.prototype.add;IDBObjectStore.prototype.add=function(...args){const request=add.apply(this,args);if(this.name==="revisions"){const store=this;request.addEventListener("success",()=>{window.revisionWriteActive=true;const keep=()=>{try{const r=store.count();r.onsuccess=keep}catch{}};keep()})}return request}})()');
  MainForm.EditorBrowser.ExecuteScript('Array.from(document.querySelectorAll("button")).find(e=>e.textContent.trim()==="Create local revision").click()');
  Deadline := GetTickCount64 + 30000;
  repeat CheckSynchronize(0); Application.ProcessMessages; Sleep(50);
    Value := MainForm.EditorBrowser.ExecuteScript('window.revisionWriteActive===true', '');
  until (Value = 'true') or (GetTickCount64 >= Deadline);
  if Value <> 'true' then raise Exception.Create('The test revision transaction did not start.');
  TFile.WriteAllText(TPath.Combine(Folder, 'revision-write-active.txt'), 'Test transaction active before forced termination.');
  TerminateProcess(GetCurrentProcess, 92);
end.
