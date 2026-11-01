program DesktopCodeAccessibilitySmoke;
{$APPTYPE CONSOLE}
{$B-}
{ Run with a fresh isolated WebView profile and current editor assets. }
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
    Deadline := GetTickCount64 + 15000;
    repeat
      CheckSynchronize(0); Application.ProcessMessages; Sleep(50);
      Value := MainForm.EditorBrowser.ExecuteScript('!!document.querySelector("[aria-controls=\"editor-code-panel\"]")', '');
    until (Value = 'true') or (GetTickCount64 >= Deadline);
    if Value <> 'true' then raise Exception.Create('Code panel toggle missing.');
    Value := MainForm.EditorBrowser.ExecuteScript('document.getElementById("editor-code-panel").inert && document.querySelector("[aria-controls=\"editor-code-panel\"]").getAttribute("aria-expanded")==="false"', '');
    if Value <> 'true' then raise Exception.Create('Closed code panel remains available to keyboard or accessibility tree.');
    MainForm.EditorBrowser.ExecuteScript('document.body.dispatchEvent(new KeyboardEvent("keydown",{key:"j",bubbles:true}))');
    Deadline := GetTickCount64 + 5000;
    repeat
      CheckSynchronize(0); Application.ProcessMessages; Sleep(50);
      Value := MainForm.EditorBrowser.ExecuteScript('!document.getElementById("editor-code-panel").inert && document.querySelector("[aria-controls=\"editor-code-panel\"]").getAttribute("aria-expanded")==="true"', '');
    until (Value = 'true') or (GetTickCount64 >= Deadline);
    if Value <> 'true' then raise Exception.Create('Keyboard shortcut did not open the code panel.');
    MainForm.EditorBrowser.ExecuteScript('Array.from(document.querySelectorAll("#editor-code-panel button")).find(b=>b.textContent.trim()==="Edit").click()');
    Deadline := GetTickCount64 + 5000;
    repeat
      CheckSynchronize(0); Application.ProcessMessages; Sleep(50);
      Value := MainForm.EditorBrowser.ExecuteScript('!!document.querySelector("textarea[aria-label=\"Site configuration JSON\"]")', '');
    until (Value = 'true') or (GetTickCount64 >= Deadline);
    if Value <> 'true' then raise Exception.Create('JSON editor is not labelled.');
    MainForm.EditorBrowser.ExecuteScript('(()=>{const t=document.querySelector("textarea[aria-label=\"Site configuration JSON\"]");Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,"value").set.call(t,"{");t.dispatchEvent(new Event("input",{bubbles:true}));Array.from(document.querySelectorAll("#editor-code-panel button")).find(b=>b.textContent.trim()==="Apply").click()})()');
    Deadline := GetTickCount64 + 5000;
    repeat
      CheckSynchronize(0); Application.ProcessMessages; Sleep(50);
      Value := MainForm.EditorBrowser.ExecuteScript('document.querySelector("textarea[aria-label=\"Site configuration JSON\"]")?.getAttribute("aria-invalid")==="true" && !!document.querySelector("#site-json-error[role=alert]")', '');
    until (Value = 'true') or (GetTickCount64 >= Deadline);
    if Value <> 'true' then raise Exception.Create('JSON error is not exposed accessibly.');
    MainForm.EditorBrowser.ExecuteScript('document.querySelector("button[aria-label=\"Add page\"]").click()');
    Deadline := GetTickCount64 + 5000;
    repeat
      CheckSynchronize(0); Application.ProcessMessages; Sleep(50);
      Value := MainForm.EditorBrowser.ExecuteScript('!!document.querySelector("input[placeholder=\"About\"]")', '');
    until (Value = 'true') or (GetTickCount64 >= Deadline);
    if Value <> 'true' then raise Exception.Create('Add page control missing.');
    MainForm.EditorBrowser.ExecuteScript('(()=>{const e=document.querySelector("input[placeholder=\"About\"]");Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(e,"Newer page");e.dispatchEvent(new Event("input",{bubbles:true}))})()');
    Deadline := GetTickCount64 + 5000;
    repeat
      CheckSynchronize(0); Application.ProcessMessages; Sleep(50);
      Value := MainForm.EditorBrowser.ExecuteScript('!!Array.from(document.querySelectorAll("button")).find(b=>b.textContent.trim()==="Add Page" && !b.disabled)', '');
    until (Value = 'true') or (GetTickCount64 >= Deadline);
    if Value <> 'true' then raise Exception.Create('New page could not be prepared.');
    MainForm.EditorBrowser.ExecuteScript('Array.from(document.querySelectorAll("button")).find(b=>b.textContent.trim()==="Add Page").click()');
    Deadline := GetTickCount64 + 5000;
    repeat
      CheckSynchronize(0); Application.ProcessMessages; Sleep(50);
      Value := MainForm.EditorBrowser.ExecuteScript('document.body.innerText.includes("Newer page")', '');
    until (Value = 'true') or (GetTickCount64 >= Deadline);
    if Value <> 'true' then raise Exception.Create('Newer page was not created.');
    MainForm.EditorBrowser.ExecuteScript('Array.from(document.querySelectorAll("#editor-code-panel button")).find(b=>b.textContent.trim()==="Apply").click()');
    Deadline := GetTickCount64 + 5000;
    repeat
      CheckSynchronize(0); Application.ProcessMessages; Sleep(50);
      Value := MainForm.EditorBrowser.ExecuteScript('document.querySelector("#site-json-error")?.innerText.includes("project changed") && document.body.innerText.includes("Newer page")', '');
    until (Value = 'true') or (GetTickCount64 >= Deadline);
    if Value <> 'true' then raise Exception.Create('Stale JSON draft did not protect newer work.');
    MainForm.EditorBrowser.ExecuteScript('document.querySelector("[aria-label=\"Close code panel\"]").click()');
    Deadline := GetTickCount64 + 5000;
    repeat
      CheckSynchronize(0); Application.ProcessMessages; Sleep(50);
      Value := MainForm.EditorBrowser.ExecuteScript('document.getElementById("editor-code-panel").inert && document.activeElement?.getAttribute("aria-controls")==="editor-code-panel"', '');
    until (Value = 'true') or (GetTickCount64 >= Deadline);
    if Value <> 'true' then raise Exception.Create('Closing the code panel did not restore focus.');
    Writeln('Code panel keyboard, accessible error, stale-draft protection and close focus passed.');
  finally MainForm.Free end;
end.
