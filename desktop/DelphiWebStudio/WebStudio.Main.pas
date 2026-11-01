unit WebStudio.Main;
{$B-}

interface

uses
  Winapi.Windows, Winapi.WebView2, System.SysUtils, System.Classes,
  Vcl.Controls, Vcl.Forms, Vcl.StdCtrls, Vcl.ExtCtrls, Vcl.Edge, Vcl.Dialogs, Vcl.Menus,
  WebStudio.Bridge;

type
  TMainForm = class(TForm)
    StatusPanel: TPanel;
    StatusLabel: TLabel;
    RecoverStageButton: TButton;
    EditorBrowser: TEdgeBrowser;
    SaveDownloadDialog: TSaveDialog;
    ProjectSaveDialog: TSaveDialog;
    RecoveryOpenDialog: TOpenDialog;
    RecoverySaveDialog: TSaveDialog;
    ProjectMenu: TMainMenu;
    ProjectMenuItem: TMenuItem;
    BackupProjectItem: TMenuItem;
    RestoreBackupItem: TMenuItem;
    BackupSourceDialog: TOpenDialog;
    BackupSaveDialog: TSaveDialog;
    BackupOpenDialog: TOpenDialog;
    BackupRestoreDialog: TSaveDialog;
    ReplaceConfirmDialog: TTaskDialog;
    LocalAIItem: TMenuItem;
    SftpItem: TMenuItem;
    DiagnosticsItem: TMenuItem;
    DiagnosticsDialog: TTaskDialog;
    procedure FormCreate(Sender: TObject);
    procedure FormDestroy(Sender: TObject);
    procedure FormCloseQuery(Sender: TObject; var CanClose: Boolean);
    procedure EditorBrowserCreateWebViewCompleted(Sender: TCustomEdgeBrowser; AResult: HResult);
    procedure EditorBrowserNavigationStarting(Sender: TCustomEdgeBrowser; Args: TNavigationStartingEventArgs);
    procedure EditorBrowserFrameNavigationStarting(Sender: TCustomEdgeBrowser; Args: TNavigationStartingEventArgs);
    procedure EditorBrowserNavigationCompleted(Sender: TCustomEdgeBrowser; IsSuccess: Boolean; WebErrorStatus: COREWEBVIEW2_WEB_ERROR_STATUS);
    procedure EditorBrowserNewWindowRequested(Sender: TCustomEdgeBrowser; Args: TNewWindowRequestedEventArgs);
    procedure EditorBrowserPermissionRequested(Sender: TCustomEdgeBrowser; Args: TPermissionRequestedEventArgs);
    procedure EditorBrowserDownloadStarting(Sender: TCustomEdgeBrowser; Args: TDownloadStartingEventArgs);
    procedure EditorBrowserWebMessageReceived(Sender: TCustomEdgeBrowser; Args: TWebMessageReceivedEventArgs);
    procedure RecoverStageButtonClick(Sender: TObject);
    procedure BackupProjectItemClick(Sender: TObject);
    procedure RestoreBackupItemClick(Sender: TObject);
    procedure LocalAIItemClick(Sender: TObject);
    procedure SftpItemClick(Sender: TObject);
    procedure DiagnosticsItemClick(Sender: TObject);
  private
    FDownloadPending: Boolean;
    FActiveProjectSaves: Integer;
    FCloseWarningShown: Boolean;
    FLocalAIWorking: Boolean;
    FBridgeSession: TDesktopSession;
  end;

var MainForm: TMainForm;

implementation

uses Winapi.ActiveX, System.IOUtils, System.Zip, System.JSON, System.UITypes, System.RegularExpressions,
  WebStudio.ProjectSave, WebStudio.LocalAIForm, WebStudio.LocalAIHost, WebStudio.SftpForm;

{$R *.dfm}

procedure TMainForm.DiagnosticsItemClick(Sender: TObject);
var RuntimeVersion, EditorState: string;
begin
  RuntimeVersion := '';
  try RuntimeVersion := EditorBrowser.BrowserVersionInfo except RuntimeVersion := '' end;
  if RuntimeVersion = '' then RuntimeVersion := 'Not available';
  if StatusLabel.Caption = 'Local editor loaded.' then EditorState := 'Loaded'
  else EditorState := 'Not loaded; check the status line';
  DiagnosticsDialog.Text := 'Desktop build: experimental ' +
    {$IFDEF WIN64}'Win64'{$ELSE}'Win32'{$ENDIF} + sLineBreak +
    'WebView2 version: ' + RuntimeVersion + sLineBreak +
    'Local editor: ' + EditorState + sLineBreak + sLineBreak +
    'These diagnostics stay on this computer and do not include project contents or credentials.';
  DiagnosticsDialog.Execute;
end;

procedure TMainForm.SftpItemClick(Sender: TObject);
var Dialog: TSftpForm;
begin
  Dialog := TSftpForm.Create(Self);
  try
    Dialog.ShowModal;
  finally
    Dialog.Free;
  end;
end;

