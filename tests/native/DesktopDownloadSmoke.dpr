program DesktopDownloadSmoke;
{$APPTYPE CONSOLE}
{$IFDEF TEST_MANIFEST}{$R 'test.res'}{$ENDIF}
uses Winapi.Windows, Winapi.Messages, Winapi.ActiveX, Winapi.WebView2, Winapi.CommDlg, Winapi.CommCtrl, Winapi.Dlgs, System.SysUtils, System.Classes, System.IOUtils, Vcl.Forms, Vcl.Edge, Vcl.Dialogs, WebStudio.Main in 'WebStudio.Main.pas' {MainForm};
type TDownloadObserver = class
  Count: Integer;
  Operation: ICoreWebView2DownloadOperation;
  procedure Started(Sender: TCustomEdgeBrowser; Args: TDownloadStartingEventArgs);
  procedure DialogShown(Sender: TObject);
  procedure ConfirmShown(Sender: TObject);
end;
procedure TDownloadObserver.ConfirmShown(Sender: TObject);
begin
  PostMessage(TTaskDialog(Sender).Handle, TDM_CLICK_BUTTON, IDNO, 0);
end;
procedure TDownloadObserver.DialogShown(Sender: TObject);
var Target, RaceTarget: string; Window: HWND;
begin
  if Count = 1 then Target := ExtractFilePath(ParamStr(0)) + 'saved-project.zip'
  else if Count = 2 then Target := ExtractFilePath(ParamStr(0)) + 'exported-site.zip'
  else if Count = 3 then Target := ExtractFilePath(ParamStr(0)) + 'cancelled-project.zip'
  else if Count = 4 then Target := ExtractFilePath(ParamStr(0)) + 'saved-again.zip'
  else if Count = 5 then Target := ExtractFilePath(ParamStr(0)) + 'interrupted-test.zip'
  else if Count = 6 then Target := ExtractFilePath(ParamStr(0)) + 'saved-project.zip'
  else if Count = 7 then Target := ExtractFilePath(ParamStr(0)) + 'save-after-collision.zip'
  else if Count = 8 then Target := ExtractFilePath(ParamStr(0)) + 'interrupted-project.zip'
  else if Count = 9 then Target := ExtractFilePath(ParamStr(0)) + 'race-target.zip'
  else if Count = 10 then Target := ExtractFilePath(ParamStr(0)) + 'wrong-project.json'
  else if Count = 11 then Target := ExtractFilePath(ParamStr(0)) + 'wrong-project.zip'
  else if Count = 12 then Target := ExtractFilePath(ParamStr(0)) + 'extension-retry.zip'
  else raise Exception.Create('Unexpected dialog.');
  if (Count <> 6) and TFile.Exists(Target) then raise Exception.Create('Test output already exists.');
  Window := GetParent(TSaveDialog(Sender).Handle);
  Writeln('Dialog displayed; handle=', TSaveDialog(Sender).Handle, ' parent=', Window);
  if Count = 3 then PostMessage(Window, WM_COMMAND, IDCANCEL, 0)
  else begin
    RaceTarget := Target;
    Target := ExtractFileName(Target);
    SendMessage(Window, CDM_SETCONTROLTEXT, edt1, LPARAM(PChar(Target)));
    PostMessage(Window, WM_COMMAND, IDOK, 0);
    if Count = 9 then TThread.ForceQueue(nil,
      procedure
      begin
        if TFile.Exists(RaceTarget) then raise Exception.Create('Race target unexpectedly exists.');
        TFile.WriteAllText(RaceTarget, 'external change');
      end);
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
  if (Count = 5) or (Count = 8) then TThread.ForceQueue(nil,
    procedure
    begin
      if Operation <> nil then Operation.Cancel;
    end);
