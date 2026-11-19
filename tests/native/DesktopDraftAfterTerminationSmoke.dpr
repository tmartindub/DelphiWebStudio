program DesktopDraftAfterTerminationSmoke;
{$APPTYPE CONSOLE}
uses
  Winapi.Windows, System.Classes, System.SysUtils, Vcl.Forms, Vcl.Edge,
  WebStudio.Main in 'WebStudio.Main.pas' {MainForm};

var Deadline: UInt64; Value: string;
begin
  Application.Initialize;
  Application.ShowMainForm := False;
  Application.CreateForm(TMainForm, MainForm);
  try
    Deadline := GetTickCount64 + 30000;
    while (MainForm.StatusLabel.Caption <> 'Local editor loaded.') and (GetTickCount64 < Deadline) do begin CheckSynchronize(0); Application.ProcessMessages; Sleep(20) end;
    if MainForm.StatusLabel.Caption <> 'Local editor loaded.' then raise Exception.Create('Test editor did not restart.');
    if Winapi.Windows.Failed(MainForm.EditorBrowser.ControllerInterface.Set_IsVisible(1)) then raise Exception.Create('Could not activate test WebView.');
    Deadline := GetTickCount64 + 15000;
    repeat
      CheckSynchronize(0); Application.ProcessMessages; Sleep(50);
      Value := MainForm.EditorBrowser.ExecuteScript('!!localStorage.getItem("openpage-projects")?.includes("Draft survives forced termination") && !!document.querySelector("[aria-label=\"Duplicate Community\"]")', '');
    until (Value = 'true') or (GetTickCount64 >= Deadline);
    if Value <> 'true' then raise Exception.Create('Edited draft was not found after termination.');
    MainForm.EditorBrowser.ExecuteScript('document.querySelector("[aria-label=\"Duplicate Community\"]").closest(".card-lift").click()');
    Deadline := GetTickCount64 + 15000;
    repeat
      CheckSynchronize(0); Application.ProcessMessages; Sleep(50);
      Value := MainForm.EditorBrowser.ExecuteScript('document.body.innerText.includes("Draft survives forced termination")', '');
    until (Value = 'true') or (GetTickCount64 >= Deadline);
    if Value <> 'true' then raise Exception.Create('Edited draft did not reopen in the editor.');
    Writeln('The edited local draft reopened after forced test-host termination.');
  finally MainForm.Free end;
end.
