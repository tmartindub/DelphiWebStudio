program DesktopInstalledAIWorkflowSmoke;
{$APPTYPE CONSOLE}
{$B-}

{ Run only in a fresh installed test folder with an isolated WebView profile.
  Arguments are the verified runtime ZIP and supported local model. }
uses Winapi.Windows, Winapi.Messages, Winapi.CommDlg, Winapi.Dlgs,
  System.Classes, System.SysUtils, System.IOUtils, System.JSON, System.Zip, System.UITypes,
  Vcl.Forms, Vcl.Dialogs, Vcl.ExtCtrls, Vcl.StdCtrls, WebStudio.LocalAIForm,
  WebStudio.Main in '..\..\desktop\DelphiWebStudio\WebStudio.Main.pas' {MainForm};

{$R '..\..\desktop\DelphiWebStudio\DelphiWebStudio.res'}

type
  TDriver = class
    SaveCount: Integer;
    AIEntered: Boolean;
    LastError: string;
    procedure DialogTick(Sender: TObject);
    procedure SaveShown(Sender: TObject);
  end;

procedure TDriver.DialogTick(Sender: TObject);
var I, J: Integer; Dialog: TLocalAIForm;
begin
  for I := 0 to Screen.FormCount - 1 do
    if Screen.Forms[I] is TLocalAIForm then begin
      Dialog := TLocalAIForm(Screen.Forms[I]);
      Dialog.RuntimeEdit.Text := ParamStr(1);
      Dialog.ModelEdit.Text := ParamStr(2);
      Dialog.BriefMemo.Text := 'A fictional community group website with information, events, and resources.';
      Dialog.ProposalKind.ItemIndex := 0;
      AIEntered := True;
      Dialog.GenerateButton.Click;
      Exit;
    end else if Screen.Forms[I].ClassName = 'TMessageForm' then begin
      for J := 0 to Screen.Forms[I].ControlCount - 1 do
        if Screen.Forms[I].Controls[J] is TLabel then
          LastError := LastError + ' ' + TLabel(Screen.Forms[I].Controls[J]).Caption;
      Screen.Forms[I].ModalResult := mrOk;
    end;
end;

procedure TDriver.SaveShown(Sender: TObject);
var Window: HWND; Name: string;
begin
  Inc(SaveCount);
  if SaveCount = 1 then Name := 'ai-project.webstudio.json'
  else if SaveCount = 2 then Name := 'ai-website.zip'
  else raise Exception.Create('Unexpected save dialog.');
  if TFile.Exists(TPath.Combine(ExtractFilePath(ParamStr(0)), Name)) then
    raise Exception.Create('Test output already exists.');
  Window := GetParent(TSaveDialog(Sender).Handle);
  SendMessage(Window, CDM_SETCONTROLTEXT, edt1, LPARAM(PChar(Name)));
  PostMessage(Window, WM_COMMAND, IDOK, 0);
end;

var
  Driver: TDriver;
  Timer: TTimer;
  Deadline: UInt64;
  Value, Folder, ProjectFile, WebsiteFile, PageText: string;
  Json: TJSONValue;
  Pages: TJSONArray;
  Zip: TZipFile;
  I, HtmlCount: Integer;
  Bytes: TBytes;
