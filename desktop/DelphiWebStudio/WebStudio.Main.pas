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
    EditorBrowser: TEdgeBrowser;
    SaveDownloadDialog: TSaveDialog;
    procedure FormCreate(Sender: TObject);
    procedure EditorBrowserCreateWebViewCompleted(Sender: TCustomEdgeBrowser; AResult: HResult);
    procedure EditorBrowserNavigationStarting(Sender: TCustomEdgeBrowser; Args: TNavigationStartingEventArgs);
    procedure EditorBrowserFrameNavigationStarting(Sender: TCustomEdgeBrowser; Args: TNavigationStartingEventArgs);
    procedure EditorBrowserNavigationCompleted(Sender: TCustomEdgeBrowser; IsSuccess: Boolean; WebErrorStatus: COREWEBVIEW2_WEB_ERROR_STATUS);
    procedure EditorBrowserNewWindowRequested(Sender: TCustomEdgeBrowser; Args: TNewWindowRequestedEventArgs);
    procedure EditorBrowserPermissionRequested(Sender: TCustomEdgeBrowser; Args: TPermissionRequestedEventArgs);
    procedure EditorBrowserDownloadStarting(Sender: TCustomEdgeBrowser; Args: TDownloadStartingEventArgs);
  private
    FDownloadPending: Boolean;
  end;

var MainForm: TMainForm;

implementation

uses Winapi.ActiveX, System.IOUtils;

{$R *.dfm}

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
  else Args.ArgsInterface.Set_State(COREWEBVIEW2_PERMISSION_STATE_DENY);
end;

procedure TMainForm.EditorBrowserDownloadStarting(Sender: TCustomEdgeBrowser; Args: TDownloadStartingEventArgs);
var
  Operation: ICoreWebView2DownloadOperation;
  DownloadArgs: ICoreWebView2DownloadStartingEventArgs;
  Deferral: ICoreWebView2Deferral;
  Address, Suggested: PWideChar;
  SuggestedName: string;
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
  FDownloadPending := True;
  OwnerWindow := Handle;
  DownloadArgs := Args.ArgsInterface;
  try
    TThread.ForceQueue(nil,
      procedure
      begin
        try
          if IsWindow(OwnerWindow) and (FindControl(OwnerWindow) = Self) then begin
            try
              SaveDownloadDialog.FileName := SuggestedName;
              if SaveDownloadDialog.Execute then begin
                if Winapi.Windows.Failed(DownloadArgs.Set_ResultFilePath(PWideChar(SaveDownloadDialog.FileName))) or
                  Winapi.Windows.Failed(DownloadArgs.Set_Handled(1)) then DownloadArgs.Set_Cancel(1);
              end else DownloadArgs.Set_Cancel(1);
            except
              DownloadArgs.Set_Cancel(1);
            end;
            if IsWindow(OwnerWindow) and (FindControl(OwnerWindow) = Self) then FDownloadPending := False;
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
