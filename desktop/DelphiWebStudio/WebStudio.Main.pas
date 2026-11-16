unit WebStudio.Main;
{$B-}

interface

uses
  Winapi.Windows, Winapi.Messages, Winapi.WebView2, System.SysUtils, System.Classes,
  Vcl.Controls, Vcl.Forms, Vcl.StdCtrls, Vcl.ExtCtrls, Vcl.Edge, Vcl.Dialogs, Vcl.Menus,
  WebStudio.Bridge, WebStudio.WebsitePreview, System.Generics.Collections;

type
  TMainForm = class(TForm, ICoreWebView2ContextMenuRequestedEventHandler)
    StatusPanel: TPanel;
    StatusLabel: TLabel;
    RecoverStageButton: TButton;
    EditorBrowser: TEdgeBrowser;
    SaveDownloadDialog: TSaveDialog;
    TextFontDialog: TFontDialog;
    EditorColorDialog: TColorDialog;
    ProjectSaveDialog: TSaveDialog;
    RecoveryOpenDialog: TOpenDialog;
    RecoverySaveDialog: TSaveDialog;
    ProjectMenu: TMainMenu;
    ProjectMenuItem: TMenuItem;
    OpenProjectItem: TMenuItem;
    SaveProjectItem: TMenuItem;
    SaveProjectAsItem: TMenuItem;
    ProjectSeparator: TMenuItem;
    BackupProjectItem: TMenuItem;
    RestoreBackupItem: TMenuItem;
    ExitItem: TMenuItem;
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
    procedure ExitItemClick(Sender: TObject);
    procedure OpenProjectItemClick(Sender: TObject);
    procedure SaveProjectItemClick(Sender: TObject);
    procedure SaveProjectAsItemClick(Sender: TObject);
    procedure LocalAIItemClick(Sender: TObject);
    procedure SftpItemClick(Sender: TObject);
    procedure DiagnosticsItemClick(Sender: TObject);
    function Invoke(const Sender: ICoreWebView2; const Args: ICoreWebView2ContextMenuRequestedEventArgs): HResult; stdcall;
  private
    FTextContextToken: EventRegistrationToken;
    FTextContextRegistered: Boolean;
    FTextContextRequest: string;
    FTextContextRequestedAt: UInt64;
    FDownloadPending: Boolean;
    FActiveProjectSaves: Integer;
    FCloseWarningShown: Boolean;
    FLocalAIWorking: Boolean;
    FProjectDirty: Boolean;
    FEditorActive: Boolean;
    FCloseAfterSave: Boolean;
    FCloseSaveToken: string;
    FBridgeSession: TDesktopSession;
    FProjectPaths: TDictionary<string, string>;
    FProjectVersions: TDictionary<string, TByHandleFileInformation>;
    FSaveProjectId: string;
    FSaveAsNext: Boolean;
    FWebsitePreview: TWebsitePreview;
    FPreviewArmToken: string;
    FPreviewStagePath: string;
    procedure CompleteWebsitePreview(const Token: string; Completed: Boolean);
  end;

var MainForm: TMainForm;

implementation

uses Winapi.ActiveX, Winapi.ShellAPI, System.IOUtils, System.Zip, System.JSON, System.UITypes, System.RegularExpressions,
  Vcl.Graphics,
  WebStudio.ProjectSave, WebStudio.LocalAIForm, WebStudio.LocalAIHost, WebStudio.SftpForm,
  WebStudio.Credentials;

{$R *.dfm}

procedure TMainForm.ExitItemClick(Sender: TObject);
begin
  Close;
end;

procedure TMainForm.OpenProjectItemClick(Sender: TObject);
begin
  if EditorBrowser.DefaultInterface <> nil then
    EditorBrowser.ExecuteScript('document.querySelector(''[data-project-command="open"]'')?.click();');
end;

procedure TMainForm.SaveProjectItemClick(Sender: TObject);
begin
  if EditorBrowser.DefaultInterface <> nil then
    EditorBrowser.ExecuteScript('document.querySelector(''[data-project-command="save"]'')?.click();');
end;

procedure TMainForm.SaveProjectAsItemClick(Sender: TObject);
begin
  if EditorBrowser.DefaultInterface <> nil then
    EditorBrowser.ExecuteScript('document.querySelector(''[data-project-command="save-as"]'')?.click();');
end;

procedure TMainForm.DiagnosticsItemClick(Sender: TObject);
var RuntimeVersion, EditorState: string;
begin
  RuntimeVersion := '';
  try RuntimeVersion := EditorBrowser.BrowserVersionInfo except RuntimeVersion := '' end;
  if RuntimeVersion = '' then RuntimeVersion := 'Not available';
  if StatusLabel.Caption = 'Local editor loaded.' then EditorState := 'Loaded'
  else EditorState := 'Not loaded; check the status line';
  DiagnosticsDialog.Text := 'Desktop version: 1.0.0 (build 1); file version 1.0.0.1; ' +
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
    FSaveToken: string;
    FProjectId: string;
    FReplaceExisting: Boolean;
    FConfirmedOriginal: TByHandleFileInformation;
    FFinished: Boolean;
    FPreviewToken: string;
  public
    constructor Create(AOwner: TMainForm; AOwnerWindow: HWND; const AFileName, AStagedPath, ATargetPath, ASaveToken, AProjectId: string;
      AReplaceExisting: Boolean; const AConfirmedOriginal: TByHandleFileInformation; const APreviewToken: string = '');
    function Invoke(const sender: ICoreWebView2DownloadOperation; const args: IUnknown): HResult; stdcall;
  end;

