program DesktopModernFivePageHarness;

{$APPTYPE GUI}
{$B-}

{ Run from a fresh test folder containing editor\fixture.zip, after the
  desktop project has generated DelphiWebStudio.res. The normal, unhooked
  Windows Save dialogs remain interactive. Use only test files. }

uses
  Winapi.Windows, System.Classes, System.SysUtils, System.IOUtils, Vcl.Forms,
  WebStudio.Main in '..\..\desktop\DelphiWebStudio\WebStudio.Main.pas' {MainForm};

{$R '..\..\desktop\DelphiWebStudio\DelphiWebStudio.res'}

var
  Deadline: UInt64;
  Value, Folder: string;
begin
  Folder := ExtractFilePath(ParamStr(0));
  if not TFile.Exists(TPath.Combine(Folder, 'editor\fixture.zip')) then
    raise Exception.Create('A synthetic five-page fixture is required.');
  Application.Initialize;
  Application.MainFormOnTaskbar := True;
  Application.CreateForm(TMainForm, MainForm);
  MainForm.ProjectSaveDialog.InitialDir := Folder;
  MainForm.SaveDownloadDialog.InitialDir := Folder;
  MainForm.Show;
  Deadline := GetTickCount64 + 30000;
  while (MainForm.StatusLabel.Caption <> 'Local editor loaded.') and (GetTickCount64 < Deadline) do begin
    CheckSynchronize(0); Application.ProcessMessages; Sleep(20);
  end;
  if MainForm.StatusLabel.Caption <> 'Local editor loaded.' then raise Exception.Create('Test editor did not load.');
  Deadline := GetTickCount64 + 15000;
  repeat
    CheckSynchronize(0); Application.ProcessMessages; Sleep(50);
    Value := MainForm.EditorBrowser.ExecuteScript('!!document.querySelector("input[aria-label=\"Choose project file\"]")', '');
  until (Value = 'true') or (GetTickCount64 >= Deadline);
  if Value <> 'true' then raise Exception.Create('Project file control was not found.');
  MainForm.EditorBrowser.ExecuteScript('fetch("/fixture.zip").then(r=>r.blob()).then(b=>{const i=document.querySelector("input[aria-label=\"Choose project file\"]"),d=new DataTransfer();d.items.add(new File([b],"fixture.zip",{type:"application/zip"}));i.files=d.files;i.dispatchEvent(new Event("change",{bubbles:true}));})');
  Deadline := GetTickCount64 + 30000;
  repeat
    CheckSynchronize(0); Application.ProcessMessages; Sleep(50);
    Value := MainForm.EditorBrowser.ExecuteScript('!!Array.from(document.querySelectorAll("button")).find(b=>b.textContent.trim()==="News")', '');
  until (Value = 'true') or (GetTickCount64 >= Deadline);
  if Value <> 'true' then raise Exception.Create('Five-page fixture did not open.');
  MainForm.StatusLabel.Caption := 'Synthetic five-page fixture ready for the modern Save dialog test.';
  Application.Run;
end.
