unit WebStudio.Main;
{$B-}

interface

uses
  Winapi.Windows, Winapi.WebView2, System.SysUtils, System.Classes,
  Vcl.Controls, Vcl.Forms, Vcl.StdCtrls, Vcl.ExtCtrls, Vcl.Edge;

type
  TMainForm = class(TForm)
    StatusPanel: TPanel;
    StatusLabel: TLabel;
    EditorBrowser: TEdgeBrowser;
    procedure FormCreate(Sender: TObject);
    procedure EditorBrowserCreateWebViewCompleted(Sender: TCustomEdgeBrowser; AResult: HResult);
    procedure EditorBrowserNavigationStarting(Sender: TCustomEdgeBrowser; Args: TNavigationStartingEventArgs);
    procedure EditorBrowserNavigationCompleted(Sender: TCustomEdgeBrowser; IsSuccess: Boolean; WebErrorStatus: COREWEBVIEW2_WEB_ERROR_STATUS);
    procedure EditorBrowserNewWindowRequested(Sender: TCustomEdgeBrowser; Args: TNewWindowRequestedEventArgs);
    procedure EditorBrowserPermissionRequested(Sender: TCustomEdgeBrowser; Args: TPermissionRequestedEventArgs);
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

procedure TMainForm.EditorBrowserNewWindowRequested(Sender: TCustomEdgeBrowser; Args: TNewWindowRequestedEventArgs);
begin
  Args.ArgsInterface.Set_Handled(1);
end;

procedure TMainForm.EditorBrowserPermissionRequested(Sender: TCustomEdgeBrowser; Args: TPermissionRequestedEventArgs);
begin
  Args.ArgsInterface.Set_State(COREWEBVIEW2_PERMISSION_STATE_DENY);
end;
end.