constructor TDownloadStateHandler.Create(AOwner: TMainForm; AOwnerWindow: HWND; const AFileName, AStagedPath, ATargetPath, ASaveToken, AProjectId: string;
  AReplaceExisting: Boolean; const AConfirmedOriginal: TByHandleFileInformation; const APreviewToken: string);
begin
  inherited Create;
  FOwner := AOwner;
  FOwnerWindow := AOwnerWindow;
  FFileName := AFileName;
  FStagedPath := AStagedPath;
  FTargetPath := ATargetPath;
  FSaveToken := ASaveToken;
  FProjectId := AProjectId;
  FReplaceExisting := AReplaceExisting;
  FConfirmedOriginal := AConfirmedOriginal;
  FPreviewToken := APreviewToken;
end;

function TDownloadStateHandler.Invoke(const sender: ICoreWebView2DownloadOperation; const args: IUnknown): HResult;
var State: COREWEBVIEW2_DOWNLOAD_STATE; RetainedOriginal: string;
  StageStream, EntryStream: TStream; Zip: TZipFile; ZipHeader: TZipHeader;
  Bytes: TBytes; Document, Config, Pages: TJSONValue; Index, ManifestIndex, ManifestCount: Integer;
  ExtraByte: Byte; ValidatedStage, SavedInfo: TByHandleFileInformation; SavedReply: TJSONObject;
  SavedHandle: THandle; SaveSucceeded: Boolean;
begin
  Result := S_OK;
  SaveSucceeded := False;
  if not IsWindow(FOwnerWindow) or (FindControl(FOwnerWindow) <> FOwner) or
    (csDestroying in FOwner.ComponentState) or not Assigned(FOwner.StatusLabel) or
    Winapi.Windows.Failed(sender.Get_State(State)) then Exit;
  if (State <> COREWEBVIEW2_DOWNLOAD_STATE_COMPLETED) and (State <> COREWEBVIEW2_DOWNLOAD_STATE_INTERRUPTED) then Exit;
  if FPreviewToken <> '' then begin
    if not FFinished then begin
      FFinished := True;
      FOwner.CompleteWebsitePreview(FPreviewToken, State = COREWEBVIEW2_DOWNLOAD_STATE_COMPLETED);
    end;
    Exit;
  end;
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
                raise EArgumentException.Create('The staged file is not a supported Delphi Web Studio Pro project.');
              Config := TJSONObject(Document).GetValue('config');
              if not (Config is TJSONObject) or not (TJSONObject(Config).GetValue('name') is TJSONString) then
                raise EArgumentException.Create('The staged project configuration is invalid.');
              Pages := TJSONObject(Config).GetValue('pages');
              if not (Pages is TJSONArray) or (TJSONArray(Pages).Count = 0) then
                raise EArgumentException.Create('The staged project has no pages.');
            finally Document.Free end;
            FOwner.StatusLabel.Caption := 'Replacing project...';
            FOwner.StatusLabel.Update;
            ReplaceStagedProjectFile(FStagedPath, FTargetPath,
              FConfirmedOriginal, ValidatedStage, RetainedOriginal);
            FOwner.StatusLabel.Hint := '';
            if RetainedOriginal <> '' then begin
              FOwner.StatusLabel.Hint := 'Original also retained: ' + RetainedOriginal;
              FOwner.StatusLabel.Caption := 'Project replaced; original also retained. Hover for paths.';
            end else FOwner.StatusLabel.Caption := 'Project saved.';
            if (FSaveToken <> '') and (FOwner.EditorBrowser.DefaultInterface <> nil) then begin
              SaveSucceeded := True;
              if FProjectId <> '' then FOwner.FProjectPaths.AddOrSetValue(FProjectId, FTargetPath);
              SavedHandle := CreateFile(PChar(FTargetPath), GENERIC_READ, FILE_SHARE_READ or FILE_SHARE_DELETE, nil, OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, 0);
              if SavedHandle <> INVALID_HANDLE_VALUE then begin
                try if GetFileInformationByHandle(SavedHandle, SavedInfo) then FOwner.FProjectVersions.AddOrSetValue(FTargetPath, SavedInfo)
                finally CloseHandle(SavedHandle) end;
              end;
              SavedReply := TJSONObject.Create;
              try
                SavedReply.AddPair('version', TJSONNumber.Create(1)); SavedReply.AddPair('kind', 'project.save.complete');
                SavedReply.AddPair('token', FSaveToken); SavedReply.AddPair('path', FTargetPath);
                FOwner.EditorBrowser.DefaultInterface.PostWebMessageAsJson(PWideChar(SavedReply.ToJSON));
              finally SavedReply.Free end;
            end;
            Exit;
          end else begin
            CommitStagedProjectFile(FStagedPath, FTargetPath);
            if (FSaveToken <> '') and (FOwner.EditorBrowser.DefaultInterface <> nil) then begin
              SaveSucceeded := True;
              if FProjectId <> '' then FOwner.FProjectPaths.AddOrSetValue(FProjectId, FTargetPath);
              SavedHandle := CreateFile(PChar(FTargetPath), GENERIC_READ, FILE_SHARE_READ or FILE_SHARE_DELETE, nil, OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, 0);
              if SavedHandle <> INVALID_HANDLE_VALUE then begin
                try if GetFileInformationByHandle(SavedHandle, SavedInfo) then FOwner.FProjectVersions.AddOrSetValue(FTargetPath, SavedInfo)
                finally CloseHandle(SavedHandle) end;
              end;
              SavedReply := TJSONObject.Create;
              try
                SavedReply.AddPair('version', TJSONNumber.Create(1)); SavedReply.AddPair('kind', 'project.save.complete');
                SavedReply.AddPair('token', FSaveToken); SavedReply.AddPair('path', FTargetPath);
                FOwner.EditorBrowser.DefaultInterface.PostWebMessageAsJson(PWideChar(SavedReply.ToJSON));
              finally SavedReply.Free end;
            end;
          end;
        except
          on E: Exception do begin
            if (FSaveToken <> '') and (FSaveToken = FOwner.FCloseSaveToken) then begin FOwner.FCloseAfterSave := False; FOwner.FCloseSaveToken := '' end;
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
      if (FSaveToken <> '') and (FSaveToken = FOwner.FCloseSaveToken) then begin FOwner.FCloseAfterSave := False; FOwner.FCloseSaveToken := '' end;
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
    if (FSaveToken <> '') and not SaveSucceeded and (FOwner.EditorBrowser.DefaultInterface <> nil) then begin
      SavedReply := TJSONObject.Create;
      try
        SavedReply.AddPair('version', TJSONNumber.Create(1)); SavedReply.AddPair('kind', 'project.save.result');
        SavedReply.AddPair('token', FSaveToken); SavedReply.AddPair('status', 'failed');
        SavedReply.AddPair('message', FOwner.StatusLabel.Caption);
        FOwner.EditorBrowser.DefaultInterface.PostWebMessageAsJson(PWideChar(SavedReply.ToJSON));
      finally SavedReply.Free end;
    end;
    if FStagedPath <> '' then begin
      if FOwner.FActiveProjectSaves > 0 then Dec(FOwner.FActiveProjectSaves);
      FOwner.FCloseWarningShown := False;
    end;
  end;
