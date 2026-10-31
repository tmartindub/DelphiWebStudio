program DesktopSaveTerminationSmoke;
{$APPTYPE CONSOLE}
uses
  Winapi.Windows, Winapi.Messages, Winapi.WebView2, Winapi.CommDlg, Winapi.Dlgs,
  System.Classes, System.SysUtils, System.IOUtils, Vcl.Forms, Vcl.Edge, Vcl.Dialogs,
  WebStudio.Main in 'WebStudio.Main.pas' {MainForm};

type
  TDownloadObserver = class
    Operation: ICoreWebView2DownloadOperation;
    DialogShown: Boolean;
    procedure SaveShown(Sender: TObject);
    procedure DownloadStarting(Sender: TCustomEdgeBrowser; Args: TDownloadStartingEventArgs);
  end;

procedure TDownloadObserver.SaveShown(Sender: TObject);
var Window: HWND; Target: string;
begin
  Target := TPath.Combine(ExtractFilePath(ParamStr(0)), 'new-project.webstudio.zip');
  if TFile.Exists(Target) then raise Exception.Create('Test destination already exists.');
  Window := GetParent(TSaveDialog(Sender).Handle);
  SendMessage(Window, CDM_SETCONTROLTEXT, edt1, LPARAM(PChar(ExtractFileName(Target))));
  DialogShown := True;
  PostMessage(Window, WM_COMMAND, IDOK, 0);
end;

procedure TDownloadObserver.DownloadStarting(Sender: TCustomEdgeBrowser; Args: TDownloadStartingEventArgs);
begin
  if Winapi.Windows.Failed(Args.ArgsInterface.Get_DownloadOperation(Operation)) or (Operation = nil) then
    raise Exception.Create('Could not inspect the test download.');
  MainForm.EditorBrowserDownloadStarting(Sender, Args);
end;

var Deadline: UInt64; Observer: TDownloadObserver; State: COREWEBVIEW2_DOWNLOAD_STATE; Folder, LastGood, Marker: string;
begin
  Folder := ExtractFilePath(ParamStr(0));
  LastGood := TPath.Combine(Folder, 'last-good-project.webstudio.json');
  Marker := TPath.Combine(Folder, 'termination-ready.txt');
  if TFile.Exists(LastGood) or TFile.Exists(Marker) then raise Exception.Create('Test files already exist.');
  TFile.WriteAllText(LastGood, 'last good project');
  Application.Initialize;
  Application.ShowMainForm := False;
  Application.CreateForm(TMainForm, MainForm);
  Observer := TDownloadObserver.Create;
  Deadline := GetTickCount64 + 30000;
  while (MainForm.StatusLabel.Caption <> 'Local editor loaded.') and (GetTickCount64 < Deadline) do begin CheckSynchronize(0); Application.ProcessMessages; Sleep(20) end;
  if MainForm.StatusLabel.Caption <> 'Local editor loaded.' then raise Exception.Create('Test editor did not load.');
  if Winapi.Windows.Failed(MainForm.EditorBrowser.ControllerInterface.Set_IsVisible(1)) then raise Exception.Create('Could not activate test WebView.');
  MainForm.SaveDownloadDialog.InitialDir := Folder;
  MainForm.SaveDownloadDialog.OnShow := Observer.SaveShown;
  MainForm.EditorBrowser.OnDownloadStarting := Observer.DownloadStarting;
  MainForm.EditorBrowser.ExecuteScript('(()=>{const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([new Uint8Array(128*1024*1024)]));a.download="termination-test.webstudio.zip";a.click()})()');
  Deadline := GetTickCount64 + 30000;
  while not Observer.DialogShown and (GetTickCount64 < Deadline) do begin CheckSynchronize(0); Application.ProcessMessages; Sleep(20) end;
  if not Observer.DialogShown then raise Exception.Create('The save dialog did not open.');
  if Winapi.Windows.Failed(Observer.Operation.Get_State(State)) or (State <> COREWEBVIEW2_DOWNLOAD_STATE_IN_PROGRESS) then raise Exception.Create('The download finished before termination.');
  TFile.WriteAllText(Marker, 'active project download');
  TerminateProcess(GetCurrentProcess, 91);
end.