begin
  if (ParamCount <> 2) or not TFile.Exists(ParamStr(1)) or not TFile.Exists(ParamStr(2)) then
    raise Exception.Create('The verified runtime and supported model are required.');
  Folder := ExtractFilePath(ParamStr(0));
  ProjectFile := TPath.Combine(Folder, 'ai-project.webstudio.json');
  WebsiteFile := TPath.Combine(Folder, 'ai-website.zip');
  if TFile.Exists(ProjectFile) or TFile.Exists(WebsiteFile) then raise Exception.Create('A fresh test folder is required.');
  Application.Initialize;
  UseLatestCommonDialogs := False;
  Application.ShowMainForm := False;
  Application.CreateForm(TMainForm, MainForm);
  Driver := TDriver.Create;
  Timer := TTimer.Create(nil);
  try
    Deadline := GetTickCount64 + 30000;
    while (MainForm.StatusLabel.Caption <> 'Local editor loaded.') and (GetTickCount64 < Deadline) do begin CheckSynchronize(0); Application.ProcessMessages; Sleep(20) end;
    if MainForm.StatusLabel.Caption <> 'Local editor loaded.' then raise Exception.Create('Installed editor did not load.');
    if Failed(MainForm.EditorBrowser.ControllerInterface.Set_IsVisible(1)) then raise Exception.Create('Could not activate test WebView.');
    MainForm.SaveDownloadDialog.InitialDir := Folder; MainForm.ProjectSaveDialog.InitialDir := Folder;
    MainForm.SaveDownloadDialog.OnShow := Driver.SaveShown; MainForm.ProjectSaveDialog.OnShow := Driver.SaveShown;
    Deadline := GetTickCount64 + 15000;
    repeat
      CheckSynchronize(0); Application.ProcessMessages; Sleep(50);
      Value := MainForm.EditorBrowser.ExecuteScript('!!Array.from(document.querySelectorAll("button")).find(b=>b.textContent.trim()==="or start blank")', '');
    until (Value = 'true') or (GetTickCount64 >= Deadline);
    if Value <> 'true' then raise Exception.Create('Blank-project control was not found.');
    MainForm.EditorBrowser.ExecuteScript('Array.from(document.querySelectorAll("button")).find(b=>b.textContent.trim()==="or start blank").click()');
    Deadline := GetTickCount64 + 15000;
    while not MainForm.EditorBrowser.LocationURL.Contains('#/editor') and (GetTickCount64 < Deadline) do begin CheckSynchronize(0); Application.ProcessMessages; Sleep(50) end;
    if not MainForm.EditorBrowser.LocationURL.Contains('#/editor') then raise Exception.Create('Blank project did not open.');
    Timer.Enabled := False; Timer.Interval := 100; Timer.OnTimer := Driver.DialogTick; Timer.Enabled := True;
    MainForm.LocalAIItem.Click;
    if not Driver.AIEntered then raise Exception.Create('Local AI dialog was not submitted.');
    Deadline := GetTickCount64 + 420000;
    repeat
      CheckSynchronize(0); Application.ProcessMessages; Sleep(100);
      Value := MainForm.EditorBrowser.ExecuteScript('document.body.innerText.includes("Review the proposed site")', '');
    until (Value = 'true') or (MainForm.StatusLabel.Caption = 'Local AI could not create a plan.') or (GetTickCount64 >= Deadline);
    if Value <> 'true' then raise Exception.Create('Local AI did not produce a reviewable plan: ' + MainForm.StatusLabel.Caption + Driver.LastError);
    MainForm.EditorBrowser.ExecuteScript('Array.from(document.querySelectorAll("button")).find(b=>b.textContent.trim()==="Apply plan").click()');
    Deadline := GetTickCount64 + 15000;
    repeat
      CheckSynchronize(0); Application.ProcessMessages; Sleep(50);
      Value := MainForm.EditorBrowser.ExecuteScript('!!document.querySelector("[data-webstudio-block-id]")', '');
    until (Value = 'true') or (GetTickCount64 >= Deadline);
    if Value <> 'true' then raise Exception.Create('The generated site was not applied.');
    MainForm.EditorBrowser.ExecuteScript('document.querySelector("[data-webstudio-block-id]").click()');
    Deadline := GetTickCount64 + 10000;
    repeat
      CheckSynchronize(0); Application.ProcessMessages; Sleep(50);
      Value := MainForm.EditorBrowser.ExecuteScript('!!Array.from(document.querySelectorAll("label")).find(x=>x.textContent.trim()==="Headline")?.parentElement.querySelector("input")', '');
    until (Value = 'true') or (GetTickCount64 >= Deadline);
    if Value <> 'true' then raise Exception.Create('Generated headline property was not available.');
    MainForm.EditorBrowser.ExecuteScript('(()=>{const e=Array.from(document.querySelectorAll("label")).find(x=>x.textContent.trim()==="Headline").parentElement.querySelector("input");Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(e,"Edited community headline");e.dispatchEvent(new Event("input",{bubbles:true}))})()');
    Deadline := GetTickCount64 + 10000;
    repeat
      CheckSynchronize(0); Application.ProcessMessages; Sleep(50);
      Value := MainForm.EditorBrowser.ExecuteScript('document.body.innerText.includes("Edited community headline")', '');
    until (Value = 'true') or (GetTickCount64 >= Deadline);
    if Value <> 'true' then raise Exception.Create('Generated headline edit did not appear.');
    MainForm.EditorBrowser.ExecuteScript('Array.from(document.querySelectorAll("button")).find(b=>b.textContent.trim()==="Save project").click()');
    Deadline := GetTickCount64 + 30000;
    while (MainForm.StatusLabel.Caption <> 'Download completed: ai-project.webstudio.json') and (GetTickCount64 < Deadline) do begin CheckSynchronize(0); Application.ProcessMessages; Sleep(50) end;
    if not TFile.Exists(ProjectFile) then raise Exception.Create('AI project was not saved.');
    MainForm.EditorBrowser.ExecuteScript('Array.from(document.querySelectorAll("button")).find(b=>b.textContent.trim()==="Export").click()');
    Deadline := GetTickCount64 + 30000;
    while (MainForm.StatusLabel.Caption <> 'Download completed: ai-website.zip') and (GetTickCount64 < Deadline) do begin CheckSynchronize(0); Application.ProcessMessages; Sleep(50) end;
    if not TFile.Exists(WebsiteFile) then raise Exception.Create('AI website was not exported.');
    Json := TJSONObject.ParseJSONValue(TFile.ReadAllText(ProjectFile, TEncoding.UTF8));
    try
      Pages := Json.GetValue<TJSONObject>('config').GetValue<TJSONArray>('pages');
      if (Pages = nil) or (Pages.Count <> 5) then raise Exception.Create('Saved AI project does not have five pages.');
    finally Json.Free end;
    Zip := TZipFile.Create;
    try
      Zip.Open(WebsiteFile, zmRead);
      HtmlCount := 0;
      for I := 0 to Zip.FileCount - 1 do if Zip.FileNames[I].EndsWith('.html') then Inc(HtmlCount);
      if HtmlCount <> 5 then raise Exception.Create('AI website does not contain five HTML pages.');
      Zip.Read('index.html', Bytes); PageText := TEncoding.UTF8.GetString(Bytes);
      if not PageText.Contains('Edited community headline') then raise Exception.Create('Edited headline is missing from export.');
    finally Zip.Free end;
    Writeln('Installed editor created, planned, edited, saved and exported a five-page local AI site.');
  finally Timer.Free; Driver.Free; MainForm.Free end;
end.