end;

procedure TMainForm.FormCreate(Sender: TObject);
begin
  FProjectDirty := True;
  FProjectPaths := TDictionary<string, string>.Create;
  FProjectVersions := TDictionary<string, TByHandleFileInformation>.Create;
  if not TFile.Exists(TPath.Combine(ExtractFilePath(ParamStr(0)), 'editor\index.html')) then begin
    StatusLabel.Caption := 'Local editor files are missing. Build and stage the editor first.';
    Exit;
  end;
  try
    EditorBrowser.CreateWebView;
  except on E: Exception do StatusLabel.Caption := 'Unable to start the local editor: ' + E.Message end;
end;

procedure TMainForm.FormDestroy(Sender: TObject);
var WebView11: ICoreWebView2_11;
begin
  if FTextContextRegistered and Supports(EditorBrowser.DefaultInterface, ICoreWebView2_11, WebView11) then
    WebView11.remove_ContextMenuRequested(FTextContextToken);
  FreeAndNil(FWebsitePreview);
  if FPreviewStagePath <> '' then DeleteFile(PChar(FPreviewStagePath));
  FreeAndNil(FProjectVersions);
  FreeAndNil(FProjectPaths);
  if Assigned(FBridgeSession) then FBridgeSession.Revoke;
  FreeAndNil(FBridgeSession);
end;

procedure TMainForm.CompleteWebsitePreview(const Token: string; Completed: Boolean);
var Reply: TJSONObject; PreviewAddress: string;
begin
  try
    try
      if not Completed then raise EInvalidOpException.Create('The reviewed website could not be prepared.');
      FreeAndNil(FWebsitePreview);
      FWebsitePreview := TWebsitePreview.Create(FPreviewStagePath, Token);
      PreviewAddress := FWebsitePreview.Address;
      if NativeInt(ShellExecute(Handle, 'open', PChar(PreviewAddress), nil, nil, SW_SHOWNORMAL)) <= 32 then
        raise EInvalidOpException.Create('Windows could not open the browser.');
      StatusLabel.Caption := 'Local website preview opened.';
    except on E: Exception do begin
      FreeAndNil(FWebsitePreview);
      Completed := False;
      StatusLabel.Caption := E.Message;
    end end;
    if EditorBrowser.DefaultInterface <> nil then begin
      Reply := TJSONObject.Create;
      try
        Reply.AddPair('version', TJSONNumber.Create(1));
        Reply.AddPair('kind', 'site.preview.result');
        Reply.AddPair('token', Token);
        Reply.AddPair('ok', TJSONBool.Create(Completed));
        Reply.AddPair('message', StatusLabel.Caption);
        EditorBrowser.DefaultInterface.PostWebMessageAsJson(PWideChar(Reply.ToJSON));
      finally Reply.Free end;
    end;
  finally
    if not Completed and (FPreviewStagePath <> '') then DeleteFile(PChar(FPreviewStagePath));
    FPreviewStagePath := '';
  end;
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
    if FProjectDirty and (FEditorActive or EditorBrowser.LocationURL.StartsWith('https://webstudio.local/index.html#/editor')) then
      case MessageDlg('Save your project before exiting?', mtConfirmation, [mbYes, mbNo, mbCancel], 0) of
        mrYes: begin
          CanClose := False;
          FCloseAfterSave := True;
          FCloseSaveToken := '';
          SaveProjectItemClick(Sender);
          StatusLabel.Caption := 'Choose where to save. The editor will close after a successful save.';
        end;
        mrCancel: CanClose := False;
      end;
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
var WebView3: ICoreWebView2_3; WebView11: ICoreWebView2_11; Settings: ICoreWebView2Settings; EditorPath: string;
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
  if Supports(Sender.DefaultInterface, ICoreWebView2_11, WebView11) and
    Succeeded(WebView11.add_ContextMenuRequested(Self, FTextContextToken)) then begin
    FTextContextRegistered := True;
    EditorBrowser.InitScript.Add('window.webstudioNativeSpellingMenu = true;');
  end;
  Sender.Navigate('https://webstudio.local/index.html');
