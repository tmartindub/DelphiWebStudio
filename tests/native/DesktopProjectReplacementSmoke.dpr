program DesktopProjectReplacementSmoke;
{$APPTYPE CONSOLE}
{$B-}
{$IFDEF TEST_MANIFEST}{$R 'test.res'}{$ENDIF}
{ Run only in a fresh isolated folder and profile with editor\fixture.json
  and editor\fixture.zip containing the five-page project fixtures. }
uses Winapi.Windows, Winapi.Messages, Winapi.CommDlg, Winapi.CommCtrl, Winapi.Dlgs,
  System.SysUtils, System.Classes, System.IOUtils, System.Zip, Vcl.Forms, Vcl.Edge, Vcl.Dialogs,
  WebStudio.Main in 'WebStudio.Main.pas';
type TDriver = class
  Phase: Integer;
  Folder, JsonTarget, ZipTarget: string;
  procedure SaveShown(Sender: TObject);
  procedure ConfirmShown(Sender: TObject);
end;
procedure TDriver.SaveShown(Sender: TObject);
var Window: HWND; Name: string;
begin
  if (Phase = 4) or (Phase = 6) then Name := ExtractFileName(ZipTarget) else Name := ExtractFileName(JsonTarget);
  Window := GetParent(TSaveDialog(Sender).Handle);
  SendMessage(Window, CDM_SETCONTROLTEXT, edt1, LPARAM(PChar(Name)));
  PostMessage(Window, WM_COMMAND, IDOK, 0);
end;
procedure TDriver.ConfirmShown(Sender: TObject);
begin
  if Phase = 3 then TFile.WriteAllText(JsonTarget, 'concurrent change');
  if Phase = 1 then PostMessage(TTaskDialog(Sender).Handle, TDM_CLICK_BUTTON, IDNO, 0)
  else PostMessage(TTaskDialog(Sender).Handle, TDM_CLICK_BUTTON, IDYES, 0);
end;
var Folder, Value, Recovery, Hint, Script: string; Deadline: UInt64; Driver: TDriver;
  Archive: TZipFile; Actual, Expected: TBytes; Phase: Integer;
