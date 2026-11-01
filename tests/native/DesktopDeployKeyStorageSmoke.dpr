program DesktopDeployKeyStorageSmoke;
{$APPTYPE CONSOLE}
{$B-}
{ Uses only synthetic keys in an isolated WebView profile; no requests are made. }
uses Winapi.Windows, System.Classes, System.SysUtils, Vcl.Forms,
  WebStudio.Main in 'WebStudio.Main.pas' {MainForm};

var Deadline: UInt64; Value: string;
begin
  Application.Initialize;
  Application.ShowMainForm := False;
  Application.CreateForm(TMainForm, MainForm);
  try
    Deadline := GetTickCount64 + 30000;
    while (MainForm.StatusLabel.Caption <> 'Local editor loaded.') and (GetTickCount64 < Deadline) do begin CheckSynchronize(0); Application.ProcessMessages; Sleep(20) end;
    if MainForm.StatusLabel.Caption <> 'Local editor loaded.' then raise Exception.Create('Editor did not load.');
    if Failed(MainForm.EditorBrowser.ControllerInterface.Set_IsVisible(1)) then raise Exception.Create('Could not activate WebView.');
    Deadline := GetTickCount64 + 15000;
    repeat
      CheckSynchronize(0); Application.ProcessMessages; Sleep(50);
      Value := MainForm.EditorBrowser.ExecuteScript('!!Array.from(document.querySelectorAll("button")).find(b=>b.textContent.trim()==="or start blank")', '');
    until (Value = 'true') or (GetTickCount64 >= Deadline);
    if Value <> 'true' then raise Exception.Create('Blank project control missing.');
    MainForm.EditorBrowser.ExecuteScript('Array.from(document.querySelectorAll("button")).find(b=>b.textContent.trim()==="or start blank").click()');
    Deadline := GetTickCount64 + 10000;
    repeat
      CheckSynchronize(0); Application.ProcessMessages; Sleep(50);
      Value := MainForm.EditorBrowser.ExecuteScript('JSON.parse(localStorage.getItem("openpage-projects")||"{}").state?.projects?.length===1', '');
    until (Value = 'true') or (GetTickCount64 >= Deadline);
    if Value <> 'true' then raise Exception.Create('Synthetic project not created.');
    MainForm.EditorBrowser.ExecuteScript('(()=>{const s=JSON.parse(localStorage.getItem("openpage-projects"));s.state.projects[0].settings={deployAccessKey:"old-synthetic-deploy-key"};localStorage.setItem("openpage-projects",JSON.stringify(s));location.hash="#/";location.reload()})()');
    Deadline := GetTickCount64 + 15000;
    repeat
      CheckSynchronize(0); Application.ProcessMessages; Sleep(50);
      Value := MainForm.EditorBrowser.ExecuteScript('!!document.querySelector("button[aria-label=\"Duplicate Untitled Project\"]")', '');
    until (Value = 'true') or (GetTickCount64 >= Deadline);
    if Value <> 'true' then raise Exception.Create('Synthetic saved project missing.');
    MainForm.EditorBrowser.ExecuteScript('document.querySelector("button[aria-label=\"Duplicate Untitled Project\"]").closest(".group").click()');
    Deadline := GetTickCount64 + 10000;
    while not MainForm.EditorBrowser.LocationURL.Contains('#/editor') and (GetTickCount64 < Deadline) do begin CheckSynchronize(0); Application.ProcessMessages; Sleep(50) end;
    if not MainForm.EditorBrowser.LocationURL.Contains('#/editor') then raise Exception.Create('Synthetic project did not open.');
    MainForm.EditorBrowser.ExecuteScript('location.hash="#/settings"');
    Deadline := GetTickCount64 + 10000;
    repeat
      CheckSynchronize(0); Application.ProcessMessages; Sleep(50);
      Value := MainForm.EditorBrowser.ExecuteScript('!!Array.from(document.querySelectorAll("button")).find(b=>b.textContent.trim()==="API Keys")', '');
    until (Value = 'true') or (GetTickCount64 >= Deadline);
    if Value <> 'true' then raise Exception.Create('Settings API tab missing.');
    MainForm.EditorBrowser.ExecuteScript('Array.from(document.querySelectorAll("button")).find(b=>b.textContent.trim()==="API Keys").click()');
    Deadline := GetTickCount64 + 5000;
    repeat
      CheckSynchronize(0); Application.ProcessMessages; Sleep(50);
      Value := MainForm.EditorBrowser.ExecuteScript('document.querySelector("input[aria-label=\"Deploy Access Key\"]")?.value==="old-synthetic-deploy-key" && document.body.innerText.includes("older key is still stored in project settings")', '');
    until (Value = 'true') or (GetTickCount64 >= Deadline);
    if Value <> 'true' then raise Exception.Create('Saved synthetic deployment key or warning missing.');
    MainForm.EditorBrowser.ExecuteScript('(()=>{const e=document.querySelector("input[aria-label=\"Deploy Access Key\"]");Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(e,"new-synthetic-deploy-key");e.dispatchEvent(new Event("input",{bubbles:true}))})()');
    Deadline := GetTickCount64 + 5000;
    repeat
      CheckSynchronize(0); Application.ProcessMessages; Sleep(50);
      Value := MainForm.EditorBrowser.ExecuteScript('document.querySelector("input[aria-label=\"Deploy Access Key\"]")?.value==="new-synthetic-deploy-key" && JSON.parse(localStorage.getItem("openpage-projects")).state.projects[0].settings.deployAccessKey==="old-synthetic-deploy-key"', '');
    until (Value = 'true') or (GetTickCount64 >= Deadline);
    if Value <> 'true' then raise Exception.Create('New key changed the stored older key.');
    MainForm.EditorBrowser.ExecuteScript('Array.from(document.querySelectorAll("button")).find(b=>b.textContent.trim()==="Remove older saved deployment key").click()');
    Deadline := GetTickCount64 + 5000;
    repeat
      CheckSynchronize(0); Application.ProcessMessages; Sleep(50);
      Value := MainForm.EditorBrowser.ExecuteScript('!JSON.parse(localStorage.getItem("openpage-projects")).state.projects[0].settings.deployAccessKey && document.querySelector("input[aria-label=\"Deploy Access Key\"]")?.value==="new-synthetic-deploy-key"', '');
    until (Value = 'true') or (GetTickCount64 >= Deadline);
    if Value <> 'true' then raise Exception.Create('Explicit removal did not preserve the session deployment key.');
    Writeln('New deployment key stayed in memory; older saved key remained until explicit removal.');
  finally MainForm.Free end;
end.
