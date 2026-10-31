object MainForm: TMainForm
  Left = 0
  Top = 0
  Caption = 'Delphi Web Studio (experimental)'
  ClientHeight = 800
  ClientWidth = 1200
  Constraints.MinHeight = 480
  Constraints.MinWidth = 640
  Menu = ProjectMenu
  Position = poScreenCenter
  OnCreate = FormCreate
  OnCloseQuery = FormCloseQuery
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
      ShowHint = True
    end
    object RecoverStageButton: TButton
      Left = 1040
      Top = 0
      Width = 160
      Height = 32
      Align = alRight
      Caption = 'Recover staged file...'
      TabOrder = 0
      OnClick = RecoverStageButtonClick
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
  object RecoveryOpenDialog: TOpenDialog
    Filter = 'WebStudio staged files|.webstudio-download-*.tmp'
    Options = [ofHideReadOnly, ofNoChangeDir, ofFileMustExist, ofPathMustExist, ofEnableSizing]
    Title = 'Choose a staged file (it may be incomplete)'
    Left = 360
    Top = 48
  end
  object ProjectSaveDialog: TSaveDialog
    Filter = 'WebStudio project files|*.json;*.zip'
    Options = [ofHideReadOnly, ofNoChangeDir, ofPathMustExist, ofEnableSizing]
    Title = 'Save project'
    Left = 808
    Top = 48
  end
  object RecoverySaveDialog: TSaveDialog
    Filter = 'WebStudio projects|*.json;*.zip'
    Options = [ofHideReadOnly, ofNoChangeDir, ofPathMustExist, ofEnableSizing]
    Title = 'Save a recovered file; open it to verify'
    Left = 424
    Top = 48
  end
  object ProjectMenu: TMainMenu
    Left = 488
    Top = 48
    object ProjectMenuItem: TMenuItem
      Caption = 'Project'
      object BackupProjectItem: TMenuItem
        Caption = 'Back up project...'
        OnClick = BackupProjectItemClick
      end
      object RestoreBackupItem: TMenuItem
        Caption = 'Restore project backup...'
        OnClick = RestoreBackupItemClick
      end
    end
  end
  object BackupSourceDialog: TOpenDialog
    Filter = 'Project files|*.json;*.zip'
    Options = [ofHideReadOnly, ofNoChangeDir, ofFileMustExist, ofPathMustExist, ofEnableSizing]
    Title = 'Select a project to back up (up to 512 MiB)'
    Left = 552
    Top = 48
  end
  object BackupSaveDialog: TSaveDialog
    DefaultExt = 'zip'
    Filter = 'ZIP backup|*.zip'
    Options = [ofHideReadOnly, ofNoChangeDir, ofPathMustExist, ofEnableSizing]
    Title = 'Save project backup using a new filename'
    Left = 616
    Top = 48
  end
  object BackupOpenDialog: TOpenDialog
    Filter = 'ZIP backup|*.zip'
    Options = [ofHideReadOnly, ofNoChangeDir, ofFileMustExist, ofPathMustExist, ofEnableSizing]
    Title = 'Select a project backup to restore'
    Left = 680
    Top = 48
  end
  object BackupRestoreDialog: TSaveDialog
    Filter = 'Project files|*.json;*.zip'
    Options = [ofHideReadOnly, ofNoChangeDir, ofPathMustExist, ofEnableSizing]
    Title = 'Restore a project using a new filename'
    Left = 744
    Top = 48
  end
  object ReplaceConfirmDialog: TTaskDialog
    Caption = 'Replace project'
    CommonButtons = [tcbYes, tcbNo]
    DefaultButton = tcbNo
    MainIcon = 1
    Text = 'Replace the selected project? A recovery ZIP of the existing file will be created in a recovery folder beside it first. Projects larger than 512 MiB cannot be replaced yet.'
    Title = 'Replace the existing project?'
    Left = 872
    Top = 48
  end
end