type
  TDownloadStateHandler = class(TInterfacedObject, ICoreWebView2StateChangedEventHandler)
  private
    FOwnerWindow: HWND;
    FOwner: TMainForm;
    FFileName: string;
    FStagedPath: string;
    FTargetPath: string;
    FReplaceExisting: Boolean;
    FConfirmedOriginal: TByHandleFileInformation;
    FFinished: Boolean;
  public
    constructor Create(AOwner: TMainForm; AOwnerWindow: HWND; const AFileName, AStagedPath, ATargetPath: string;
      AReplaceExisting: Boolean; const AConfirmedOriginal: TByHandleFileInformation);
    function Invoke(const sender: ICoreWebView2DownloadOperation; const args: IUnknown): HResult; stdcall;
  end;

constructor TDownloadStateHandler.Create(AOwner: TMainForm; AOwnerWindow: HWND; const AFileName, AStagedPath, ATargetPath: string;
  AReplaceExisting: Boolean; const AConfirmedOriginal: TByHandleFileInformation);
begin
  inherited Create;
  FOwner := AOwner;
  FOwnerWindow := AOwnerWindow;
  FFileName := AFileName;
  FStagedPath := AStagedPath;
  FTargetPath := ATargetPath;
  FReplaceExisting := AReplaceExisting;
  FConfirmedOriginal := AConfirmedOriginal;
end;

function TDownloadStateHandler.Invoke(const sender: ICoreWebView2DownloadOperation; const args: IUnknown): HResult;
var State: COREWEBVIEW2_DOWNLOAD_STATE; RecoveryZip, RetainedOriginal: string;
  StageStream, EntryStream: TStream; Zip: TZipFile; ZipHeader: TZipHeader;
  Bytes: TBytes; Document, Config, Pages: TJSONValue; Index, ManifestIndex, ManifestCount: Integer;
  ExtraByte: Byte; ValidatedStage: TByHandleFileInformation;
