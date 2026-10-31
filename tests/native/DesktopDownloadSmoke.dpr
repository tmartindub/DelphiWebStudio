program DesktopDownloadSmoke;
{$APPTYPE CONSOLE}
uses Winapi.Windows, Winapi.Messages, Winapi.ActiveX, Winapi.WebView2, Winapi.CommDlg, Winapi.Dlgs, System.SysUtils, System.Classes, System.IOUtils, Vcl.Forms, Vcl.Edge, Vcl.Dialogs, WebStudio.Main in 'WebStudio.Main.pas' {MainForm};
type TDownloadObserver = class
  Count: Integer;
  Operation: ICoreWebView2DownloadOperation;
  procedure Started(Sender: TCustomEdgeBrowser; Args: TDownloadStartingEventArgs);
  procedure DialogShown(Sender: TObject);
end;
procedure TDownloadObserver.DialogShown(Sender: TObject);
var Target: string; Window: HWND;
begin
  if Count = 1 then Target := ExtractFilePath(ParamStr(0)) + 'saved-project.zip'
  else if Count = 2 then Target := ExtractFilePath(ParamStr(0)) + 'exported-site.zip'
  else if Count = 3 then Target := ExtractFilePath(ParamStr(0)) + 'cancelled-project.zip'
  else if Count = 4 then Target := ExtractFilePath(ParamStr(0)) + 'saved-again.zip'
  else raise Exception.Create('Unexpected dialog.');
  if TFile.Exists(Target) then raise Exception.Create('Test output already exists.');
  Window := GetParent(TSaveDialog(Sender).Handle);
  Writeln('Dialog displayed; handle=', TSaveDialog(Sender).Handle, ' parent=', Window);
  if Count = 3 then PostMessage(Window, WM_COMMAND, IDCANCEL, 0)
  else begin
    Target := ExtractFileName(Target);
    SendMessage(Window, CDM_SETCONTROLTEXT, edt1, LPARAM(PChar(Target)));
    PostMessage(Window, WM_COMMAND, IDOK, 0);
  end;
end;
procedure TDownloadObserver.Started(Sender: TCustomEdgeBrowser; Args: TDownloadStartingEventArgs);
var Address: PWideChar;
begin
  Address := nil;
  try
    if Succeeded(Args.ArgsInterface.Get_DownloadOperation(Operation)) and (Operation <> nil) and Succeeded(Operation.Get_uri(Address)) then Writeln('Download URI: ', string(Address));
  finally CoTaskMemFree(Address) end;
  Inc(Count);
  MainForm.EditorBrowserDownloadStarting(Sender, Args);
