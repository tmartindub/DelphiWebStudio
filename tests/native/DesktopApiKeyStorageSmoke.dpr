program DesktopApiKeyStorageSmoke;
{$APPTYPE CONSOLE}
{$B-}
{ Uses only fictional keys in an isolated WebView profile; no network requests. }
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
    MainForm.EditorBrowser.ExecuteScript('localStorage.setItem("openpage-gemini-key","old-synthetic-key");location.hash="#/settings"');
    Deadline := GetTickCount64 + 15000;
    repeat
      CheckSynchronize(0); Application.ProcessMessages; Sleep(50);
      Value := MainForm.EditorBrowser.ExecuteScript('!!Array.from(document.querySelectorAll("button")).find(b=>b.textContent.trim()==="API Keys")', '');
    until (Value = 'true') or (GetTickCount64 >= Deadline);
    if Value <> 'true' then raise Exception.Create('Settings API tab missing.');
    MainForm.EditorBrowser.ExecuteScript('Array.from(document.querySelectorAll("button")).find(b=>b.textContent.trim()==="API Keys").click()');
    Deadline := GetTickCount64 + 10000;
    repeat
      CheckSynchronize(0); Application.ProcessMessages; Sleep(50);
      Value := MainForm.EditorBrowser.ExecuteScript('document.querySelector("input[placeholder=\"AIza...\"]")?.value === "old-synthetic-key" && document.body.innerText.includes("older key is still stored")', '');
    until (Value = 'true') or (GetTickCount64 >= Deadline);
    if Value <> 'true' then raise Exception.Create('Existing synthetic key or warning missing.');
    Value := MainForm.EditorBrowser.ExecuteScript('document.querySelector("input[type=checkbox]")?.checked === false', '');
    if Value <> 'true' then raise Exception.Create('Cloud generation was not off by default.');
    MainForm.EditorBrowser.ExecuteScript('document.querySelector("input[type=checkbox]").click()');
    Deadline := GetTickCount64 + 5000;
    repeat
      CheckSynchronize(0); Application.ProcessMessages; Sleep(50);
      Value := MainForm.EditorBrowser.ExecuteScript('document.querySelector("input[type=checkbox]")?.checked === true', '');
    until (Value = 'true') or (GetTickCount64 >= Deadline);
    if Value <> 'true' then raise Exception.Create('Cloud generation opt-in did not apply.');
    MainForm.EditorBrowser.ExecuteScript('(()=>{const e=document.querySelector("input[placeholder=\"AIza...\"]");Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(e,"new-synthetic-key");e.dispatchEvent(new Event("input",{bubbles:true}))})()');
    Deadline := GetTickCount64 + 5000;
    repeat
      CheckSynchronize(0); Application.ProcessMessages; Sleep(50);
      Value := MainForm.EditorBrowser.ExecuteScript('document.querySelector("input[placeholder=\"AIza...\"]")?.value === "new-synthetic-key" && localStorage.getItem("openpage-gemini-key") === "old-synthetic-key"', '');
    until (Value = 'true') or (GetTickCount64 >= Deadline);
    if Value <> 'true' then raise Exception.Create('New key changed the stored legacy key.');
    MainForm.EditorBrowser.ExecuteScript('Array.from(document.querySelectorAll("button")).find(b=>b.textContent.trim()==="Remove older saved key").click()');
    Deadline := GetTickCount64 + 5000;
    repeat
      CheckSynchronize(0); Application.ProcessMessages; Sleep(50);
      Value := MainForm.EditorBrowser.ExecuteScript('localStorage.getItem("openpage-gemini-key") === null && document.querySelector("input[placeholder=\"AIza...\"]")?.value === "new-synthetic-key"', '');
    until (Value = 'true') or (GetTickCount64 >= Deadline);
    if Value <> 'true' then raise Exception.Create('Explicit removal did not preserve the current session key.');
    MainForm.EditorBrowser.ExecuteScript('location.reload()');
    Deadline := GetTickCount64 + 15000;
    repeat
      CheckSynchronize(0); Application.ProcessMessages; Sleep(50);
      Value := MainForm.EditorBrowser.ExecuteScript('!!Array.from(document.querySelectorAll("button")).find(b=>b.textContent.trim()==="API Keys")', '');
    until (Value = 'true') or (GetTickCount64 >= Deadline);
    if Value <> 'true' then raise Exception.Create('Settings did not reload.');
    MainForm.EditorBrowser.ExecuteScript('Array.from(document.querySelectorAll("button")).find(b=>b.textContent.trim()==="API Keys").click()');
    Deadline := GetTickCount64 + 5000;
    repeat
      CheckSynchronize(0); Application.ProcessMessages; Sleep(50);
      Value := MainForm.EditorBrowser.ExecuteScript('document.querySelector("input[placeholder=\"AIza...\"]")?.value === "" && localStorage.getItem("openpage-gemini-key") === null && document.querySelector("input[type=checkbox]")?.checked === false', '');
    until (Value = 'true') or (GetTickCount64 >= Deadline);
    if Value <> 'true' then raise Exception.Create('Session key or cloud opt-in survived reload.');
    Writeln('Cloud opt-in defaults off and resets; synthetic key storage behaved as expected.');
  finally MainForm.Free end;
end.
