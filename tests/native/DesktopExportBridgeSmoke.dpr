program DesktopExportBridgeSmoke;
{$APPTYPE CONSOLE}

uses Winapi.Windows, System.SysUtils, Vcl.Forms,
  WebStudio.Main in '..\..\desktop\DelphiWebStudio\WebStudio.Main.pas' {MainForm};

var Deadline: UInt64; Value: string;
begin
  Application.Initialize;
  Application.ShowMainForm := False;
  Application.CreateForm(TMainForm, MainForm);
  try
    Deadline := GetTickCount64 + 30000;
    while (MainForm.StatusLabel.Caption <> 'Local editor loaded.') and (GetTickCount64 < Deadline) do begin
      Application.ProcessMessages; Sleep(20);
    end;
    if MainForm.StatusLabel.Caption <> 'Local editor loaded.' then raise Exception.Create('Local editor did not load.');
    MainForm.EditorBrowser.ExecuteScript('window.testBridgeReplies=[];window.chrome.webview.addEventListener("message",e=>window.testBridgeReplies.push(e.data));window.chrome.webview.postMessage({version:1,kind:"session.open",requestId:"open-1",projectId:"project-1",capability:"site.export"})');
    Deadline := GetTickCount64 + 10000;
    repeat
      Application.ProcessMessages; Sleep(50);
      Value := MainForm.EditorBrowser.ExecuteScript('window.testBridgeReplies.length===1 && window.testBridgeReplies[0].kind==="session.open" && window.testBridgeReplies[0].projectId==="project-1"', '');
    until (Value = 'true') or (GetTickCount64 >= Deadline);
    if Value <> 'true' then raise Exception.Create('Native export session was not returned.');
    MainForm.EditorBrowser.ExecuteScript('window.chrome.webview.postMessage({version:1,requestId:"export-1",sessionId:window.testBridgeReplies[0].sessionId,projectId:"project-1",capability:"site.export"})');
    Deadline := GetTickCount64 + 10000;
    repeat
      Application.ProcessMessages; Sleep(50);
      Value := MainForm.EditorBrowser.ExecuteScript('window.testBridgeReplies.length===2 && window.testBridgeReplies[1].requestId==="export-1" && window.testBridgeReplies[1].ok===true', '');
    until (Value = 'true') or (GetTickCount64 >= Deadline);
    if Value <> 'true' then raise Exception.Create('Native export request was not acknowledged.');
    MainForm.EditorBrowser.ExecuteScript('window.chrome.webview.postMessage({version:1,requestId:"export-1",sessionId:window.testBridgeReplies[0].sessionId,projectId:"project-1",capability:"site.export"});window.chrome.webview.postMessage({version:1,requestId:"save-1",sessionId:window.testBridgeReplies[0].sessionId,projectId:"project-1",capability:"project.save"});window.chrome.webview.postMessage({version:1,requestId:"wrong-1",sessionId:window.testBridgeReplies[0].sessionId,projectId:"other",capability:"site.export"})');
    Deadline := GetTickCount64 + 2000;
    while GetTickCount64 < Deadline do begin Application.ProcessMessages; Sleep(20) end;
    if MainForm.EditorBrowser.ExecuteScript('window.testBridgeReplies.length===2', '') <> 'true' then
      raise Exception.Create('Replay, ungranted capability, or wrong project was accepted.');
    MainForm.EditorBrowser.ExecuteScript('window.chrome.webview.postMessage({version:1,kind:"session.open",requestId:"open-2",projectId:null,capability:"project.open"})');
    Deadline := GetTickCount64 + 10000;
    repeat
      Application.ProcessMessages; Sleep(50);
      Value := MainForm.EditorBrowser.ExecuteScript('window.testBridgeReplies.length===3 && window.testBridgeReplies[2].projectId===null && window.testBridgeReplies[2].capability==="project.open"', '');
    until (Value = 'true') or (GetTickCount64 >= Deadline);
    if Value <> 'true' then raise Exception.Create('Native open session was not returned.');
    MainForm.EditorBrowser.ExecuteScript('window.chrome.webview.postMessage({version:1,requestId:"project-open-1",sessionId:window.testBridgeReplies[2].sessionId,projectId:null,capability:"project.open"})');
    Deadline := GetTickCount64 + 10000;
    repeat
      Application.ProcessMessages; Sleep(50);
      Value := MainForm.EditorBrowser.ExecuteScript('window.testBridgeReplies.length===4 && window.testBridgeReplies[3].capability==="project.open" && window.testBridgeReplies[3].ok===true', '');
    until (Value = 'true') or (GetTickCount64 >= Deadline);
    if Value <> 'true' then raise Exception.Create('Native project-open request was not acknowledged.');
    Writeln('Native export bridge accepted the allowed request and rejected invalid requests.');
  finally MainForm.Free end;
end.
