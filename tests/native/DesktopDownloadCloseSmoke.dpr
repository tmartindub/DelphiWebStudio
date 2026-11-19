program DesktopDownloadCloseSmoke;
{$APPTYPE CONSOLE}
uses
  Winapi.Windows, System.Classes, System.SysUtils, Vcl.Forms, Vcl.Edge,
  WebStudio.Main in 'WebStudio.Main.pas' {MainForm};

type
  TDownloadObserver = class
    Started: Boolean;
    procedure DownloadStarting(Sender: TCustomEdgeBrowser; Args: TDownloadStartingEventArgs);
  end;

procedure TDownloadObserver.DownloadStarting(Sender: TCustomEdgeBrowser; Args: TDownloadStartingEventArgs);
begin
  Started := True;
  MainForm.EditorBrowserDownloadStarting(Sender, Args);
end;

var Deadline: UInt64; Observer: TDownloadObserver;
begin
  Application.Initialize;
  Application.ShowMainForm := False;
  Application.CreateForm(TMainForm, MainForm);
  Observer := TDownloadObserver.Create;
  try
    Deadline := GetTickCount64 + 30000;
    while (MainForm.StatusLabel.Caption <> 'Local editor loaded.') and (GetTickCount64 < Deadline) do begin Application.ProcessMessages; Sleep(20) end;
    if MainForm.StatusLabel.Caption <> 'Local editor loaded.' then raise Exception.Create('Test page did not load.');
    if Winapi.Windows.Failed(MainForm.EditorBrowser.ControllerInterface.Set_IsVisible(1)) then raise Exception.Create('Could not activate test WebView.');
    MainForm.EditorBrowser.OnDownloadStarting := Observer.DownloadStarting;
    MainForm.EditorBrowser.ExecuteScript('(()=>{const a=document.createElement("a");a.href=URL.createObjectURL(new Blob(["test"]));a.download="webstudio-shutdown-test.txt";a.click()})()');
    Deadline := GetTickCount64 + 10000;
    while not Observer.Started and (GetTickCount64 < Deadline) do begin Application.ProcessMessages; Sleep(20) end;
    if not Observer.Started then raise Exception.Create('Test download did not start.');
    MainForm.EditorBrowser.OnDownloadStarting := nil;
    MainForm.Free;
    MainForm := nil;
    if not CheckSynchronize(0) then raise Exception.Create('The deferred download callback was not exercised.');
    Application.ProcessMessages;
    Writeln('Closing the shell before its deferred save dialog completed safely.');
  finally
    if MainForm <> nil then MainForm.Free;
    Observer.Free;
  end;
end.
