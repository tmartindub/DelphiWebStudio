unit WebStudio.Main;
{$B-}

interface

uses
  Winapi.Windows, Winapi.WebView2, System.SysUtils, System.Classes,
  Vcl.Controls, Vcl.Forms, Vcl.StdCtrls, Vcl.ExtCtrls, Vcl.Edge, Vcl.Dialogs;

type
  TMainForm = class(TForm)
    StatusPanel: TPanel;
    StatusLabel: TLabel;
    RecoverStageButton: TButton;
    EditorBrowser: TEdgeBrowser;
    SaveDownloadDialog: TSaveDialog;
    RecoveryOpenDialog: TOpenDialog;
    RecoverySaveDialog: TSaveDialog;
    procedure FormCreate(Sender: TObject);
    procedure FormCloseQuery(Sender: TObject; var CanClose: Boolean);
    procedure EditorBrowserCreateWebViewCompleted(Sender: TCustomEdgeBrowser; AResult: HResult);
    procedure EditorBrowserNavigationStarting(Sender: TCustomEdgeBrowser; Args: TNavigationStartingEventArgs);
    procedure EditorBrowserFrameNavigationStarting(Sender: TCustomEdgeBrowser; Args: TNavigationStartingEventArgs);
    procedure EditorBrowserNavigationCompleted(Sender: TCustomEdgeBrowser; IsSuccess: Boolean; WebErrorStatus: COREWEBVIEW2_WEB_ERROR_STATUS);
    procedure EditorBrowserNewWindowRequested(Sender: TCustomEdgeBrowser; Args: TNewWindowRequestedEventArgs);
    procedure EditorBrowserPermissionRequested(Sender: TCustomEdgeBrowser; Args: TPermissionRequestedEventArgs);
    procedure EditorBrowserDownloadStarting(Sender: TCustomEdgeBrowser; Args: TDownloadStartingEventArgs);
    procedure RecoverStageButtonClick(Sender: TObject);
  private
    FDownloadPending: Boolean;
    FActiveProjectSaves: Integer;
    FCloseWarningShown: Boolean;
  end;

var MainForm: TMainForm;

implementation

uses Winapi.ActiveX, System.IOUtils, WebStudio.ProjectSave;

{$R *.dfm}

type
  TDownloadStateHandler = class(TInterfacedObject, ICoreWebView2StateChangedEventHandler)
  private
    FOwnerWindow: HWND;
    FOwner: TMainForm;
    FFileName: string;
    FStagedPath: string;
    FTargetPath: string;
    FFinished: Boolean;
  public
    constructor Create(AOwner: TMainForm; AOwnerWindow: HWND; const AFileName, AStagedPath, ATargetPath: string);
    function Invoke(const sender: ICoreWebView2DownloadOperation; const args: IUnknown): HResult; stdcall;
  end;

constructor TDownloadStateHandler.Create(AOwner: TMainForm; AOwnerWindow: HWND; const AFileName, AStagedPath, ATargetPath: string);
begin
  inherited Create;
  FOwner := AOwner;
  FOwnerWindow := AOwnerWindow;
  FFileName := AFileName;
  FStagedPath := AStagedPath;
  FTargetPath := ATargetPath;
end;

function TDownloadStateHandler.Invoke(const sender: ICoreWebView2DownloadOperation; const args: IUnknown): HResult;
var State: COREWEBVIEW2_DOWNLOAD_STATE;
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
          CommitStagedProjectFile(FStagedPath, FTargetPath);
        except
          if Assigned(FOwner.RecoveryOpenDialog) then FOwner.RecoveryOpenDialog.InitialDir := TPath.GetDirectoryName(FStagedPath);
          FOwner.StatusLabel.Hint := FStagedPath;
          FOwner.StatusLabel.Caption := 'Project not saved. Check staged file: ' + FStagedPath;
          Exit;
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

procedure TMainForm.FormCloseQuery(Sender: TObject; var CanClose: Boolean);
begin
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

procedure TMainForm.EditorBrowserCreateWebViewCompleted(Sender: TCustomEdgeBrowser; AResult: HResult);
var WebView3: ICoreWebView2_3; Settings: ICoreWebView2Settings; EditorPath: string;
begin
  if Winapi.Windows.Failed(AResult) or not Supports(Sender.DefaultInterface, ICoreWebView2_3, WebView3) then begin
    StatusLabel.Caption := 'WebView2 could not start or does not support local editor files.';
    Exit;
  end;
  if Winapi.Windows.Failed(Sender.DefaultInterface.Get_Settings(Settings)) or (Settings = nil) or
    Winapi.Windows.Failed(Settings.Set_IsWebMessageEnabled(0)) then begin
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
              SaveDownloadDialog.FileName := SuggestedName;
              if SaveDownloadDialog.Execute then begin
                SelectedPath := SaveDownloadDialog.FileName;
                StagedPath := '';
                if LowerCase(SuggestedName).EndsWith('.webstudio.json') or LowerCase(SuggestedName).EndsWith('.webstudio.zip') then begin
                  if not SameText(TPath.GetExtension(SelectedPath), TPath.GetExtension(SuggestedName)) then begin
                    DownloadArgs.Set_Cancel(1);
                    StatusLabel.Caption := 'Project requires the ' + TPath.GetExtension(SuggestedName) + ' extension. Save again with that extension.';
                    FDownloadPending := False;
                    Exit;
                  end;
                  if TFile.Exists(SelectedPath) or TDirectory.Exists(SelectedPath) then begin
                    DownloadArgs.Set_Cancel(1);
                    StatusLabel.Caption := 'Existing project was not replaced. Save using a new filename.';
                    FDownloadPending := False;
                    Exit;
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
                  StateHandler := TDownloadStateHandler.Create(Self, OwnerWindow, ExtractFileName(SaveDownloadDialog.FileName), StagedPath, SaveDownloadDialog.FileName);
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
