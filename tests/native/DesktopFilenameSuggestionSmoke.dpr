program DesktopFilenameSuggestionSmoke;
{$APPTYPE CONSOLE}
uses
  Winapi.Windows, Winapi.Messages, Winapi.WebView2, Winapi.CommDlg, Winapi.Dlgs,
  System.Classes, System.SysUtils, System.RegularExpressions, Vcl.Forms, Vcl.Edge, Vcl.Dialogs,
  WebStudio.Main in 'WebStudio.Main.pas' {MainForm};

type
  TDialogDriver = class
    Suggested: string;
    procedure SaveShown(Sender: TObject);
  end;

procedure TDialogDriver.SaveShown(Sender: TObject);
var Window: HWND;
begin
  Window := GetParent(TSaveDialog(Sender).Handle);
  TThread.CreateAnonymousThread(
    procedure
    var Buffer: array[0..1023] of Char;
    begin
      Sleep(300);
      FillChar(Buffer, SizeOf(Buffer), 0);
      SendMessage(Window, CDM_GETSPEC, Length(Buffer), LPARAM(@Buffer[0]));
      Suggested := string(PChar(@Buffer[0]));
      PostMessage(Window, WM_COMMAND, IDCANCEL, 0);
    end).Start;
end;

var Deadline: UInt64; Driver: TDialogDriver; Index: Integer; Name, Script: string;
begin
  Application.Initialize;
  Application.ShowMainForm := False;
  Application.CreateForm(TMainForm, MainForm);
  Driver := TDialogDriver.Create;
  try
    Deadline := GetTickCount64 + 30000;
    while (MainForm.StatusLabel.Caption <> 'Local editor loaded.') and (GetTickCount64 < Deadline) do begin CheckSynchronize(0); Application.ProcessMessages; Sleep(20) end;
    if MainForm.StatusLabel.Caption <> 'Local editor loaded.' then raise Exception.Create('Test editor did not load.');
    if Winapi.Windows.Failed(MainForm.EditorBrowser.ControllerInterface.Set_IsVisible(1)) then raise Exception.Create('Could not activate test WebView.');
    MainForm.SaveDownloadDialog.OnShow := Driver.SaveShown;
    for Index := 1 to 3 do begin
      if Index = 1 then Name := 'sample.webstudio.json'
      else if Index = 2 then Name := 'sample.webstudio.zip'
      else Name := 'website.zip';
      Driver.Suggested := '';
      MainForm.StatusLabel.Caption := 'Waiting for test dialog';
      Script := '(()=>{const a=document.createElement("a");a.href=URL.createObjectURL(new Blob(["test"]));a.download="' + Name + '";a.click()})()';
      MainForm.EditorBrowser.ExecuteScript(Script);
      Deadline := GetTickCount64 + 30000;
      while (MainForm.StatusLabel.Caption <> 'Download canceled.') and (GetTickCount64 < Deadline) do begin CheckSynchronize(0); Application.ProcessMessages; Sleep(20) end;
      if MainForm.StatusLabel.Caption <> 'Download canceled.' then raise Exception.Create('Test dialog did not cancel.');
      if Index < 3 then begin
        if not TRegEx.IsMatch(Driver.Suggested, '^sample-\d{8}-\d{6}\.webstudio\.(json|zip)$', [roIgnoreCase]) then
          raise Exception.Create('Unexpected project suggestion: ' + Driver.Suggested);
      end else if Driver.Suggested <> Name then raise Exception.Create('Website filename changed: ' + Driver.Suggested);
    end;
    Writeln('Timestamped JSON and ZIP project suggestions and unchanged website suggestion passed.');
  finally Driver.Free; MainForm.Free end;
end.
