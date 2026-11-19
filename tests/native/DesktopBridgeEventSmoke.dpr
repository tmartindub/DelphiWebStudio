program DesktopBridgeEventSmoke;
{$APPTYPE CONSOLE}
uses
  Winapi.Windows, Winapi.ActiveX, Winapi.WebView2, System.SysUtils,
  Vcl.Forms, Vcl.Edge, WebStudio.Main, WebStudio.Bridge;

type
  TReceiver = class
    Session: TDesktopSession;
    Accepted, Rejected: Integer;
    SenderURL: string;
    procedure Received(Sender: TCustomEdgeBrowser; Args: TWebMessageReceivedEventArgs);
  end;

procedure TReceiver.Received(Sender: TCustomEdgeBrowser; Args: TWebMessageReceivedEventArgs);
var Source, MessageJSON: PWideChar; Request: TDesktopRequest; Response: string;
begin
  Source := nil;
  MessageJSON := nil;
  try
    if Winapi.Windows.Failed(Args.ArgsInterface.Get_Source(Source)) or (Source = nil) or
       Winapi.Windows.Failed(Args.ArgsInterface.Get_webMessageAsJson(MessageJSON)) or (MessageJSON = nil) then
      raise Exception.Create('WebView message data unavailable.');
    SenderURL := string(Source);
    try
      Request := Session.ValidateAndClaim(string(MessageJSON), SenderURL);
      Response := Format('{"version":1,"requestId":"%s","ok":true}', [Request.RequestId]);
      if Winapi.Windows.Failed(Sender.DefaultInterface.PostWebMessageAsJson(PWideChar(Response))) then
        raise Exception.Create('Test response could not be sent.');
      Inc(Accepted);
    except
      Inc(Rejected);
    end;
  finally
    CoTaskMemFree(Source);
    CoTaskMemFree(MessageJSON);
  end;
end;

var
  Receiver: TReceiver;
  Settings: ICoreWebView2Settings;
  Deadline: UInt64;
  Script: string;