end;
var Deadline: UInt64; Value: string; Observer: TDownloadObserver; DownloadState: COREWEBVIEW2_DOWNLOAD_STATE;
begin
  Application.Initialize;
  Application.ShowMainForm := False;
  Application.CreateForm(TMainForm, MainForm);
  Observer := TDownloadObserver.Create;
  try
    MainForm.EditorBrowser.CapturePreview(ExtractFilePath(ParamStr(0)) + 'pdf-object.png');
    Deadline := GetTickCount64 + 45000;
    while (MainForm.StatusLabel.Caption <> 'Local editor loaded.') and (GetTickCount64 < Deadline) do begin CheckSynchronize(0); Application.ProcessMessages; Sleep(20) end;
    if MainForm.StatusLabel.Caption <> 'Local editor loaded.' then raise Exception.Create('Editor did not load.');
    if Winapi.Windows.Failed(MainForm.EditorBrowser.ControllerInterface.Set_IsVisible(1)) then raise Exception.Create('Could not activate test WebView.');
    MainForm.EditorBrowser.OnDownloadStarting := Observer.Started;
    MainForm.SaveDownloadDialog.InitialDir := ExtractFilePath(ParamStr(0));
    MainForm.SaveDownloadDialog.OnShow := Observer.DialogShown;
    Deadline := GetTickCount64 + 15000;
    repeat
      CheckSynchronize(0); Application.ProcessMessages; Sleep(100);
      Value := MainForm.EditorBrowser.ExecuteScript('!!Array.from(document.querySelectorAll("button")).find(b => b.textContent.includes("Connect a community or club"))', '');
    until (Value = 'true') or (GetTickCount64 >= Deadline);
    if Value <> 'true' then raise Exception.Create('Community starter not found: ' + MainForm.EditorBrowser.ExecuteScript('document.body.innerText.slice(0,1000)', ''));
    MainForm.EditorBrowser.ExecuteScript('window.testInline=0;window.testData=0;window.testBlob=0;window.policyBlocks=0;document.addEventListener("securitypolicyviolation",()=>window.policyBlocks++);const a=document.createElement("script");a.textContent="window.testInline=1";document.head.appendChild(a);const b=document.createElement("script");b.src="data:text/javascript,window.testData%3D1";document.head.appendChild(b);const c=document.createElement("script");c.src=URL.createObjectURL(new Blob(["window.testBlob=1"],{type:"text/javascript"}));document.head.appendChild(c);const d=document.createElement("script");d.src="https://example.invalid/test.js";document.head.appendChild(d)');
    Deadline := GetTickCount64 + 5000;
    repeat
      CheckSynchronize(0); Application.ProcessMessages; Sleep(50);
      Value := MainForm.EditorBrowser.ExecuteScript('window.policyBlocks>=4 && window.testInline===0 && window.testData===0 && window.testBlob===0', '');
    until (Value = 'true') or (GetTickCount64 >= Deadline);
    if Value <> 'true' then raise Exception.Create('Desktop script policy did not block the test scripts.');
    MainForm.EditorBrowser.ExecuteScript('Array.from(document.querySelectorAll("button")).find(b => b.textContent.includes("Connect a community or club")).click()');
    Deadline := GetTickCount64 + 10000;
    repeat
      CheckSynchronize(0); Application.ProcessMessages; Sleep(50);
      Value := MainForm.EditorBrowser.ExecuteScript('!!Array.from(document.querySelectorAll("button")).find(b => b.textContent.trim() === "Media")', '');
    until (Value = 'true') or (GetTickCount64 >= Deadline);
    if Value <> 'true' then raise Exception.Create('Editor media tab not found.');
    MainForm.EditorBrowser.ExecuteScript('Array.from(document.querySelectorAll("button")).find(b => b.textContent.trim() === "Media").click()');
    Deadline := GetTickCount64 + 10000;
    repeat
      CheckSynchronize(0); Application.ProcessMessages; Sleep(50);
      Value := MainForm.EditorBrowser.ExecuteScript('!!document.querySelector("input[aria-label=\"Import media files\"]")', '');
    until (Value = 'true') or (GetTickCount64 >= Deadline);
    if Value <> 'true' then raise Exception.Create('Media file input not found.');
    MainForm.EditorBrowser.ExecuteScript('fetch("/proof.pdf").then(r=>r.blob()).then(b=>{const input=document.querySelector("input[aria-label=\"Import media files\"]"); const dt=new DataTransfer(); dt.items.add(new File([b],"proof.pdf",{type:"application/pdf"})); input.files=dt.files; input.dispatchEvent(new Event("change",{bubbles:true}));})');
    Deadline := GetTickCount64 + 30000;
    repeat
      CheckSynchronize(0); Application.ProcessMessages; Sleep(100);
      Value := MainForm.EditorBrowser.ExecuteScript('!!Array.from(document.querySelectorAll("button")).find(b=>b.textContent.trim()==="Preview PDF")', '');
    until (Value = 'true') or (GetTickCount64 >= Deadline);
    if Value <> 'true' then raise Exception.Create('PDF did not import: ' + MainForm.EditorBrowser.ExecuteScript('document.body.innerText', ''));
    MainForm.EditorBrowser.ExecuteScript('Array.from(document.querySelectorAll("button")).find(b=>b.textContent.trim()==="Preview PDF").click()');
    Deadline := GetTickCount64 + 30000;
    repeat
      CheckSynchronize(0); Application.ProcessMessages; Sleep(100);
      Value := MainForm.EditorBrowser.ExecuteScript('(()=>{const d=document.querySelector("[aria-label=\"PDF preview: proof.pdf\"]"); const c=d?.querySelector("canvas"); return !!(d && c && /Page 1 of [1-9]/.test(d.innerText) && c.toDataURL().length > 10000)})()', '');
    until (Value = 'true') or (GetTickCount64 >= Deadline);
    if Value <> 'true' then raise Exception.Create('PDF preview did not render: ' + MainForm.EditorBrowser.ExecuteScript('document.body.innerText', ''));
    MainForm.EditorBrowser.ExecuteScript('document.querySelector("[aria-label=\"PDF preview: proof.pdf\"] button:last-of-type").click()');
    Deadline := GetTickCount64 + 10000;
    repeat
      CheckSynchronize(0); Application.ProcessMessages; Sleep(100);
      Value := MainForm.EditorBrowser.ExecuteScript('!document.querySelector("[aria-label=\"PDF preview: proof.pdf\"]")', '');
    until (Value = 'true') or (GetTickCount64 >= Deadline);
    if Value <> 'true' then raise Exception.Create('Preview did not close');
    MainForm.EditorBrowser.ExecuteScript('Array.from(document.querySelectorAll("button")).find(b=>b.textContent.trim()==="Add to page").click()');
    Deadline := GetTickCount64 + 10000;
    repeat
      CheckSynchronize(0); Application.ProcessMessages; Sleep(100);
      Value := MainForm.EditorBrowser.ExecuteScript('!!document.querySelector("canvas[aria-label=\"Page 1 of proof.pdf\"]")', '');
    until (Value = 'true') or (GetTickCount64 >= Deadline);
    MainForm.EditorBrowser.ExecuteScript('document.querySelector("canvas[aria-label=\"Page 1 of proof.pdf\"]")?.scrollIntoView({block:"center"})');
    MainForm.EditorBrowser.CapturePreview(ExtractFilePath(ParamStr(0)) + 'pdf-object.png');
    Deadline := GetTickCount64 + 45000;
    repeat
      CheckSynchronize(0); Application.ProcessMessages; Sleep(100);
      Value := MainForm.EditorBrowser.ExecuteScript('document.querySelector("canvas[aria-label=\"Page 1 of proof.pdf\"]")?.getAttribute("data-rendered") === "true"', '');
    until (Value = 'true') or (GetTickCount64 >= Deadline);
    MainForm.EditorBrowser.ExecuteScript('document.querySelector("canvas[aria-label=\"Page 1 of proof.pdf\"]")?.scrollIntoView({block:"center"})');
    Deadline := GetTickCount64 + 2000;
    while GetTickCount64 < Deadline do begin CheckSynchronize(0); Application.ProcessMessages; Sleep(20) end;
    MainForm.EditorBrowser.CapturePreview(ExtractFilePath(ParamStr(0)) + 'pdf-object.png');
    Deadline := GetTickCount64 + 3000;
    while GetTickCount64 < Deadline do begin CheckSynchronize(0); Application.ProcessMessages; Sleep(20) end;
    Value := MainForm.EditorBrowser.ExecuteScript('document.querySelector("canvas[aria-label=\"Page 1 of proof.pdf\"]")?.getAttribute("data-rendered") === "true"', '');
    if Value <> 'true' then raise Exception.Create('Inline PDF did not render: ' + MainForm.EditorBrowser.ExecuteScript('JSON.stringify(Array.from(document.querySelectorAll("canvas")).map(c=>({label:c.getAttribute("aria-label"),rendered:c.getAttribute("data-rendered"),len:c.toDataURL().length,text:c.closest("section")?.innerText})))', ''));
    Value := MainForm.EditorBrowser.ExecuteScript('document.querySelector("canvas[aria-label=\"Page 1 of proof.pdf\"]").toDataURL().length', '');
    if StrToIntDef(Value, 0) <= 10000 then raise Exception.Create('Inline PDF canvas was blank.');
    MainForm.EditorBrowser.ExecuteScript('(()=>{const c=document.querySelector("canvas[aria-label=\"Page 1 of proof.pdf\"]");window.initialPdfWidth=c.width;c.closest("section").querySelector("button[aria-label=\"Zoom in\"]").click()})()');
    Deadline := GetTickCount64 + 45000;
    repeat
      CheckSynchronize(0); Application.ProcessMessages; Sleep(100);
      Value := MainForm.EditorBrowser.ExecuteScript('(()=>{const c=document.querySelector("canvas[aria-label=\"Page 1 of proof.pdf\"]");return c?.getAttribute("data-rendered")==="true" && c.width > window.initialPdfWidth && c.closest("section").innerText.includes("Fit 125%")})()', '');
    until (Value = 'true') or (GetTickCount64 >= Deadline);
    if Value <> 'true' then raise Exception.Create('Desktop PDF zoom did not complete: ' + MainForm.EditorBrowser.ExecuteScript('(()=>{const c=document.querySelector("canvas[aria-label=\"Page 1 of proof.pdf\"]");return JSON.stringify({rendered:c?.getAttribute("data-rendered"),width:c?.width,initial:window.initialPdfWidth,text:c?.closest("section")?.innerText})})()', ''));
    Writeln('Desktop PDF zoom passed.');
    MainForm.EditorBrowser.ExecuteScript('(()=>{const c=document.querySelector("canvas[aria-label=\"Page 1 of proof.pdf\"]");const section=c.closest("section"), input=section.querySelector("input[aria-label=\"Search PDF text\"]");Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(input,"neighbors");input.dispatchEvent(new Event("input",{bubbles:true}));})()');
    Deadline := GetTickCount64 + 10000;
    repeat
      CheckSynchronize(0); Application.ProcessMessages; Sleep(100);
      Value := MainForm.EditorBrowser.ExecuteScript('(()=>{const c=document.querySelector("canvas[aria-label=\"Page 1 of proof.pdf\"]");const s=c.closest("section");return Array.from(s.querySelectorAll("button")).some(b=>b.textContent.trim()==="Search" && !b.disabled)})()', '');
    until (Value = 'true') or (GetTickCount64 >= Deadline);
    if Value <> 'true' then raise Exception.Create('PDF search input did not update.');
    MainForm.EditorBrowser.ExecuteScript('(()=>{const c=document.querySelector("canvas[aria-label=\"Page 1 of proof.pdf\"]");Array.from(c.closest("section").querySelectorAll("button")).find(b=>b.textContent.trim()==="Search").click()})()');
    Deadline := GetTickCount64 + 30000;
    repeat
      CheckSynchronize(0); Application.ProcessMessages; Sleep(100);
      Value := MainForm.EditorBrowser.ExecuteScript('document.querySelector("canvas[aria-label=\"Page 1 of proof.pdf\"]")?.closest("section").innerText.includes("Found on page 1.")', '');
    until (Value = 'true') or (GetTickCount64 >= Deadline);
    if Value <> 'true' then raise Exception.Create('Desktop PDF search did not find sample text.');
    Writeln('Desktop PDF search passed.');
    MainForm.EditorBrowser.ExecuteScript('Array.from(document.querySelectorAll("button")).find(b=>b.textContent.trim()==="Save project").click()');
    Deadline := GetTickCount64 + 30000;
    while (Observer.Count < 1) and (GetTickCount64 < Deadline) do begin CheckSynchronize(0); Application.ProcessMessages; Sleep(20) end;
    if Observer.Count <> 1 then raise Exception.Create('Project save download did not start.');
    Deadline := GetTickCount64 + 30000;
    repeat
      CheckSynchronize(0); Application.ProcessMessages; Sleep(50);
      if Winapi.Windows.Failed(Observer.Operation.Get_State(DownloadState)) then raise Exception.Create('Could not inspect project download.');
    until (DownloadState <> COREWEBVIEW2_DOWNLOAD_STATE_IN_PROGRESS) or (GetTickCount64 >= Deadline);
    if DownloadState <> COREWEBVIEW2_DOWNLOAD_STATE_COMPLETED then raise Exception.Create('Project download did not complete.');
    Observer.Operation := nil;
    MainForm.EditorBrowser.ExecuteScript('window.testToasts=[];new MutationObserver(()=>{document.querySelectorAll("[data-sonner-toast]").forEach(e=>window.testToasts.push(e.innerText))}).observe(document.body,{childList:true,subtree:true})');
    MainForm.EditorBrowser.ExecuteScript('Array.from(document.querySelectorAll("button")).find(b=>b.textContent.trim()==="Export").click()');
    Deadline := GetTickCount64 + 30000;
    while (Observer.Count < 2) and (GetTickCount64 < Deadline) do begin CheckSynchronize(0); Application.ProcessMessages; Sleep(20) end;
    if Observer.Count <> 2 then raise Exception.Create('Site export download did not start: ' + MainForm.EditorBrowser.ExecuteScript('JSON.stringify(window.testToasts)', ''));
    Deadline := GetTickCount64 + 30000;
    repeat
      CheckSynchronize(0); Application.ProcessMessages; Sleep(50);
      if Winapi.Windows.Failed(Observer.Operation.Get_State(DownloadState)) then raise Exception.Create('Could not inspect site download.');
    until (DownloadState <> COREWEBVIEW2_DOWNLOAD_STATE_IN_PROGRESS) or (GetTickCount64 >= Deadline);
    if DownloadState <> COREWEBVIEW2_DOWNLOAD_STATE_COMPLETED then raise Exception.Create('Site export download did not complete.');
    Observer.Operation := nil;
    MainForm.EditorBrowser.ExecuteScript('Array.from(document.querySelectorAll("button")).find(b=>b.textContent.trim()==="Save project").click()');
    Deadline := GetTickCount64 + 30000;
    while (Observer.Count < 3) and (GetTickCount64 < Deadline) do begin CheckSynchronize(0); Application.ProcessMessages; Sleep(20) end;
    if Observer.Count <> 3 then raise Exception.Create('Cancel test download did not start.');
    Deadline := GetTickCount64 + 30000;
    repeat
      CheckSynchronize(0); Application.ProcessMessages; Sleep(50);
      if Winapi.Windows.Failed(Observer.Operation.Get_State(DownloadState)) then raise Exception.Create('Could not inspect cancelled download.');
    until (DownloadState <> COREWEBVIEW2_DOWNLOAD_STATE_IN_PROGRESS) or (GetTickCount64 >= Deadline);
    if (DownloadState <> COREWEBVIEW2_DOWNLOAD_STATE_INTERRUPTED) or TFile.Exists(ExtractFilePath(ParamStr(0)) + 'cancelled-project.zip') then raise Exception.Create('Cancelled download was not safely interrupted.');
    if MainForm.StatusLabel.Caption <> 'Download canceled.' then raise Exception.Create('Cancellation was not reported in the shell.');
    Observer.Operation := nil;
    MainForm.EditorBrowser.ExecuteScript('Array.from(document.querySelectorAll("button")).find(b=>b.textContent.trim()==="Save project").click()');
    Deadline := GetTickCount64 + 30000;
    while (Observer.Count < 4) and (GetTickCount64 < Deadline) do begin CheckSynchronize(0); Application.ProcessMessages; Sleep(20) end;
    if Observer.Count <> 4 then raise Exception.Create('Save after cancellation did not start.');
    Deadline := GetTickCount64 + 30000;
    repeat
      CheckSynchronize(0); Application.ProcessMessages; Sleep(50);
      if Winapi.Windows.Failed(Observer.Operation.Get_State(DownloadState)) then raise Exception.Create('Could not inspect save after cancellation.');
    until (DownloadState <> COREWEBVIEW2_DOWNLOAD_STATE_IN_PROGRESS) or (GetTickCount64 >= Deadline);
    if DownloadState <> COREWEBVIEW2_DOWNLOAD_STATE_COMPLETED then raise Exception.Create('Save after cancellation did not complete.');
    Writeln('Desktop project save and site export downloads completed.');
    Writeln('Desktop editor imported and rendered a sample PDF in the preview and page.');
  finally
    MainForm.EditorBrowser.OnDownloadStarting := nil;
    Observer.Free;
    MainForm.Free;
  end;
end.