end;
var Deadline: UInt64; Value: string; Observer: TDownloadObserver; DownloadState: COREWEBVIEW2_DOWNLOAD_STATE; BeforeBytes, AfterBytes: TBytes;
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
    MainForm.ProjectSaveDialog.InitialDir := ExtractFilePath(ParamStr(0));
    MainForm.SaveDownloadDialog.OnShow := Observer.DialogShown;
    MainForm.ProjectSaveDialog.OnShow := Observer.DialogShown;
    MainForm.ReplaceConfirmDialog.OnDialogCreated := Observer.ConfirmShown;
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
    Deadline := GetTickCount64 + 10000;
    while (MainForm.StatusLabel.Caption <> 'Download completed: saved-project.zip') and (GetTickCount64 < Deadline) do begin CheckSynchronize(0); Application.ProcessMessages; Sleep(20) end;
    if MainForm.StatusLabel.Caption <> 'Download completed: saved-project.zip' then raise Exception.Create('Project download completion was not reported.');
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
    Deadline := GetTickCount64 + 10000;
    while (MainForm.StatusLabel.Caption <> 'Download completed: exported-site.zip') and (GetTickCount64 < Deadline) do begin CheckSynchronize(0); Application.ProcessMessages; Sleep(20) end;
    if MainForm.StatusLabel.Caption <> 'Download completed: exported-site.zip' then raise Exception.Create('Site download completion was not reported.');
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
    Deadline := GetTickCount64 + 10000;
    while (MainForm.StatusLabel.Caption <> 'Download completed: saved-again.zip') and (GetTickCount64 < Deadline) do begin CheckSynchronize(0); Application.ProcessMessages; Sleep(20) end;
    if MainForm.StatusLabel.Caption <> 'Download completed: saved-again.zip' then raise Exception.Create('Repeated save completion was not reported.');
    Observer.Operation := nil;
    MainForm.EditorBrowser.ExecuteScript('(()=>{const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([new Uint8Array(128*1024*1024)]));a.download="interrupted-test.zip";a.click()})()');
    Deadline := GetTickCount64 + 30000;
    while (Observer.Count < 5) and (GetTickCount64 < Deadline) do begin CheckSynchronize(0); Application.ProcessMessages; Sleep(20) end;
    if Observer.Count <> 5 then raise Exception.Create('Interrupted download did not start.');
    Deadline := GetTickCount64 + 30000;
    while (MainForm.StatusLabel.Caption <> 'Download interrupted: interrupted-test.zip. Try saving again.') and (GetTickCount64 < Deadline) do begin CheckSynchronize(0); Application.ProcessMessages; Sleep(20) end;
    if MainForm.StatusLabel.Caption <> 'Download interrupted: interrupted-test.zip. Try saving again.' then raise Exception.Create('Interrupted download was not reported.');
    BeforeBytes := TFile.ReadAllBytes(ExtractFilePath(ParamStr(0)) + 'saved-project.zip');
    Observer.Operation := nil;
    MainForm.EditorBrowser.ExecuteScript('Array.from(document.querySelectorAll("button")).find(b=>b.textContent.trim()==="Save project").click()');
    Deadline := GetTickCount64 + 30000;
    while (Observer.Count < 6) and (GetTickCount64 < Deadline) do begin CheckSynchronize(0); Application.ProcessMessages; Sleep(20) end;
    if Observer.Count <> 6 then raise Exception.Create('Collision test did not start.');
    Deadline := GetTickCount64 + 30000;
    while (MainForm.StatusLabel.Caption <> 'Replacement canceled; existing project was not changed.') and (GetTickCount64 < Deadline) do begin CheckSynchronize(0); Application.ProcessMessages; Sleep(20) end;
    if MainForm.StatusLabel.Caption <> 'Replacement canceled; existing project was not changed.' then raise Exception.Create('Replacement cancellation was not reported.');
    AfterBytes := TFile.ReadAllBytes(ExtractFilePath(ParamStr(0)) + 'saved-project.zip');
    if (Length(BeforeBytes) <> Length(AfterBytes)) or ((Length(BeforeBytes) > 0) and not CompareMem(@BeforeBytes[0], @AfterBytes[0], Length(BeforeBytes))) then raise Exception.Create('Existing project changed during collision.');
    Observer.Operation := nil;
    MainForm.EditorBrowser.ExecuteScript('Array.from(document.querySelectorAll("button")).find(b=>b.textContent.trim()==="Save project").click()');
    Deadline := GetTickCount64 + 30000;
    while (Observer.Count < 7) and (GetTickCount64 < Deadline) do begin CheckSynchronize(0); Application.ProcessMessages; Sleep(20) end;
    if Observer.Count <> 7 then raise Exception.Create('Save after collision did not start.');
    Deadline := GetTickCount64 + 30000;
    while (MainForm.StatusLabel.Caption <> 'Download completed: save-after-collision.zip') and (GetTickCount64 < Deadline) do begin CheckSynchronize(0); Application.ProcessMessages; Sleep(20) end;
    if MainForm.StatusLabel.Caption <> 'Download completed: save-after-collision.zip' then raise Exception.Create('Save after collision did not complete.');
    Observer.Operation := nil;
    MainForm.EditorBrowser.ExecuteScript('(()=>{const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([new Uint8Array(128*1024*1024)]));a.download="interrupted.webstudio.zip";a.click()})()');
    Deadline := GetTickCount64 + 30000;
    while (Observer.Count < 8) and (GetTickCount64 < Deadline) do begin CheckSynchronize(0); Application.ProcessMessages; Sleep(20) end;
    if Observer.Count <> 8 then raise Exception.Create('Interrupted project save did not start.');
    Deadline := GetTickCount64 + 30000;
    while (Pos('Project download interrupted.', MainForm.StatusLabel.Caption) <> 1) and (GetTickCount64 < Deadline) do begin CheckSynchronize(0); Application.ProcessMessages; Sleep(20) end;
    if (Pos('Project download interrupted.', MainForm.StatusLabel.Caption) <> 1) or TFile.Exists(ExtractFilePath(ParamStr(0)) + 'interrupted-project.zip') then raise Exception.Create('Interrupted project produced a final file or was not reported.');
    Observer.Operation := nil;
    MainForm.EditorBrowser.ExecuteScript('(()=>{const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([new Uint8Array(128*1024*1024)]));a.download="race.webstudio.zip";a.click()})()');
    Deadline := GetTickCount64 + 30000;
    while (Observer.Count < 9) and (GetTickCount64 < Deadline) do begin CheckSynchronize(0); Application.ProcessMessages; Sleep(20) end;
    if Observer.Count <> 9 then raise Exception.Create('Race test did not start.');
    Deadline := GetTickCount64 + 30000;
    while (Pos('Project not saved. Check staged file: ', MainForm.StatusLabel.Caption) <> 1) and (GetTickCount64 < Deadline) do begin CheckSynchronize(0); Application.ProcessMessages; Sleep(20) end;
    if Pos('Project not saved. Check staged file: ', MainForm.StatusLabel.Caption) <> 1 then raise Exception.Create('Late destination collision was not reported.');
    if TFile.ReadAllText(ExtractFilePath(ParamStr(0)) + 'race-target.zip') <> 'external change' then raise Exception.Create('Late destination collision replaced external data.');
    Value := Copy(MainForm.StatusLabel.Caption, Length('Project not saved. Check staged file: ') + 1, MaxInt);
    if not TFile.Exists(Value) or (TFile.GetSize(Value) <> 128 * 1024 * 1024) then raise Exception.Create('Staged bytes were not retained after late collision.');
    Observer.Operation := nil;
    MainForm.EditorBrowser.ExecuteScript('(()=>{const a=document.createElement("a");a.href=URL.createObjectURL(new Blob(["zip"]));a.download="test.webstudio.zip";a.click()})()');
    Deadline := GetTickCount64 + 30000;
    while (Observer.Count < 10) and (GetTickCount64 < Deadline) do begin CheckSynchronize(0); Application.ProcessMessages; Sleep(20) end;
    Deadline := GetTickCount64 + 30000;
    while (MainForm.StatusLabel.Caption <> 'Project requires the .zip extension. Save again with that extension.') and (GetTickCount64 < Deadline) do begin CheckSynchronize(0); Application.ProcessMessages; Sleep(20) end;
    if (Observer.Count <> 10) or (MainForm.StatusLabel.Caption <> 'Project requires the .zip extension. Save again with that extension.') or TFile.Exists(ExtractFilePath(ParamStr(0)) + 'wrong-project.json') then raise Exception.Create('ZIP project accepted a JSON filename.');
    Observer.Operation := nil;
    MainForm.EditorBrowser.ExecuteScript('(()=>{const a=document.createElement("a");a.href=URL.createObjectURL(new Blob(["json"]));a.download="test.webstudio.json";a.click()})()');
    Deadline := GetTickCount64 + 30000;
    while (Observer.Count < 11) and (GetTickCount64 < Deadline) do begin CheckSynchronize(0); Application.ProcessMessages; Sleep(20) end;
    Deadline := GetTickCount64 + 30000;
    while (MainForm.StatusLabel.Caption <> 'Project requires the .json extension. Save again with that extension.') and (GetTickCount64 < Deadline) do begin CheckSynchronize(0); Application.ProcessMessages; Sleep(20) end;
    if (Observer.Count <> 11) or (MainForm.StatusLabel.Caption <> 'Project requires the .json extension. Save again with that extension.') or TFile.Exists(ExtractFilePath(ParamStr(0)) + 'wrong-project.zip') then raise Exception.Create('JSON project accepted a ZIP filename.');
    Observer.Operation := nil;
    MainForm.EditorBrowser.ExecuteScript('Array.from(document.querySelectorAll("button")).find(b=>b.textContent.trim()==="Save project").click()');
    Deadline := GetTickCount64 + 30000;
    while (Observer.Count < 12) and (GetTickCount64 < Deadline) do begin CheckSynchronize(0); Application.ProcessMessages; Sleep(20) end;
    Deadline := GetTickCount64 + 30000;
    while (MainForm.StatusLabel.Caption <> 'Download completed: extension-retry.zip') and (GetTickCount64 < Deadline) do begin CheckSynchronize(0); Application.ProcessMessages; Sleep(20) end;
    if (Observer.Count <> 12) or (MainForm.StatusLabel.Caption <> 'Download completed: extension-retry.zip') then raise Exception.Create('Save after extension mismatch did not complete.');
    if not MainForm.CloseQuery then raise Exception.Create('Closing was blocked after the project save completed.');
    Writeln('Desktop project save and site export downloads completed.');
    Writeln('Desktop editor imported and rendered a sample PDF in the preview and page.');
  finally
    MainForm.EditorBrowser.OnDownloadStarting := nil;
    Observer.Free;
    MainForm.Free;
  end;
end.