begin
  Application.Initialize;
  Application.ShowMainForm := False;
  Application.CreateForm(TMainForm, MainForm);
  Receiver := TReceiver.Create;
  Receiver.Session := TDesktopSession.Create('project-1', [dcProjectSave]);
  try
    Deadline := GetTickCount64 + 30000;
    while (MainForm.StatusLabel.Caption <> 'Local editor loaded.') and (GetTickCount64 < Deadline) do begin Application.ProcessMessages; Sleep(20) end;
    if MainForm.StatusLabel.Caption <> 'Local editor loaded.' then raise Exception.Create('Test page did not load.');
    MainForm.EditorBrowser.OnWebMessageReceived := Receiver.Received;
    if Winapi.Windows.Failed(MainForm.EditorBrowser.DefaultInterface.Get_Settings(Settings)) or
      Winapi.Windows.Failed(Settings.Set_IsWebMessageEnabled(1)) then raise Exception.Create('Could not enable test messages.');
    MainForm.EditorBrowser.ExecuteScript('window.testReplies=[];window.chrome.webview.addEventListener("message",e=>window.testReplies.push(e.data))');
    Script := Format('window.chrome.webview.postMessage({version:1,requestId:"request-1",sessionId:"%s",projectId:"project-1",capability:"project.save"})', [Receiver.Session.SessionId]);
    MainForm.EditorBrowser.ExecuteScript(Script);
    Deadline := GetTickCount64 + 10000;
    while (Receiver.Accepted < 1) and (GetTickCount64 < Deadline) do begin Application.ProcessMessages; Sleep(20) end;
    if (Receiver.Accepted <> 1) or (Receiver.SenderURL <> 'https://webstudio.local/index.html') then raise Exception.Create('Trusted event was not accepted from its actual source.');
    Deadline := GetTickCount64 + 10000;
    repeat
      Application.ProcessMessages; Sleep(50);
      Script := MainForm.EditorBrowser.ExecuteScript('window.testReplies.length===1 && window.testReplies[0].requestId==="request-1" && window.testReplies[0].ok===true', '');
    until (Script = 'true') or (GetTickCount64 >= Deadline);
    if Script <> 'true' then raise Exception.Create('Trusted response was not received by the page.');
    Script := Format('window.chrome.webview.postMessage({version:1,requestId:"request-1",sessionId:"%s",projectId:"project-1",capability:"project.save"})', [Receiver.Session.SessionId]);
    MainForm.EditorBrowser.ExecuteScript(Script);
    Deadline := GetTickCount64 + 10000;
    while (Receiver.Rejected < 1) and (GetTickCount64 < Deadline) do begin Application.ProcessMessages; Sleep(20) end;
    if Receiver.Rejected <> 1 then raise Exception.Create('Repeated event was not rejected.');
    Script := Format('window.chrome.webview.postMessage({version:1,requestId:"request-2",sessionId:"%s",projectId:"project-1",capability:"media.import"})', [Receiver.Session.SessionId]);
    MainForm.EditorBrowser.ExecuteScript(Script);
    Deadline := GetTickCount64 + 10000;
    while (Receiver.Rejected < 2) and (GetTickCount64 < Deadline) do begin Application.ProcessMessages; Sleep(20) end;
    if (Receiver.Rejected <> 2) or (Receiver.Accepted <> 1) then raise Exception.Create('Ungranted event was not rejected.');
    { A same-origin blob frame can invoke its parent's channel if allowed to
      load, so the shell must cancel this navigation before enabling a bridge. }
    Script := Format('(()=>{const f=document.createElement("iframe");f.src=URL.createObjectURL(new Blob([`<script>parent.chrome.webview.postMessage({version:1,requestId:"request-frame",sessionId:"%s",projectId:"project-1",capability:"project.save"})</script>`],{type:"text/html"}));document.body.appendChild(f)})()', [Receiver.Session.SessionId]);
    MainForm.EditorBrowser.ExecuteScript(Script);
    Deadline := GetTickCount64 + 3000;
    while GetTickCount64 < Deadline do begin Application.ProcessMessages; Sleep(20) end;
    if Receiver.Accepted <> 1 then raise Exception.Create('A blob frame reached the parent channel.');
    Script := Format('(()=>{const f=document.createElement("iframe");f.srcdoc=`<script>parent.chrome.webview.postMessage({version:1,requestId:"request-srcdoc",sessionId:"%s",projectId:"project-1",capability:"project.save"})</script>`;document.body.appendChild(f)})()', [Receiver.Session.SessionId]);
    MainForm.EditorBrowser.ExecuteScript(Script);
    Deadline := GetTickCount64 + 3000;
    while GetTickCount64 < Deadline do begin Application.ProcessMessages; Sleep(20) end;
    if Receiver.Accepted <> 1 then raise Exception.Create('A srcdoc frame reached the parent channel.');
    { The isolated page exposes a synthetic session ID. A same-origin frame
      was able to call the parent before the shell blocked frame navigation. }
    Script := Format('window.testSession="%s";const f=document.createElement("iframe");f.src="https://webstudio.local/frame.html";document.body.appendChild(f)', [Receiver.Session.SessionId]);
    MainForm.EditorBrowser.ExecuteScript(Script);
    Deadline := GetTickCount64 + 3000;
    while GetTickCount64 < Deadline do begin Application.ProcessMessages; Sleep(20) end;
    if Receiver.Accepted <> 1 then raise Exception.Create('A local frame reached the parent channel.');
    Receiver.Session.Revoke;
    Script := Format('window.chrome.webview.postMessage({version:1,requestId:"request-3",sessionId:"%s",projectId:"project-1",capability:"project.save"})', [Receiver.Session.SessionId]);
    MainForm.EditorBrowser.ExecuteScript(Script);
    Deadline := GetTickCount64 + 10000;
    while (Receiver.Rejected < 3) and (GetTickCount64 < Deadline) do begin Application.ProcessMessages; Sleep(20) end;
    if (Receiver.Rejected <> 3) or (Receiver.Accepted <> 1) then raise Exception.Create('Revoked session accepted an event.');
    if MainForm.EditorBrowser.ExecuteScript('window.testReplies.length===1', '') <> 'true' then raise Exception.Create('A rejected request received a response.');
    Writeln('WebView validation and frame blocking checks passed.');
  finally
    MainForm.EditorBrowser.OnWebMessageReceived := nil;
    Receiver.Session.Revoke;
    Receiver.Session.Free;
    Receiver.Free;
    MainForm.Free;
  end;
end.
