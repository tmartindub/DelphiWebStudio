object MainForm: TMainForm
  Left = 0
  Top = 0
  Caption = 'Delphi Web Studio (experimental)'
  ClientHeight = 800
  ClientWidth = 1200
  Constraints.MinHeight = 480
  Constraints.MinWidth = 640
  Position = poScreenCenter
  OnCreate = FormCreate
  object StatusPanel: TPanel
    Left = 0
    Top = 0
    Width = 1200
    Height = 32
    Align = alTop
    BevelOuter = bvNone
    TabOrder = 0
    object StatusLabel: TLabel
      Left = 12
      Top = 8
      Width = 200
      Height = 15
      Caption = 'Starting local editor...'
    end
  end
  object EditorBrowser: TEdgeBrowser
    Left = 0
    Top = 32
    Width = 1200
    Height = 768
    Align = alClient
    UserDataFolder = '%LOCALAPPDATA%\DelphiWebStudio\WebView'
    OnCreateWebViewCompleted = EditorBrowserCreateWebViewCompleted
    OnNavigationStarting = EditorBrowserNavigationStarting
    OnFrameNavigationStarting = EditorBrowserFrameNavigationStarting
    OnNavigationCompleted = EditorBrowserNavigationCompleted
    OnNewWindowRequested = EditorBrowserNewWindowRequested
    OnPermissionRequested = EditorBrowserPermissionRequested
    OnDownloadStarting = EditorBrowserDownloadStarting
  end
  object SaveDownloadDialog: TSaveDialog
    Filter = 'Project and website files|*.json;*.zip|All files|*.*'
    Options = [ofOverwritePrompt, ofHideReadOnly, ofNoChangeDir, ofPathMustExist, ofEnableSizing]
    Title = 'Save downloaded file'
    Left = 296
    Top = 48
  end
end
