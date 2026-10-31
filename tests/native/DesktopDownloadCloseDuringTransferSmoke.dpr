program DesktopDownloadCloseDuringTransferSmoke;
{$APPTYPE CONSOLE}
uses
  Winapi.Windows, Winapi.Messages, Winapi.WebView2, Winapi.CommDlg, Winapi.Dlgs,
  System.Classes, System.SysUtils, System.IOUtils, Vcl.Forms, Vcl.Edge, Vcl.Dialogs,
  WebStudio.Main in 'WebStudio.Main.pas' {MainForm};

type
  TDownloadObserver = class
    Operation: ICoreWebView2DownloadOperation;
    DialogShownOnce: Boolean;
    procedure DialogShown(Sender: TObject);
    procedure DownloadStarting(Sender: TCustomEdgeBrowser; Args: TDownloadStartingEventArgs);
  end;

procedure TDownloadObserver.DialogShown(Sender: TObject);
var Window: HWND; Target: string;
begin
  Target := TPath.Combine(ExtractFilePath(ParamStr(0)), 'shutdown-transfer-test.zip');
  if TFile.Exists(Target) then raise Exception.Create('Test destination already exists.');
  Window := GetParent(TSaveDialog(Sender).Handle);
  SendMessage(Window, CDM_SETCONTROLTEXT, edt1, LPARAM(PChar(ExtractFileName(Target))));
  DialogShownOnce := True;
  PostMessage(Window, WM_COMMAND, IDOK, 0);
end;

procedure TDownloadObserver.DownloadStarting(Sender: TCustomEdgeBrowser; Args: TDownloadStartingEventArgs);
begin
  if Winapi.Windows.Failed(Args.ArgsInterface.Get_DownloadOperation(Operation)) or (Operation = nil) then
    raise Exception.Create('Could not inspect the test download.');
  MainForm.EditorBrowserDownloadStarting(Sender, Args);
end;

var Deadline: UInt64; Observer: TDownloadObserver; State: COREWEBVIEW2_DOWNLOAD_STATE; LastGood: string;
begin
  LastGood := TPath.Combine(ExtractFilePath(ParamStr(0)), 'last-good-project.webstudio.json');
  if TFile.Exists(LastGood) then raise Exception.Create('Last-good test file already exists.');
  TFile.WriteAllText(LastGood, 'last good project');
  Application.Initialize;
  Application.ShowMainForm := False;
  Application.CreateForm(TMainForm, MainForm);
  Observer := TDownloadObserver.Create;
  try
    Deadline := GetTickCount64 + 30000;
    while (MainForm.StatusLabel.Caption <> 'Local editor loaded.') and (GetTickCount64 < Deadline) do begin CheckSynchronize(0); Application.ProcessMessages; Sleep(20) end;
    if MainForm.StatusLabel.Caption <> 'Local editor loaded.' then raise Exception.Create('Test page did not load.');
    if Winapi.Windows.Failed(MainForm.EditorBrowser.ControllerInterface.Set_IsVisible(1)) then raise Exception.Create('Could not activate test WebView.');
    MainForm.SaveDownloadDialog.InitialDir := ExtractFilePath(ParamStr(0));
    MainForm.SaveDownloadDialog.OnShow := Observer.DialogShown;
    MainForm.EditorBrowser.OnDownloadStarting := Observer.DownloadStarting;
    MainForm.EditorBrowser.ExecuteScript('(()=>{const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([new Uint8Array(128*1024*1024)]));a.download="shutdown-transfer-test.webstudio.zip";a.click()})()');
    Deadline := GetTickCount64 + 30000;
    while not Observer.DialogShownOnce and (GetTickCount64 < Deadline) do begin CheckSynchronize(0); Application.ProcessMessages; Sleep(20) end;
    if not Observer.DialogShownOnce then raise Exception.Create('The save dialog did not open.');
    if Winapi.Windows.Failed(Observer.Operation.Get_State(State)) or (State <> COREWEBVIEW2_DOWNLOAD_STATE_IN_PROGRESS) then raise Exception.Create('The download had finished before the shell closed.');
    if MainForm.CloseQuery then raise Exception.Create('The first close was not blocked during a project save.');
    if Pos('A save is in progress.', MainForm.StatusLabel.Caption) <> 1 then raise Exception.Create('The close warning was not shown.');
    MainForm.StatusLabel.Caption := 'Another status update';
    if MainForm.CloseQuery then raise Exception.Create('A replaced warning did not cause another close warning.');
    if not MainForm.CloseQuery then raise Exception.Create('An explicit second close was not allowed.');
    MainForm.Free;
    MainForm := nil;
    State := COREWEBVIEW2_DOWNLOAD_STATE_IN_PROGRESS;
    Deadline := GetTickCount64 + 10000;
    repeat
      CheckSynchronize(0); Application.ProcessMessages; Sleep(20);
      if Winapi.Windows.Failed(Observer.Operation.Get_State(State)) then Break;
    until (State <> COREWEBVIEW2_DOWNLOAD_STATE_IN_PROGRESS) or (GetTickCount64 >= Deadline);
    if State = COREWEBVIEW2_DOWNLOAD_STATE_IN_PROGRESS then Observer.Operation.Cancel;
    Deadline := GetTickCount64 + 2000;
    while GetTickCount64 < Deadline do begin CheckSynchronize(0); Application.ProcessMessages; Sleep(20) end;
    if TFile.ReadAllText(LastGood) <> 'last good project' then raise Exception.Create('Last-good project changed during shutdown.');
    Writeln('Staged files remaining: ', Length(TDirectory.GetFiles(ExtractFilePath(ParamStr(0)), '.webstudio-download-*.tmp')));
    Writeln('Shell closed during an active staged project download; the last-good project remained unchanged.');
  finally
    if MainForm <> nil then MainForm.Free;
    Observer.Free;
  end;
end.