begin
  Result := S_OK;
  if not IsWindow(FOwnerWindow) or (FindControl(FOwnerWindow) <> FOwner) or
    (csDestroying in FOwner.ComponentState) or not Assigned(FOwner.StatusLabel) or
    Winapi.Windows.Failed(sender.Get_State(State)) then Exit;
  if (State <> COREWEBVIEW2_DOWNLOAD_STATE_COMPLETED) and (State <> COREWEBVIEW2_DOWNLOAD_STATE_INTERRUPTED) then Exit;
  if FStagedPath <> '' then begin
    if FFinished then Exit;
    FFinished := True;
  end;
  try
    if State = COREWEBVIEW2_DOWNLOAD_STATE_COMPLETED then begin
      if FStagedPath <> '' then begin
        try
          if FReplaceExisting then begin
            FOwner.StatusLabel.Caption := 'Checking project before replacement...';
            FOwner.StatusLabel.Update;
            StageStream := TFileStream.Create(FStagedPath, fmOpenRead or fmShareDenyWrite);
            try
              if not GetFileInformationByHandle(TFileStream(StageStream).Handle, ValidatedStage) then RaiseLastOSError;
              if SameText(TPath.GetExtension(FTargetPath), '.json') then begin
                if (StageStream.Size <= 0) or (StageStream.Size > 100 * 1024 * 1024) then
                  raise EArgumentException.Create('The staged project manifest is empty or exceeds 100 MiB.');
                SetLength(Bytes, Integer(StageStream.Size));
                StageStream.ReadBuffer(Bytes[0], Length(Bytes));
              end else begin
                Zip := TZipFile.Create;
                try
                  Zip.Open(StageStream, zmRead);
                  ManifestIndex := -1; ManifestCount := 0;
                  for Index := 0 to Zip.FileCount - 1 do
                    if Zip.FileName[Index] = 'project.webstudio.json' then begin
                      ManifestIndex := Index; Inc(ManifestCount);
                    end;
                  if ManifestCount <> 1 then raise EArgumentException.Create('The staged ZIP must contain one project manifest.');
                  ZipHeader := Zip.FileInfo[ManifestIndex];
                  if ZipHeader.IsEncrypted or (ZipHeader.UncompressedSize64 = 0) or
                    (ZipHeader.UncompressedSize64 > 100 * 1024 * 1024) then
                    raise EArgumentException.Create('The staged project manifest is encrypted, empty or exceeds 100 MiB.');
                  Zip.Read(ManifestIndex, EntryStream, ZipHeader, True);
                  try
                    SetLength(Bytes, Integer(Zip.FileInfo[ManifestIndex].UncompressedSize64));
                    EntryStream.ReadBuffer(Bytes[0], Length(Bytes));
                    if EntryStream.Read(ExtraByte, 1) <> 0 then raise EArgumentException.Create('The staged manifest has unexpected data.');
                  finally EntryStream.Free end;
                finally Zip.Free end;
              end;
            finally StageStream.Free end;
            if not TEncoding.UTF8.IsBufferValid(Bytes) then raise EArgumentException.Create('The staged project manifest is not valid UTF-8.');
            Document := TJSONObject.ParseJSONValue(TEncoding.UTF8.GetString(Bytes));
            try
              if not (Document is TJSONObject) or not (TJSONObject(Document).GetValue('format') is TJSONString) or
                (TJSONObject(Document).GetValue('format').Value <> 'webstudio') or
                not (TJSONObject(Document).GetValue('schemaVersion') is TJSONNumber) or
                (TJSONObject(Document).GetValue('schemaVersion').Value <> '2') or
                not (TJSONObject(Document).GetValue('projectId') is TJSONString) or
                (TJSONObject(Document).GetValue('projectId').Value = '') then
                raise EArgumentException.Create('The staged file is not a supported WebStudio project.');
              Config := TJSONObject(Document).GetValue('config');
              if not (Config is TJSONObject) or not (TJSONObject(Config).GetValue('name') is TJSONString) then
                raise EArgumentException.Create('The staged project configuration is invalid.');
              Pages := TJSONObject(Config).GetValue('pages');
              if not (Pages is TJSONArray) or (TJSONArray(Pages).Count = 0) then
                raise EArgumentException.Create('The staged project has no pages.');
            finally Document.Free end;
            FOwner.StatusLabel.Caption := 'Creating recovery ZIP before replacing project...';
            FOwner.StatusLabel.Update;
            ReplaceStagedProjectFile(FStagedPath, FTargetPath, 512 * 1024 * 1024,
              FConfirmedOriginal, ValidatedStage, RecoveryZip, RetainedOriginal);
            FOwner.StatusLabel.Hint := 'Recovery ZIP: ' + RecoveryZip;
            if RetainedOriginal <> '' then begin
              FOwner.StatusLabel.Hint := FOwner.StatusLabel.Hint + sLineBreak + 'Original also retained: ' + RetainedOriginal;
              FOwner.StatusLabel.Caption := 'Project replaced; original also retained. Hover for paths.';
            end else FOwner.StatusLabel.Caption := 'Project replaced. Recovery ZIP: ' + RecoveryZip;
            Exit;
          end else CommitStagedProjectFile(FStagedPath, FTargetPath);
        except
          on E: Exception do begin
            if Assigned(FOwner.RecoveryOpenDialog) then FOwner.RecoveryOpenDialog.InitialDir := TPath.GetDirectoryName(FStagedPath);
            if FReplaceExisting then begin
              FOwner.StatusLabel.Hint := E.Message + sLineBreak + 'Staged file: ' + FStagedPath;
              FOwner.StatusLabel.Caption := 'Replacement needs attention. Hover here for recovery details.';
            end else begin
              FOwner.StatusLabel.Hint := FStagedPath;
              FOwner.StatusLabel.Caption := 'Project not saved. Check staged file: ' + FStagedPath;
            end;
            Exit;
          end;
        end;
      end;
      FOwner.StatusLabel.Hint := '';
      FOwner.StatusLabel.Caption := 'Download completed: ' + FFileName;
    end else if State = COREWEBVIEW2_DOWNLOAD_STATE_INTERRUPTED then begin
      if FStagedPath <> '' then begin
        if Assigned(FOwner.RecoveryOpenDialog) then FOwner.RecoveryOpenDialog.InitialDir := TPath.GetDirectoryName(FStagedPath);
        FOwner.StatusLabel.Hint := FStagedPath;
        FOwner.StatusLabel.Caption := 'Project download interrupted. Check staged file: ' + FStagedPath;
      end else begin
        FOwner.StatusLabel.Hint := '';
        FOwner.StatusLabel.Caption := 'Download interrupted: ' + FFileName + '. Try saving again.';
      end;
    end;
  finally
    if FStagedPath <> '' then begin
      if FOwner.FActiveProjectSaves > 0 then Dec(FOwner.FActiveProjectSaves);
      FOwner.FCloseWarningShown := False;
    end;
  end;
end;

procedure TMainForm.FormCreate(Sender: TObject);
begin
  if not TFile.Exists(TPath.Combine(ExtractFilePath(ParamStr(0)), 'editor\index.html')) then begin
    StatusLabel.Caption := 'Local editor files are missing. Build and stage the editor first.';
    Exit;
  end;
  try
    EditorBrowser.CreateWebView;
  except on E: Exception do StatusLabel.Caption := 'Unable to start the local editor: ' + E.Message end;
end;

procedure TMainForm.FormDestroy(Sender: TObject);
begin
  if Assigned(FBridgeSession) then FBridgeSession.Revoke;
  FreeAndNil(FBridgeSession);
end;

procedure TMainForm.FormCloseQuery(Sender: TObject; var CanClose: Boolean);
begin
  if FLocalAIWorking then begin
    CanClose := False;
    StatusLabel.Caption := 'Local AI is running. Please wait for it to finish.';
    Exit;
  end;
  if (FDownloadPending or (FActiveProjectSaves > 0)) and
    (not FCloseWarningShown or (StatusLabel.Caption <> 'A save is in progress. Wait for it to finish, or close again to interrupt it.')) then begin
    FCloseWarningShown := True;
    CanClose := False;
    StatusLabel.Caption := 'A save is in progress. Wait for it to finish, or close again to interrupt it.';
  end else begin
    CanClose := True;
    if not FDownloadPending and (FActiveProjectSaves = 0) then FCloseWarningShown := False;
  end;