end;

function TMainForm.Invoke(const Sender: ICoreWebView2; const Args: ICoreWebView2ContextMenuRequestedEventArgs): HResult;
var
  Target: ICoreWebView2ContextMenuTarget;
  Items: ICoreWebView2ContextMenuItemCollection;
  Item: ICoreWebView2ContextMenuItem;
  Count, Index: SYSUINT;
  Editable: Integer;
  Name: PWideChar;
  NativeSpelling: Boolean;
  RequestId: string;
  Reply: TJSONObject;
begin
  Result := S_OK;
  RequestId := FTextContextRequest;
  FTextContextRequest := '';
  if (RequestId = '') or (GetTickCount64 - FTextContextRequestedAt > 2000) then Exit;
  NativeSpelling := False;
  if Succeeded(Args.Get_ContextMenuTarget(Target)) and (Target <> nil) and
    Succeeded(Target.Get_IsEditable(Editable)) and (Editable <> 0) and
    Succeeded(Args.Get_MenuItems(Items)) and (Items <> nil) and Succeeded(Items.Get_Count(Count)) then begin
    for Index := 0 to Count do begin
      if Index = Count then Break;
      Item := nil;
      if Failed(Items.GetValueAtIndex(Index, Item)) or (Item = nil) then Continue;
      Name := nil;
      try
        if Succeeded(Item.Get_name(Name)) and (Name <> nil) and SameText(string(Name), 'spellCheck') then
          NativeSpelling := True;
      finally CoTaskMemFree(Name) end;
      if NativeSpelling then Break;
    end;
  end;
  // Keep WebView2's own spelling commands and dictionary behavior for flagged words.
  // Other rich-text clicks retain the editor's compact formatting menu.
  Args.Set_Handled(Ord(not NativeSpelling));
  Reply := TJSONObject.Create;
  try
    Reply.AddPair('version', TJSONNumber.Create(1));
    Reply.AddPair('kind', 'ui.text.context'); Reply.AddPair('requestId', RequestId);
    Reply.AddPair('native', TJSONBool.Create(NativeSpelling));
    Sender.PostWebMessageAsJson(PWideChar(Reply.ToJSON));
  finally Reply.Free end;
end;