begin
  Folder := ExtractFilePath(ParamStr(0));
  if not TFile.Exists(TPath.Combine(Folder, 'editor\fixture.json')) or
    not TFile.Exists(TPath.Combine(Folder, 'editor\fixture.zip')) or
    TFile.Exists(TPath.Combine(Folder, 'existing.webstudio.json')) or
    TFile.Exists(TPath.Combine(Folder, 'existing.webstudio.zip')) then
    raise Exception.Create('A fresh isolated folder and project fixtures are required.');
  Driver := TDriver.Create; Driver.Folder := Folder;
  Driver.JsonTarget := TPath.Combine(Folder, 'existing.webstudio.json');
  Driver.ZipTarget := TPath.Combine(Folder, 'existing.webstudio.zip');
  TFile.WriteAllText(Driver.JsonTarget, 'original project');
  TFile.WriteAllText(Driver.ZipTarget, 'original zip project');
  Application.Initialize; Application.ShowMainForm := False; Application.CreateForm(TMainForm, MainForm);
  try
    Deadline := GetTickCount64 + 30000;
    while (MainForm.StatusLabel.Caption <> 'Local editor loaded.') and (GetTickCount64 < Deadline) do begin CheckSynchronize(0); Application.ProcessMessages; Sleep(20) end;
    if MainForm.StatusLabel.Caption <> 'Local editor loaded.' then raise Exception.Create('Test editor did not load.');
    if Winapi.Windows.Failed(MainForm.EditorBrowser.ControllerInterface.Set_IsVisible(1)) then raise Exception.Create('Could not activate WebView.');
    MainForm.ProjectSaveDialog.InitialDir := Folder; MainForm.ProjectSaveDialog.OnShow := Driver.SaveShown;
    MainForm.ReplaceConfirmDialog.OnDialogCreated := Driver.ConfirmShown;
    for Phase := 1 to 6 do begin
      Driver.Phase := Phase; MainForm.StatusLabel.Caption := 'Waiting for test save'; MainForm.StatusLabel.Hint := '';
      if Phase = 4 then Script := 'fetch("/fixture.zip").then(r=>r.blob()).then(b=>{const a=document.createElement("a");a.href=URL.createObjectURL(b);a.download="sample.webstudio.zip";a.click()})'
      else if Phase = 5 then Script := '(()=>{const a=document.createElement("a");a.href=URL.createObjectURL(new Blob(["invalid"]));a.download="sample.webstudio.json";a.click()})()'
      else if Phase = 6 then Script := '(()=>{const a=document.createElement("a");a.href=URL.createObjectURL(new Blob(["invalid"]));a.download="sample.webstudio.zip";a.click()})()'
      else Script := 'fetch("/fixture.json").then(r=>r.blob()).then(b=>{const a=document.createElement("a");a.href=URL.createObjectURL(b);a.download="sample.webstudio.json";a.click()})';
      MainForm.EditorBrowser.ExecuteScript(Script);
      Deadline := GetTickCount64 + 45000;
      repeat CheckSynchronize(0); Application.ProcessMessages; Sleep(50); Value := MainForm.StatusLabel.Caption;
      until (Value <> 'Waiting for test save') and (Value <> 'Checking project before replacement...') and
        (Value <> 'Creating recovery ZIP before replacing project...') or (GetTickCount64 >= Deadline);
      if Phase = 1 then begin
        if (Value <> 'Replacement canceled; existing project was not changed.') or (TFile.ReadAllText(Driver.JsonTarget) <> 'original project') then raise Exception.Create('Canceled replacement changed the original: ' + Value);
      end else if (Phase = 2) or (Phase = 4) then begin
        if Pos('Project replaced. Recovery ZIP: ', Value) <> 1 then raise Exception.Create('Confirmed replacement did not complete: ' + Value);
        Recovery := Copy(Value, Length('Project replaced. Recovery ZIP: ') + 1, MaxInt);
        if not TFile.Exists(Recovery) then raise Exception.Create('Recovery ZIP was not found.');
        Archive := TZipFile.Create;
        try
          Archive.Open(Recovery, zmRead);
          if Phase = 2 then begin Archive.Read('existing.webstudio.json', Actual); Expected := TFile.ReadAllBytes(TPath.Combine(Folder, 'editor\fixture.json')) end
          else begin Archive.Read('existing.webstudio.zip', Actual); Expected := TFile.ReadAllBytes(TPath.Combine(Folder, 'editor\fixture.zip')) end;
        finally Archive.Free end;
        if ((Phase = 2) and (TEncoding.UTF8.GetString(Actual) <> 'original project')) or
          ((Phase = 4) and (TEncoding.UTF8.GetString(Actual) <> 'original zip project')) then raise Exception.Create('Recovery ZIP differs from original.');
        if Phase = 2 then Actual := TFile.ReadAllBytes(Driver.JsonTarget) else Actual := TFile.ReadAllBytes(Driver.ZipTarget);
        if (Length(Actual) <> Length(Expected)) or ((Length(Expected) > 0) and not CompareMem(@Actual[0], @Expected[0], Length(Expected))) then raise Exception.Create('Replacement project bytes differ.');
      end else begin
        Hint := MainForm.StatusLabel.Hint;
        if (Value <> 'Replacement needs attention. Hover here for recovery details.') or (Pos('Staged file: ', Hint) = 0) then raise Exception.Create('Rejected replacement was not reported: ' + Value);
        if (Phase = 3) and ((TFile.ReadAllText(Driver.JsonTarget) <> 'concurrent change') or (Pos('changed after replacement was confirmed', Hint) = 0)) then raise Exception.Create('Concurrent change was not preserved.');
        if (Phase = 5) and ((TFile.ReadAllText(Driver.JsonTarget) <> 'concurrent change') or (Pos('not a supported WebStudio project', Hint) = 0)) then raise Exception.Create('Invalid staged JSON was accepted.');
        if Phase = 6 then begin
          Actual := TFile.ReadAllBytes(Driver.ZipTarget); Expected := TFile.ReadAllBytes(TPath.Combine(Folder, 'editor\fixture.zip'));
          if (Length(Actual) <> Length(Expected)) or ((Length(Expected) > 0) and not CompareMem(@Actual[0], @Expected[0], Length(Expected))) then raise Exception.Create('Invalid staged ZIP changed the original.');
        end;
      end;
    end;
    Writeln('Confirmed JSON and ZIP replacement, cancellation, changed target and invalid staged JSON and ZIP passed.');
  finally Driver.Free; MainForm.Free end;
end.