end;

procedure TMainForm.LocalAIItemClick(Sender: TObject);
var
  Dialog: TLocalAIForm;
  RuntimeArchive, ModelFile, Brief, RequestId, ProposalKind: string;
  Guid: TGUID;
  JsonId: TJSONString;
begin
  if FLocalAIWorking then Exit;
  if EditorBrowser.DefaultInterface = nil then begin
    MessageDlg('Wait for the local editor to finish loading.', mtInformation, [mbOK], 0);
    Exit;
  end;
  if not EditorBrowser.LocationURL.StartsWith('https://webstudio.local/index.html#/editor') then begin
    MessageDlg('Open a project in the editor before using Local AI.', mtInformation, [mbOK], 0);
    Exit;
  end;
  Dialog := TLocalAIForm.Create(Self);
  try
    if Dialog.ShowModal <> mrOk then Exit;
    RuntimeArchive := Dialog.RuntimeEdit.Text;
    ModelFile := Dialog.ModelEdit.Text;
    Brief := Dialog.BriefMemo.Text;
    case Dialog.ProposalKind.ItemIndex of
      1: ProposalKind := 'theme';
      2: ProposalKind := 'page';
    else ProposalKind := 'pages' end;
  finally
    Dialog.Free;
  end;
  CreateGUID(Guid);
  RequestId := GUIDToString(Guid).Replace('{', '').Replace('}', '');
  JsonId := TJSONString.Create(RequestId);
  try
    EditorBrowser.ExecuteScript('window.dispatchEvent(new CustomEvent("webstudio-local-plan-started",{detail:' + JsonId.ToJSON + '}));');
  finally
    JsonId.Free;
  end;
  FLocalAIWorking := True;
  LocalAIItem.Enabled := False;
  StatusLabel.Caption := 'Local AI is preparing the model and planning pages...';
  TThread.CreateAnonymousThread(
    procedure
    var Plan, Failure: string;
    begin
      try
        Plan := RunLocalSitePlan(RuntimeArchive, ModelFile, Brief, ProposalKind);
      except
        on E: Exception do Failure := E.Message;
      end;
      TThread.Queue(nil,
        procedure
        var Id: TJSONString;
        begin
          FLocalAIWorking := False;
          LocalAIItem.Enabled := True;
          Id := TJSONString.Create(RequestId);
          try
            if Failure = '' then begin
              EditorBrowser.ExecuteScript('window.dispatchEvent(new CustomEvent("webstudio-local-plan-completed",{detail:{requestId:' + Id.ToJSON + ',kind:"' + ProposalKind + '",plan:' + Plan + '}}));');
              StatusLabel.Caption := 'Local AI finished. Review the proposed changes.';
            end else begin
              EditorBrowser.ExecuteScript('window.dispatchEvent(new CustomEvent("webstudio-local-plan-cancelled",{detail:' + Id.ToJSON + '}));');
              StatusLabel.Caption := 'Local AI could not create a plan.';
              MessageDlg(Failure, mtError, [mbOK], 0);
            end;
          finally
            Id.Free;
          end;
        end);
    end).Start;
end;

procedure TMainForm.EditorBrowserCreateWebViewCompleted(Sender: TCustomEdgeBrowser; AResult: HResult);
var WebView3: ICoreWebView2_3; Settings: ICoreWebView2Settings; EditorPath: string;
begin
  if Winapi.Windows.Failed(AResult) or not Supports(Sender.DefaultInterface, ICoreWebView2_3, WebView3) then begin
    StatusLabel.Caption := 'WebView2 could not start or does not support local editor files.';
    Exit;
  end;
  if Winapi.Windows.Failed(Sender.DefaultInterface.Get_Settings(Settings)) or (Settings = nil) or
    Winapi.Windows.Failed(Settings.Set_IsWebMessageEnabled(1)) then begin
    StatusLabel.Caption := 'WebView2 security settings could not be applied.';
    Exit;
  end;
  EditorPath := TPath.Combine(ExtractFilePath(ParamStr(0)), 'editor');
  if Winapi.Windows.Failed(WebView3.SetVirtualHostNameToFolderMapping('webstudio.local', PWideChar(EditorPath), COREWEBVIEW2_HOST_RESOURCE_ACCESS_KIND_DENY)) then begin
    StatusLabel.Caption := 'Local editor files could not be mapped.';
    Exit;
  end;
  Sender.Navigate('https://webstudio.local/index.html');
end;