procedure TMainForm.EditorBrowserNavigationStarting(Sender: TCustomEdgeBrowser; Args: TNavigationStartingEventArgs);
var Address: PWideChar; Allowed: Boolean;
begin
  FTextContextRequest := '';
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
  SourceText, RequestId, ProjectId, Kind, CapabilityName, Secret, FontName, ColorText: string;
  Parsed: TJSONValue;
  Obj, Reply: TJSONObject;
  Request: TDesktopRequest;
  Capability: TDesktopCapability;
  Index: Integer;
  FontSize, ColorValue: Integer;
  FontBold, FontItalic, FontUnderline: Boolean;
  FileArgs: ICoreWebView2WebMessageReceivedEventArgs2;
  FileObjects: ICoreWebView2ObjectCollectionView;
  FileObject: IUnknown;
  NativeFile: ICoreWebView2File;
  FileCount: SYSUINT;
  FilePath: PWideChar;
  OpenHandle: THandle; OpenInfo: TByHandleFileInformation;
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
        if Kind = 'ui.text.context' then begin
          if FTextContextRegistered and
            ((SourceText = 'https://webstudio.local/index.html') or SourceText.StartsWith('https://webstudio.local/index.html#/')) and
            (Obj.Count = 3) and (Obj.GetValue('version') is TJSONNumber) and (Obj.GetValue('version').Value = '1') and
            (Obj.GetValue('requestId') is TJSONString) and Obj.TryGetValue<string>('requestId', RequestId) and
            TRegEx.IsMatch(RequestId, '^[0-9a-f-]{36}$') then begin
            FTextContextRequest := RequestId;
            FTextContextRequestedAt := GetTickCount64;
          end;
          Exit;
        end;
        if ((SourceText = 'https://webstudio.local/index.html') or SourceText.StartsWith('https://webstudio.local/index.html#/')) and
          (Obj.GetValue('version') is TJSONNumber) and (Obj.GetValue('version').Value = '1') then begin
          if (Kind = 'project.saveAs') and (Obj.Count = 2) then begin FSaveAsNext := True; Exit end;
          if (Kind = 'site.preview.prepare') and (Obj.Count = 3) and
            Obj.TryGetValue<string>('token', RequestId) and TRegEx.IsMatch(RequestId, '^[0-9a-f-]{36}$') then begin
            if FPreviewStagePath <> '' then Exit;
            FPreviewArmToken := RequestId;
            Reply := TJSONObject.Create;
            try
              Reply.AddPair('version', TJSONNumber.Create(1));
              Reply.AddPair('kind', 'site.preview.ready');
              Reply.AddPair('token', RequestId);
              Sender.DefaultInterface.PostWebMessageAsJson(PWideChar(Reply.ToJSON));
            finally Reply.Free end;
            Exit;
          end;
          if (Kind = 'site.preview.stop') and (Obj.Count = 2) then begin
            FPreviewArmToken := '';
            if FPreviewStagePath = '' then FreeAndNil(FWebsitePreview);
            Exit;
          end;
          if (Kind = 'project.opened') and (Obj.Count = 3) and Obj.TryGetValue<string>('projectId', ProjectId) and
            TRegEx.IsMatch(ProjectId, '^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$') and
            Supports(Args.ArgsInterface, ICoreWebView2WebMessageReceivedEventArgs2, FileArgs) and
            Succeeded(FileArgs.Get_additionalObjects(FileObjects)) and (FileObjects <> nil) and
            Succeeded(FileObjects.Get_Count(FileCount)) and (FileCount = 1) and
            Succeeded(FileObjects.GetValueAtIndex(0, FileObject)) and Supports(FileObject, ICoreWebView2File, NativeFile) then begin
            FilePath := nil;
            try
              if Succeeded(NativeFile.Get_Path(FilePath)) and (FilePath <> nil) and TFile.Exists(string(FilePath)) and
                (SameText(TPath.GetExtension(string(FilePath)), '.zip') or SameText(TPath.GetExtension(string(FilePath)), '.json')) then begin
                FProjectPaths.AddOrSetValue(ProjectId, string(FilePath));
                OpenHandle := CreateFile(FilePath, GENERIC_READ, FILE_SHARE_READ or FILE_SHARE_DELETE, nil, OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, 0);
                if OpenHandle <> INVALID_HANDLE_VALUE then begin
                  try if GetFileInformationByHandle(OpenHandle, OpenInfo) then FProjectVersions.AddOrSetValue(string(FilePath), OpenInfo)
                  finally CloseHandle(OpenHandle) end;
                end;
                Reply := TJSONObject.Create;
                try
                  Reply.AddPair('version', TJSONNumber.Create(1)); Reply.AddPair('kind', 'project.file.location');
                  Reply.AddPair('projectId', ProjectId); Reply.AddPair('path', string(FilePath));
                  Sender.DefaultInterface.PostWebMessageAsJson(PWideChar(Reply.ToJSON));
                finally Reply.Free end;
              end;
            finally if FilePath <> nil then CoTaskMemFree(FilePath) end;
            Exit;
          end;
        end;
        if (Kind = 'project.save.failed') and
           ((SourceText = 'https://webstudio.local/index.html') or SourceText.StartsWith('https://webstudio.local/index.html#/')) and
           (Obj.Count = 2) and (Obj.GetValue('version') is TJSONNumber) and (Obj.GetValue('version').Value = '1') then begin
          FCloseAfterSave := False;
          FCloseSaveToken := '';
          FSaveAsNext := False;
        end;
        if Kind = 'project.save.confirmed' then begin
          if ((SourceText = 'https://webstudio.local/index.html') or SourceText.StartsWith('https://webstudio.local/index.html#/')) and
             (Obj.Count = 4) and (Obj.GetValue('version') is TJSONNumber) and (Obj.GetValue('version').Value = '1') and
             (Obj.GetValue('token') is TJSONString) and Obj.TryGetValue<string>('token', RequestId) and
             (Obj.GetValue('clean') is TJSONBool) and FCloseAfterSave and (FCloseSaveToken <> '') and (RequestId = FCloseSaveToken) then begin
            FCloseAfterSave := False;
            FCloseSaveToken := '';
            FProjectDirty := Obj.GetValue('clean').Value <> 'true';
            if FProjectDirty then StatusLabel.Caption := 'The project changed during saving. Save again before exiting.'
            else PostMessage(Handle, WM_CLOSE, 0, 0);
          end;
          Exit;
        end;
        if Kind = 'project.dirty' then begin
          if ((SourceText = 'https://webstudio.local/index.html') or SourceText.StartsWith('https://webstudio.local/index.html#/')) and
             (Obj.Count = 4) and (Obj.GetValue('version') is TJSONNumber) and (Obj.GetValue('version').Value = '1') and
             (Obj.GetValue('dirty') is TJSONBool) and (Obj.GetValue('editing') is TJSONBool) then begin
            FProjectDirty := Obj.GetValue('dirty').Value = 'true';
            FEditorActive := Obj.GetValue('editing').Value = 'true';
          end;
          Exit;
        end;
        if Kind = 'ui.color' then begin
          if not ((SourceText = 'https://webstudio.local/index.html') or SourceText.StartsWith('https://webstudio.local/index.html#/')) or
             (Obj.Count <> 4) or not (Obj.GetValue('version') is TJSONNumber) or (Obj.GetValue('version').Value <> '1') or
             not (Obj.GetValue('requestId') is TJSONString) or not Obj.TryGetValue<string>('requestId', RequestId) or
             not TRegEx.IsMatch(RequestId, '^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$') or
             not (Obj.GetValue('color') is TJSONString) or not Obj.TryGetValue<string>('color', ColorText) or
             not TRegEx.IsMatch(ColorText, '^#[0-9a-fA-F]{6}$') then Exit;
          EditorColorDialog.Color := RGB(StrToInt('$' + Copy(ColorText, 2, 2)), StrToInt('$' + Copy(ColorText, 4, 2)), StrToInt('$' + Copy(ColorText, 6, 2)));
          Reply := TJSONObject.Create;
          try
            Reply.AddPair('version', TJSONNumber.Create(1)); Reply.AddPair('kind', Kind); Reply.AddPair('requestId', RequestId);
            if EditorColorDialog.Execute then begin
              ColorValue := ColorToRGB(EditorColorDialog.Color);
              Reply.AddPair('accepted', TJSONBool.Create(True));
              Reply.AddPair('color', Format('#%.2x%.2x%.2x', [GetRValue(ColorValue), GetGValue(ColorValue), GetBValue(ColorValue)]));
            end else Reply.AddPair('accepted', TJSONBool.Create(False));
            Sender.DefaultInterface.PostWebMessageAsJson(PWideChar(Reply.ToJSON));
          finally Reply.Free end;
          Exit;
        end;
        if Kind = 'ui.font' then begin
          if not ((SourceText = 'https://webstudio.local/index.html') or SourceText.StartsWith('https://webstudio.local/index.html#/')) or
             (Obj.Count <> 9) or not (Obj.GetValue('version') is TJSONNumber) or (Obj.GetValue('version').Value <> '1') or
             not (Obj.GetValue('requestId') is TJSONString) or not Obj.TryGetValue<string>('requestId', RequestId) or not TRegEx.IsMatch(RequestId, '^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$') or
             not (Obj.GetValue('font') is TJSONString) or not Obj.TryGetValue<string>('font', FontName) or (Length(FontName) > 100) or
             not TRegEx.IsMatch(FontName, '^[\p{L}\p{N} ,._-]{1,100}$') or
             not (Obj.GetValue('size') is TJSONNumber) or not Obj.TryGetValue<Integer>('size', FontSize) or (FontSize < 6) or (FontSize > 200) or
             not (Obj.GetValue('color') is TJSONString) or not Obj.TryGetValue<string>('color', ColorText) or not TRegEx.IsMatch(ColorText, '^#[0-9a-fA-F]{6}$') or
             not (Obj.GetValue('bold') is TJSONBool) or not (Obj.GetValue('italic') is TJSONBool) or
             not (Obj.GetValue('underline') is TJSONBool) then Exit;
          FontBold := Obj.GetValue('bold').Value = 'true';
          FontItalic := Obj.GetValue('italic').Value = 'true';
          FontUnderline := Obj.GetValue('underline').Value = 'true';
          if Screen.Fonts.IndexOf(FontName) >= 0 then TextFontDialog.Font.Name := FontName
          else TextFontDialog.Font.Name := 'Arial';
          TextFontDialog.Font.Size := Round(FontSize * 72 / 96);
          TextFontDialog.Font.Style := [];
          if FontBold then TextFontDialog.Font.Style := TextFontDialog.Font.Style + [fsBold];
          if FontItalic then TextFontDialog.Font.Style := TextFontDialog.Font.Style + [fsItalic];
          if FontUnderline then TextFontDialog.Font.Style := TextFontDialog.Font.Style + [fsUnderline];
          TextFontDialog.Font.Color := RGB(StrToInt('$' + Copy(ColorText, 2, 2)), StrToInt('$' + Copy(ColorText, 4, 2)), StrToInt('$' + Copy(ColorText, 6, 2)));
          Reply := TJSONObject.Create;
          try
            Reply.AddPair('version', TJSONNumber.Create(1)); Reply.AddPair('kind', Kind); Reply.AddPair('requestId', RequestId);
            if TextFontDialog.Execute then begin
              ColorValue := ColorToRGB(TextFontDialog.Font.Color);
              Reply.AddPair('accepted', TJSONBool.Create(True)); Reply.AddPair('font', TextFontDialog.Font.Name);
              Reply.AddPair('size', TJSONNumber.Create(Round(TextFontDialog.Font.Size * 96 / 72)));
              Reply.AddPair('color', Format('#%.2x%.2x%.2x', [GetRValue(ColorValue), GetGValue(ColorValue), GetBValue(ColorValue)]));
              Reply.AddPair('bold', TJSONBool.Create(fsBold in TextFontDialog.Font.Style));
              Reply.AddPair('italic', TJSONBool.Create(fsItalic in TextFontDialog.Font.Style));
              Reply.AddPair('underline', TJSONBool.Create(fsUnderline in TextFontDialog.Font.Style));
            end else Reply.AddPair('accepted', TJSONBool.Create(False));
            Sender.DefaultInterface.PostWebMessageAsJson(PWideChar(Reply.ToJSON));
          finally Reply.Free end;
          Exit;
        end;
        if (Kind = 'gemini.read') or (Kind = 'gemini.write') or (Kind = 'gemini.delete') then begin
          if not ((SourceText = 'https://webstudio.local/index.html') or
              SourceText.StartsWith('https://webstudio.local/index.html#/')) or
             not (Obj.GetValue('version') is TJSONNumber) or (Obj.GetValue('version').Value <> '1') or
             not (Obj.GetValue('requestId') is TJSONString) or not Obj.TryGetValue<string>('requestId', RequestId) or
             not TRegEx.IsMatch(RequestId, '^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$') then Exit;
          if Kind = 'gemini.write' then begin
            if (Obj.Count <> 4) or not (Obj.GetValue('key') is TJSONString) or
              not Obj.TryGetValue<string>('key', Secret) or (Trim(Secret) = '') or
              (TEncoding.UTF8.GetByteCount(Secret) > 2560) then Exit;
          end else if Obj.Count <> 3 then Exit;
          Reply := TJSONObject.Create;
          try
            Reply.AddPair('version', TJSONNumber.Create(1));
            Reply.AddPair('kind', Kind);
            Reply.AddPair('requestId', RequestId);
            try
              if Kind = 'gemini.read' then begin
                Secret := ReadCredential('DelphiWebStudio/Gemini');
                Reply.AddPair('key', Secret);
              end else if Kind = 'gemini.write' then
                WriteCredential('DelphiWebStudio/Gemini', Secret)
              else DeleteCredential('DelphiWebStudio/Gemini');
              Reply.AddPair('ok', TJSONBool.Create(True));
            except
              on E: Exception do begin
                Reply.AddPair('ok', TJSONBool.Create(False));
                Reply.AddPair('error', 'Windows Credential Manager could not complete the request.');
              end;
            end;
            Sender.DefaultInterface.PostWebMessageAsJson(PWideChar(Reply.ToJSON));
          finally
            Secret := '';
            Reply.Free;
          end;
          Exit;
        end;
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
        if Capability = dcProjectSave then FSaveProjectId := ProjectId;
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
  SuggestedName, SelectedPath, StagedPath, ProjectSuffix, SaveToken, PreviewToken: string;
  SaveMatch: TMatch;
  StageId: TGUID;
  OwnerWindow: HWND;
  Allowed, UseCurrentPath, DownloadStarted, UnchangedFile: Boolean;
  SaveReply: TJSONObject; PreviousInfo: TByHandleFileInformation;
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
  SaveMatch := TRegEx.Match(SuggestedName, '^webstudio-preview-([0-9a-f-]{36})\.zip$');
  if SaveMatch.Success and (SaveMatch.Groups[1].Value = FPreviewArmToken) then begin
    PreviewToken := SaveMatch.Groups[1].Value;
    FPreviewArmToken := '';
    try
      if (FPreviewStagePath <> '') or (CreateGUID(StageId) <> 0) then begin
        DownloadArgs := Args.ArgsInterface;
        DownloadArgs.Set_Cancel(1);
        Exit;
      end;
      FPreviewStagePath := TPath.Combine(TPath.GetTempPath, 'webstudio-preview-' + GUIDToString(StageId) + '.zip');
      FillChar(ConfirmedOriginal, SizeOf(ConfirmedOriginal), 0);
      StateHandler := TDownloadStateHandler.Create(Self, Handle, SuggestedName, '', '', '', '', False, ConfirmedOriginal, PreviewToken);
      DownloadArgs := Args.ArgsInterface;
      if Failed(DownloadArgs.Set_ResultFilePath(PWideChar(FPreviewStagePath))) or Failed(DownloadArgs.Set_Handled(1)) or
        Failed(Operation.add_StateChanged(StateHandler, StateToken)) then begin
        DownloadArgs.Set_Cancel(1);
        CompleteWebsitePreview(PreviewToken, False);
      end;
    finally Deferral.Complete end;
    Exit;
  end;
  SaveToken := '';
  SaveMatch := TRegEx.Match(SuggestedName, '--ws-save-([0-9a-f-]{36})(\.webstudio\.(?:json|zip))$', [roIgnoreCase]);
  if SaveMatch.Success then begin
    SaveToken := SaveMatch.Groups[1].Value;
    SuggestedName := Copy(SuggestedName, 1, Length(SuggestedName) - Length(SaveMatch.Value)) + SaveMatch.Groups[2].Value;
  end;
  if FCloseAfterSave and (SaveToken <> '') then FCloseSaveToken := SaveToken;
  ProjectSuffix := '';
  if LowerCase(SuggestedName).EndsWith('.webstudio.json') then ProjectSuffix := '.webstudio.json'
  else if LowerCase(SuggestedName).EndsWith('.webstudio.zip') then ProjectSuffix := '.webstudio.zip';
  if ProjectSuffix <> '' then
    SuggestedName := Copy(SuggestedName, 1, Length(SuggestedName) - Length(ProjectSuffix)) +
      '-' + FormatDateTime('yyyymmdd-hhnnss', Now) + ProjectSuffix;
  DownloadStarted := False;
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
              UseCurrentPath := (ProjectSuffix <> '') and not FSaveAsNext and FProjectPaths.TryGetValue(FSaveProjectId, SelectedPath) and
                SameText(TPath.GetExtension(SelectedPath), TPath.GetExtension(SuggestedName));
              FSaveAsNext := False;
              if UseCurrentPath then ActiveDialog.FileName := SelectedPath else ActiveDialog.FileName := SuggestedName;
              if UseCurrentPath or ActiveDialog.Execute then begin
                SelectedPath := ActiveDialog.FileName;
                StagedPath := '';
                ReplaceExisting := False;
                FillChar(ConfirmedOriginal, SizeOf(ConfirmedOriginal), 0);
                if LowerCase(SuggestedName).EndsWith('.webstudio.json') or LowerCase(SuggestedName).EndsWith('.webstudio.zip') then begin
                  if not SameText(TPath.GetExtension(SelectedPath), TPath.GetExtension(SuggestedName)) then begin
                    FCloseAfterSave := False; FCloseSaveToken := '';
                    DownloadArgs.Set_Cancel(1);
                    StatusLabel.Caption := 'Project requires the ' + TPath.GetExtension(SuggestedName) + ' extension. Save again with that extension.';
                    FDownloadPending := False;
                    Exit;
                  end;
                  if TDirectory.Exists(SelectedPath) then begin
                    FCloseAfterSave := False; FCloseSaveToken := '';
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
                    UnchangedFile := UseCurrentPath and FProjectVersions.TryGetValue(ActiveDialog.FileName, PreviousInfo) and
                      (PreviousInfo.dwVolumeSerialNumber = ConfirmedOriginal.dwVolumeSerialNumber) and
                      (PreviousInfo.nFileIndexHigh = ConfirmedOriginal.nFileIndexHigh) and (PreviousInfo.nFileIndexLow = ConfirmedOriginal.nFileIndexLow) and
                      (PreviousInfo.nFileSizeHigh = ConfirmedOriginal.nFileSizeHigh) and (PreviousInfo.nFileSizeLow = ConfirmedOriginal.nFileSizeLow) and
                      CompareMem(@PreviousInfo.ftLastWriteTime, @ConfirmedOriginal.ftLastWriteTime, SizeOf(TFileTime));
                    if not UnchangedFile and (MessageBox(OwnerWindow, PChar(ReplaceConfirmDialog.Text + sLineBreak + sLineBreak + SelectedPath),
                      PChar(ReplaceConfirmDialog.Caption), MB_YESNO or MB_ICONWARNING or MB_DEFBUTTON2) <> IDYES) then begin
                      FCloseAfterSave := False; FCloseSaveToken := '';
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
                  FCloseAfterSave := False; FCloseSaveToken := '';
                  StatusLabel.Caption := 'The download could not start.';
                end else begin
                  StateHandler := TDownloadStateHandler.Create(Self, OwnerWindow, ExtractFileName(ActiveDialog.FileName), StagedPath, ActiveDialog.FileName, SaveToken, FSaveProjectId,
                    ReplaceExisting, ConfirmedOriginal);
                  if Winapi.Windows.Failed(Operation.add_StateChanged(StateHandler, StateToken)) then begin
                    if StagedPath <> '' then begin
                      FCloseAfterSave := False; FCloseSaveToken := '';
                      DownloadArgs.Set_Cancel(1);
                      StatusLabel.Caption := 'Project save could not start. Try again.';
                    end else StatusLabel.Caption := 'Download started; completion status is unavailable.';
                  end else begin DownloadStarted := True; if StagedPath <> '' then Inc(FActiveProjectSaves) end;
                end;
              end else begin
                DownloadArgs.Set_Cancel(1);
                StatusLabel.Caption := 'Download canceled.';
                if SaveToken = FCloseSaveToken then begin FCloseAfterSave := False; FCloseSaveToken := '' end;
              end;
            except
              DownloadArgs.Set_Cancel(1);
              if SaveToken = FCloseSaveToken then begin FCloseAfterSave := False; FCloseSaveToken := '' end;
              if IsWindow(OwnerWindow) and (FindControl(OwnerWindow) = Self) and
                not (csDestroying in ComponentState) then
                StatusLabel.Caption := 'Download could not start. Try again.';
            end;
            if IsWindow(OwnerWindow) and (FindControl(OwnerWindow) = Self) and
              not (csDestroying in ComponentState) then FDownloadPending := False;
          end else DownloadArgs.Set_Cancel(1);
        finally
          if not DownloadStarted and (SaveToken <> '') and IsWindow(OwnerWindow) and (FindControl(OwnerWindow) = Self) and (EditorBrowser.DefaultInterface <> nil) then begin
            SaveReply := TJSONObject.Create;
            try
              SaveReply.AddPair('version', TJSONNumber.Create(1)); SaveReply.AddPair('kind', 'project.save.result');
              SaveReply.AddPair('token', SaveToken); SaveReply.AddPair('status', 'canceled');
              SaveReply.AddPair('message', StatusLabel.Caption);
              EditorBrowser.DefaultInterface.PostWebMessageAsJson(PWideChar(SaveReply.ToJSON));
            finally SaveReply.Free end;
          end;
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
