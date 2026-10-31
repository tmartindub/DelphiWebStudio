program DesktopDraftAfterTerminationSmoke;
{$APPTYPE CONSOLE}
{ Run after DesktopSaveTerminationSmoke with the same isolated test profile. }
uses
  Winapi.Windows, Winapi.Messages, Winapi.CommDlg, Winapi.Dlgs,
  System.Classes, System.SysUtils, System.IOUtils, Vcl.Forms, Vcl.Edge, Vcl.Dialogs,
  WebStudio.Main in 'WebStudio.Main.pas' {MainForm};

type
  TDialogDriver = class
    procedure SaveShown(Sender: TObject);
  end;

procedure TDialogDriver.SaveShown(Sender: TObject);
var Window: HWND; Target: string;
begin
  Target := TPath.Combine(ExtractFilePath(ParamStr(0)), 'recovered-draft.zip');
  if TFile.Exists(Target) then raise Exception.Create('Recovered test file already exists.');
  Window := GetParent(TSaveDialog(Sender).Handle);
  Target := ExtractFileName(Target);
  SendMessage(Window, CDM_SETCONTROLTEXT, edt1, LPARAM(PChar(Target)));
  PostMessage(Window, WM_COMMAND, IDOK, 0);
end;

var Deadline: UInt64; Value: string; Driver: TDialogDriver;
begin
  Application.Initialize;
  Application.ShowMainForm := False;
  Application.CreateForm(TMainForm, MainForm);
  Driver := TDialogDriver.Create;
  try
    Deadline := GetTickCount64 + 30000;
    while (MainForm.StatusLabel.Caption <> 'Local editor loaded.') and (GetTickCount64 < Deadline) do begin CheckSynchronize(0); Application.ProcessMessages; Sleep(20) end;
    if MainForm.StatusLabel.Caption <> 'Local editor loaded.' then raise Exception.Create('Test editor did not restart.');
    if Winapi.Windows.Failed(MainForm.EditorBrowser.ControllerInterface.Set_IsVisible(1)) then raise Exception.Create('Could not activate test WebView.');
    Deadline := GetTickCount64 + 15000;
    repeat
      CheckSynchronize(0); Application.ProcessMessages; Sleep(50);
      Value := MainForm.EditorBrowser.ExecuteScript('!!localStorage.getItem("openpage-projects")?.includes("Newer draft survives termination") && !!document.querySelector("[aria-label=\"Duplicate Community\"]")', '');
    until (Value = 'true') or (GetTickCount64 >= Deadline);
    if Value <> 'true' then raise Exception.Create('Edited draft was not found after termination.');
    MainForm.EditorBrowser.ExecuteScript('document.querySelector("[aria-label=\"Duplicate Community\"]").closest(".card-lift").click()');
    Deadline := GetTickCount64 + 15000;
    repeat
      CheckSynchronize(0); Application.ProcessMessages; Sleep(50);
      Value := MainForm.EditorBrowser.ExecuteScript('document.body.innerText.includes("Newer draft survives termination")', '');
    until (Value = 'true') or (GetTickCount64 >= Deadline);
    if Value <> 'true' then raise Exception.Create('Edited draft did not reopen in the editor.');
    MainForm.EditorBrowser.ExecuteScript('Array.from(document.querySelectorAll("summary")).find(e=>e.textContent.trim()==="Local revisions").click()');
    Deadline := GetTickCount64 + 15000;
    repeat
      CheckSynchronize(0); Application.ProcessMessages; Sleep(50);
      Value := MainForm.EditorBrowser.ExecuteScript('!!Array.from(document.querySelectorAll("button")).find(e=>e.textContent.trim()==="Open as a separate project")', '');
    until (Value = 'true') or (GetTickCount64 >= Deadline);
    if Value <> 'true' then raise Exception.Create('Local revision did not survive termination.');
    MainForm.EditorBrowser.ExecuteScript('Array.from(document.querySelectorAll("button")).find(e=>e.textContent.trim()==="Open as a separate project").click()');
    Deadline := GetTickCount64 + 30000;
    repeat
      CheckSynchronize(0); Application.ProcessMessages; Sleep(50);
      Value := MainForm.EditorBrowser.ExecuteScript('document.body.innerText.includes("Draft survives forced termination") && !!localStorage.getItem("openpage-projects")?.includes("Newer draft survives termination")', '');
    until (Value = 'true') or (GetTickCount64 >= Deadline);
    if Value <> 'true' then raise Exception.Create('Revision did not open separately with the newer draft preserved.');
    MainForm.EditorBrowser.ExecuteScript('Array.from(document.querySelectorAll("button")).find(b=>b.textContent.trim()==="Media").click()');
    Deadline := GetTickCount64 + 15000;
    repeat
      CheckSynchronize(0); Application.ProcessMessages; Sleep(50);
      Value := MainForm.EditorBrowser.ExecuteScript('document.body.innerText.includes("proof.pdf") && !!Array.from(document.querySelectorAll("button")).find(b=>b.textContent.trim()==="Preview PDF")', '');
    until (Value = 'true') or (GetTickCount64 >= Deadline);
    if Value <> 'true' then raise Exception.Create('Sample PDF was not found after termination.');
    MainForm.SaveDownloadDialog.InitialDir := ExtractFilePath(ParamStr(0));
    MainForm.ProjectSaveDialog.InitialDir := ExtractFilePath(ParamStr(0));
    MainForm.SaveDownloadDialog.OnShow := Driver.SaveShown;
    MainForm.ProjectSaveDialog.OnShow := Driver.SaveShown;
    MainForm.EditorBrowser.ExecuteScript('Array.from(document.querySelectorAll("button")).find(b=>b.textContent.trim()==="Save project").click()');
    Deadline := GetTickCount64 + 30000;
    while (MainForm.StatusLabel.Caption <> 'Download completed: recovered-draft.zip') and (GetTickCount64 < Deadline) do begin CheckSynchronize(0); Application.ProcessMessages; Sleep(50) end;
    if MainForm.StatusLabel.Caption <> 'Download completed: recovered-draft.zip' then raise Exception.Create('Recovered draft could not be saved.');
    Writeln('The local revision and PDF reopened after forced termination; the newer draft remained intact.');
  finally Driver.Free; MainForm.Free end;
end.