procedure TMainForm.EditorBrowserNavigationStarting(Sender: TCustomEdgeBrowser; Args: TNavigationStartingEventArgs);
var Address: PWideChar; Allowed: Boolean;
begin
  if Assigned(FBridgeSession) then FBridgeSession.Revoke;
  FreeAndNil(FBridgeSession);
  Address := nil;
  Allowed := False;
  try
    if Succeeded(Args.ArgsInterface.Get_uri(Address)) and (Address <> nil) then
      Allowed := string(Address).StartsWith('https://webstudio.local/');
  finally
    CoTaskMemFree(Address);
  end;
  if not Allowed then Args.ArgsInterface.Set_Cancel(1);
end;

procedure TMainForm.EditorBrowserWebMessageReceived(Sender: TCustomEdgeBrowser; Args: TWebMessageReceivedEventArgs);
var
  Source, Raw: PWideChar;
  SourceText, RequestId, ProjectId, Kind, CapabilityName: string;
  Parsed: TJSONValue;
  Obj, Reply: TJSONObject;
  Request: TDesktopRequest;
  Capability: TDesktopCapability;
  Index: Integer;
begin
  Source := nil; Raw := nil;
  try
   try
    if Failed(Args.ArgsInterface.Get_Source(Source)) or (Source = nil) or
       Failed(Args.ArgsInterface.Get_webMessageAsJson(Raw)) or (Raw = nil) then Exit;
    SourceText := string(Source);
    if not SourceText.StartsWith('https://webstudio.local/') or (TEncoding.UTF8.GetByteCount(string(Raw)) > 16384) then Exit;
    for Index := 1 to Length(SourceText) do if (Ord(SourceText[Index]) < 32) or (SourceText[Index] = '\') then Exit;
    Parsed := TJSONObject.ParseJSONValue(string(Raw));
    try
      if not (Parsed is TJSONObject) then Exit;
      Obj := TJSONObject(Parsed);
      if Obj.TryGetValue<string>('kind', Kind) then begin
        if (Obj.Count <> 5) or (Kind <> 'session.open') or
           not (Obj.GetValue('version') is TJSONNumber) or (Obj.GetValue('version').Value <> '1') or
           not (Obj.GetValue('requestId') is TJSONString) or not Obj.TryGetValue<string>('requestId', RequestId) or
           not (Obj.GetValue('capability') is TJSONString) or not Obj.TryGetValue<string>('capability', CapabilityName) or
           not TRegEx.IsMatch(RequestId, '^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$') then Exit;
        if CapabilityName = 'project.open' then Capability := dcProjectOpen
        else if CapabilityName = 'project.save' then Capability := dcProjectSave
        else if CapabilityName = 'media.import' then Capability := dcMediaImport
        else if CapabilityName = 'site.export' then Capability := dcSiteExport
        else Exit;
        if Obj.GetValue('projectId') is TJSONNull then ProjectId := ''
        else if not (Obj.GetValue('projectId') is TJSONString) or not Obj.TryGetValue<string>('projectId', ProjectId) or
                not TRegEx.IsMatch(ProjectId, '^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$') then Exit;
        if (ProjectId = '') and (Capability <> dcProjectOpen) then Exit;
        if Assigned(FBridgeSession) then FBridgeSession.Revoke;
        FreeAndNil(FBridgeSession);
        FBridgeSession := TDesktopSession.Create(ProjectId, [Capability]);
        Reply := TJSONObject.Create;
        try
          Reply.AddPair('version', TJSONNumber.Create(1)); Reply.AddPair('kind', 'session.open');
          Reply.AddPair('requestId', RequestId); Reply.AddPair('sessionId', FBridgeSession.SessionId);
          if ProjectId = '' then Reply.AddPair('projectId', TJSONNull.Create) else Reply.AddPair('projectId', ProjectId);
          Reply.AddPair('capability', CapabilityName);
          Sender.DefaultInterface.PostWebMessageAsJson(PWideChar(Reply.ToJSON));
        finally Reply.Free end;
      end else begin
        if not Assigned(FBridgeSession) then Exit;
        Request := FBridgeSession.ValidateAndClaim(string(Raw), SourceText);
        case Request.Capability of
          dcProjectOpen: CapabilityName := 'project.open';
          dcProjectSave: CapabilityName := 'project.save';
          dcMediaImport: CapabilityName := 'media.import';
          dcSiteExport: CapabilityName := 'site.export';
        end;
        Reply := TJSONObject.Create;
        try
          Reply.AddPair('version', TJSONNumber.Create(1)); Reply.AddPair('requestId', Request.RequestId);
          Reply.AddPair('capability', CapabilityName); Reply.AddPair('ok', TJSONBool.Create(True));
          Sender.DefaultInterface.PostWebMessageAsJson(PWideChar(Reply.ToJSON));
        finally Reply.Free end;
      end;
    finally Parsed.Free end;
   except
     { Invalid requests receive no grant and cannot access native file paths. }
   end;
  finally
    CoTaskMemFree(Source); CoTaskMemFree(Raw);
  end;
end;

procedure TMainForm.EditorBrowserNavigationCompleted(Sender: TCustomEdgeBrowser; IsSuccess: Boolean; WebErrorStatus: COREWEBVIEW2_WEB_ERROR_STATUS);
begin
  if IsSuccess then StatusLabel.Caption := 'Local editor loaded.'
  else StatusLabel.Caption := 'The local editor could not be loaded.';
end;

procedure TMainForm.EditorBrowserFrameNavigationStarting(Sender: TCustomEdgeBrowser; Args: TNavigationStartingEventArgs);
begin
  Args.ArgsInterface.Set_Cancel(1);
end;

procedure TMainForm.EditorBrowserNewWindowRequested(Sender: TCustomEdgeBrowser; Args: TNewWindowRequestedEventArgs);
begin
  Args.ArgsInterface.Set_Handled(1);
end;

procedure TMainForm.EditorBrowserPermissionRequested(Sender: TCustomEdgeBrowser; Args: TPermissionRequestedEventArgs);
var Kind: COREWEBVIEW2_PERMISSION_KIND; Address: PWideChar; Allowed: Boolean; Permission3: ICoreWebView2PermissionRequestedEventArgs3;
begin
  Address := nil;
  Allowed := False;
  try
    if Succeeded(Args.ArgsInterface.Get_PermissionKind(Kind)) and
      (Kind = COREWEBVIEW2_PERMISSION_KIND_MULTIPLE_AUTOMATIC_DOWNLOADS) and
      Succeeded(Args.ArgsInterface.Get_uri(Address)) and (Address <> nil) then
      Allowed := (string(Address) = 'https://webstudio.local') or
        string(Address).StartsWith('https://webstudio.local/');
  finally
    CoTaskMemFree(Address);
  end;
  if Allowed and Supports(Args.ArgsInterface, ICoreWebView2PermissionRequestedEventArgs3, Permission3) and
    Succeeded(Permission3.Set_SavesInProfile(0)) then Args.ArgsInterface.Set_State(COREWEBVIEW2_PERMISSION_STATE_ALLOW)
  else begin
    Args.ArgsInterface.Set_State(COREWEBVIEW2_PERMISSION_STATE_DENY);
    if Allowed then StatusLabel.Caption := 'Update the WebView2 Runtime to permit another download.';
  end;
end;

procedure TMainForm.BackupProjectItemClick(Sender: TObject);
const MaximumProjectBytes: UInt64 = 512 * 1024 * 1024;
var SourcePath, BackupPath: string;
begin
  if not BackupSourceDialog.Execute then Exit;
  SourcePath := BackupSourceDialog.FileName;
  if not SameText(TPath.GetExtension(SourcePath), '.json') and
     not SameText(TPath.GetExtension(SourcePath), '.zip') then begin
    StatusLabel.Caption := 'Backup requires a JSON or ZIP project.';
    Exit;
  end;
  BackupSaveDialog.InitialDir := TPath.GetDirectoryName(SourcePath);
  BackupSaveDialog.FileName := TPath.GetFileNameWithoutExtension(SourcePath) + '-recovery.zip';
  if not BackupSaveDialog.Execute then Exit;
  BackupPath := BackupSaveDialog.FileName;
  try
    SaveProjectRecoveryZip(SourcePath, BackupPath, MaximumProjectBytes);
    StatusLabel.Hint := BackupPath;
    StatusLabel.Caption := 'Project backup created: ' + ExtractFileName(BackupPath);
  except on E: Exception do begin
    StatusLabel.Hint := E.Message;
    StatusLabel.Caption := 'Backup failed: ' + E.Message;
  end end;
end;

procedure TMainForm.RestoreBackupItemClick(Sender: TObject);
const MaximumProjectBytes: UInt64 = 512 * 1024 * 1024;
  MaximumArchiveBytes: UInt64 = 513 * 1024 * 1024;
var BackupPath, OriginalName, Extension, TargetPath: string; Archive: TZipFile;
begin
  if not BackupOpenDialog.Execute then Exit;
  BackupPath := BackupOpenDialog.FileName;
  try
    if UInt64(TFile.GetSize(BackupPath)) > MaximumArchiveBytes then
      raise EArgumentException.Create('Backup ZIP exceeds the 513 MiB limit.');
    Archive := TZipFile.Create;
    try
      Archive.Open(BackupPath, zmRead);
      if Archive.FileCount <> 1 then raise EArgumentException.Create('Backup ZIP must contain one project file.');
      OriginalName := Archive.FileName[0];
      if (OriginalName = '') or (Pos('/', OriginalName) > 0) or (Pos('\', OriginalName) > 0) then
        raise EArgumentException.Create('Backup ZIP contains an invalid filename.');
      Extension := LowerCase(TPath.GetExtension(OriginalName));
      if (Extension <> '.json') and (Extension <> '.zip') then
        raise EArgumentException.Create('Backup ZIP must contain a JSON or ZIP project.');
    finally Archive.Free end;
    BackupRestoreDialog.InitialDir := TPath.GetDirectoryName(BackupPath);
    BackupRestoreDialog.FileName := 'Recovered-' + OriginalName;
    if not BackupRestoreDialog.Execute then Exit;
    TargetPath := BackupRestoreDialog.FileName;
    if not SameText(TPath.GetExtension(TargetPath), Extension) then
      raise EArgumentException.Create('The restored project requires the ' + Extension + ' extension.');
    RestoreProjectRecoveryZip(BackupPath, TargetPath, MaximumArchiveBytes, MaximumProjectBytes);
    StatusLabel.Hint := TargetPath;
    StatusLabel.Caption := 'Backup restored; open to verify: ' + ExtractFileName(TargetPath);
  except on E: Exception do begin
    StatusLabel.Hint := E.Message;
    StatusLabel.Caption := 'Restore failed: ' + E.Message;
  end end;
end;

procedure TMainForm.RecoverStageButtonClick(Sender: TObject);
var
  StagedPath, Name, Extension, TargetPath: string;
  Stream: TFileStream;
  Header: array[0..3] of Byte;
  Count: Integer;
begin
  if not RecoveryOpenDialog.Execute then Exit;
  StagedPath := RecoveryOpenDialog.FileName;
  Name := ExtractFileName(StagedPath);
  if not LowerCase(Name).StartsWith('.webstudio-download-') or not SameText(TPath.GetExtension(Name), '.tmp') then begin
    StatusLabel.Caption := 'Select a WebStudio staged file.';
    Exit;
  end;
  try
    Stream := TFileStream.Create(StagedPath, fmOpenRead or fmShareDenyWrite);
    try Count := Stream.Read(Header, SizeOf(Header)) finally Stream.Free end;
    if (Count >= 4) and (Header[0] = $50) and (Header[1] = $4B) and (Header[2] = $03) and (Header[3] = $04) then Extension := '.zip'
    else if (Count >= 1) and (Header[0] = Ord('{')) then Extension := '.json'
    else begin
      StatusLabel.Caption := 'The staged file is incomplete or unrecognized; it was kept.';
      Exit;
    end;
    RecoverySaveDialog.InitialDir := TPath.GetDirectoryName(StagedPath);
    RecoverySaveDialog.FileName := 'Recovered.webstudio' + Extension;
    if not RecoverySaveDialog.Execute then Exit;
    TargetPath := RecoverySaveDialog.FileName;
    if not SameText(TPath.GetExtension(TargetPath), Extension) then begin
      StatusLabel.Caption := 'Recovery requires the ' + Extension + ' extension; the staged file was kept.';
      Exit;
    end;
    CommitStagedProjectFile(StagedPath, TargetPath);
    StatusLabel.Caption := 'Recovered file may be incomplete. Open it to verify: ' + ExtractFileName(TargetPath);
  except
    StatusLabel.Caption := 'Recovery failed. The staged file was kept; choose a new name in the same folder.';
  end;
end;

procedure TMainForm.EditorBrowserDownloadStarting(Sender: TCustomEdgeBrowser; Args: TDownloadStartingEventArgs);
var
  Operation: ICoreWebView2DownloadOperation;
  DownloadArgs: ICoreWebView2DownloadStartingEventArgs;
  Deferral: ICoreWebView2Deferral;
  StateHandler: ICoreWebView2StateChangedEventHandler;
  StateToken: EventRegistrationToken;
  Address, Suggested: PWideChar;
  SuggestedName, SelectedPath, StagedPath, ProjectSuffix: string;
  StageId: TGUID;
  OwnerWindow: HWND;
  Allowed: Boolean;
  ActiveDialog: TSaveDialog;
  ReplaceExisting: Boolean;
  ConfirmedOriginal: TByHandleFileInformation;
  SelectedHandle: THandle;
begin
  Address := nil;
  Suggested := nil;
  Allowed := False;
  try
    if Succeeded(Args.ArgsInterface.Get_DownloadOperation(Operation)) and (Operation <> nil) and
      Succeeded(Operation.Get_uri(Address)) and (Address <> nil) then
      Allowed := string(Address).StartsWith('blob:https://webstudio.local/') or
        string(Address).StartsWith('https://webstudio.local/');
    if Allowed and Succeeded(Args.ArgsInterface.Get_ResultFilePath(Suggested)) and (Suggested <> nil) then
      SuggestedName := ExtractFileName(string(Suggested));
  finally
    CoTaskMemFree(Address);
    CoTaskMemFree(Suggested);
  end;
  if not Allowed or (SuggestedName = '') or FDownloadPending or
    Winapi.Windows.Failed(Args.ArgsInterface.GetDeferral(Deferral)) or (Deferral = nil) then begin
    Args.ArgsInterface.Set_Cancel(1);
    Exit;
  end;
  ProjectSuffix := '';
  if LowerCase(SuggestedName).EndsWith('.webstudio.json') then ProjectSuffix := '.webstudio.json'
  else if LowerCase(SuggestedName).EndsWith('.webstudio.zip') then ProjectSuffix := '.webstudio.zip';
  if ProjectSuffix <> '' then
    SuggestedName := Copy(SuggestedName, 1, Length(SuggestedName) - Length(ProjectSuffix)) +
      '-' + FormatDateTime('yyyymmdd-hhnnss', Now) + ProjectSuffix;
  FDownloadPending := True;
  FCloseWarningShown := False;
  OwnerWindow := Handle;
  DownloadArgs := Args.ArgsInterface;
  try
    TThread.ForceQueue(nil,
      procedure
      begin
        try
          if IsWindow(OwnerWindow) and (FindControl(OwnerWindow) = Self) and
            not (csDestroying in ComponentState) then begin
            try
              if ProjectSuffix <> '' then ActiveDialog := ProjectSaveDialog
              else ActiveDialog := SaveDownloadDialog;
              ActiveDialog.FileName := SuggestedName;
              if ActiveDialog.Execute then begin
                SelectedPath := ActiveDialog.FileName;
                StagedPath := '';
                ReplaceExisting := False;
                FillChar(ConfirmedOriginal, SizeOf(ConfirmedOriginal), 0);
                if LowerCase(SuggestedName).EndsWith('.webstudio.json') or LowerCase(SuggestedName).EndsWith('.webstudio.zip') then begin
                  if not SameText(TPath.GetExtension(SelectedPath), TPath.GetExtension(SuggestedName)) then begin
                    DownloadArgs.Set_Cancel(1);
                    StatusLabel.Caption := 'Project requires the ' + TPath.GetExtension(SuggestedName) + ' extension. Save again with that extension.';
                    FDownloadPending := False;
                    Exit;
                  end;
                  if TDirectory.Exists(SelectedPath) then begin
                    DownloadArgs.Set_Cancel(1);
                    StatusLabel.Caption := 'Choose a project filename, not a folder.';
                    FDownloadPending := False;
                    Exit;
                  end;
                  if TFile.Exists(SelectedPath) then begin
                    SelectedHandle := CreateFile(PChar(SelectedPath), GENERIC_READ, FILE_SHARE_READ or FILE_SHARE_DELETE,
                      nil, OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, 0);
                    if SelectedHandle = INVALID_HANDLE_VALUE then RaiseLastOSError;
                    try if not GetFileInformationByHandle(SelectedHandle, ConfirmedOriginal) then RaiseLastOSError
                    finally CloseHandle(SelectedHandle) end;
                    ReplaceConfirmDialog.FooterText := SelectedPath;
                    if not ReplaceConfirmDialog.Execute(OwnerWindow) or (ReplaceConfirmDialog.ModalResult <> mrYes) then begin
                      DownloadArgs.Set_Cancel(1);
                      StatusLabel.Caption := 'Replacement canceled; existing project was not changed.';
                      FDownloadPending := False;
                      Exit;
                    end;
                    ReplaceExisting := True;
                  end;
                  if CreateGUID(StageId) <> 0 then raise EInvalidOpException.Create('Could not create a staged filename.');
                  StagedPath := TPath.Combine(TPath.GetDirectoryName(SelectedPath), '.webstudio-download-' + GUIDToString(StageId) + '.tmp');
                  if TFile.Exists(StagedPath) or TDirectory.Exists(StagedPath) then raise EInvalidOpException.Create('Staged filename is already in use.');
                end;
                if StagedPath <> '' then SelectedPath := StagedPath;
                if Winapi.Windows.Failed(DownloadArgs.Set_ResultFilePath(PWideChar(SelectedPath))) or
                  Winapi.Windows.Failed(DownloadArgs.Set_Handled(1)) then begin
                  DownloadArgs.Set_Cancel(1);
                  StatusLabel.Caption := 'The download could not start.';
                end else begin
                  StateHandler := TDownloadStateHandler.Create(Self, OwnerWindow, ExtractFileName(ActiveDialog.FileName), StagedPath, ActiveDialog.FileName,
                    ReplaceExisting, ConfirmedOriginal);
                  if Winapi.Windows.Failed(Operation.add_StateChanged(StateHandler, StateToken)) then begin
                    if StagedPath <> '' then begin
                      DownloadArgs.Set_Cancel(1);
                      StatusLabel.Caption := 'Project save could not start. Try again.';
                    end else StatusLabel.Caption := 'Download started; completion status is unavailable.';
                  end else if StagedPath <> '' then Inc(FActiveProjectSaves);
                end;
              end else begin
                DownloadArgs.Set_Cancel(1);
                StatusLabel.Caption := 'Download canceled.';
              end;
            except
              DownloadArgs.Set_Cancel(1);
              if IsWindow(OwnerWindow) and (FindControl(OwnerWindow) = Self) and
                not (csDestroying in ComponentState) then
                StatusLabel.Caption := 'Download could not start. Try again.';
            end;
            if IsWindow(OwnerWindow) and (FindControl(OwnerWindow) = Self) and
              not (csDestroying in ComponentState) then FDownloadPending := False;
          end else DownloadArgs.Set_Cancel(1);
        finally
          Deferral.Complete;
        end;
      end);
  except
    FDownloadPending := False;
    DownloadArgs.Set_Cancel(1);
    Deferral.Complete;
  end;
end;
end.
