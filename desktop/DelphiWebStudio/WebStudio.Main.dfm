object MainForm: TMainForm
  Left = 0
  Top = 0
  Caption = 'Delphi Web Studio Pro 1.0.0 (build 1)'
  ClientHeight = 800
  ClientWidth = 1200
  Constraints.MinHeight = 480
  Constraints.MinWidth = 640
  Menu = ProjectMenu
  Position = poScreenCenter
  WindowState = wsMaximized
  OnCreate = FormCreate
  OnDestroy = FormDestroy
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
    PopupMenu = SpellingPopupMenu
    PopupMenuMode = MergeTop
    UserDataFolder = '%LOCALAPPDATA%\DelphiWebStudio\WebView'
    OnCreateWebViewCompleted = EditorBrowserCreateWebViewCompleted
    OnNavigationStarting = EditorBrowserNavigationStarting
    OnFrameNavigationStarting = EditorBrowserFrameNavigationStarting
    OnNavigationCompleted = EditorBrowserNavigationCompleted
    OnNewWindowRequested = EditorBrowserNewWindowRequested
    OnPermissionRequested = EditorBrowserPermissionRequested
    OnDownloadStarting = EditorBrowserDownloadStarting
    OnWebMessageReceived = EditorBrowserWebMessageReceived
  end
  object SaveDownloadDialog: TSaveDialog
    Filter = 'Project and website files|*.json;*.zip|All files|*.*'
    Options = [ofOverwritePrompt, ofHideReadOnly, ofNoChangeDir, ofPathMustExist, ofEnableSizing]
    Title = 'Save downloaded file'
    Left = 296
    Top = 48
  end
  object TextFontDialog: TFontDialog
    MinFontSize = 5
    MaxFontSize = 150
    Options = [fdEffects, fdForceFontExist, fdLimitSize]
    Left = 920
    Top = 48
  end
  object EditorColorDialog: TColorDialog
    Options = [cdFullOpen]
    Left = 984
    Top = 48
  end
  object RecoveryOpenDialog: TOpenDialog
    Filter = 'Delphi Web Studio Pro staged files|.webstudio-download-*.tmp'
    Options = [ofHideReadOnly, ofNoChangeDir, ofFileMustExist, ofPathMustExist, ofEnableSizing]
    Title = 'Choose a staged file (it may be incomplete)'
    Left = 360
    Top = 48
  end
  object ProjectSaveDialog: TSaveDialog
    Filter = 'Delphi Web Studio Pro project files|*.json;*.zip'
    Options = [ofHideReadOnly, ofNoChangeDir, ofPathMustExist, ofEnableSizing]
    Title = 'Save project'
    Left = 808
    Top = 48
  end
  object RecoverySaveDialog: TSaveDialog
    Filter = 'Delphi Web Studio Pro projects|*.json;*.zip'
    Options = [ofHideReadOnly, ofNoChangeDir, ofPathMustExist, ofEnableSizing]
    Title = 'Save a recovered file; open it to verify'
    Left = 424
    Top = 48
  end
  object ProjectMenu: TMainMenu
    Left = 488
    Top = 48
    object ProjectMenuItem: TMenuItem
      Caption = '&File'
      object OpenProjectItem: TMenuItem
        Caption = '&Open project...'
        OnClick = OpenProjectItemClick
      end
      object SaveProjectItem: TMenuItem
        Caption = '&Save'
        OnClick = SaveProjectItemClick
      end
      object SaveProjectAsItem: TMenuItem
        Caption = 'Save project &as...'
        OnClick = SaveProjectAsItemClick
      end
      object ProjectSeparator: TMenuItem
        Caption = '-'
      end
      object BackupProjectItem: TMenuItem
        Caption = 'Back up project...'
        OnClick = BackupProjectItemClick
      end
      object RestoreBackupItem: TMenuItem
        Caption = 'Restore project backup...'
        OnClick = RestoreBackupItemClick
      end
      object ExitItem: TMenuItem
        Caption = 'E&xit'
        OnClick = ExitItemClick
      end
    end
    object LocalAIItem: TMenuItem
      Caption = 'Local AI...'
      OnClick = LocalAIItemClick
    end
    object SftpItem: TMenuItem
      Caption = 'SFTP connection...'
      OnClick = SftpItemClick
    end
    object DiagnosticsItem: TMenuItem
      Caption = 'Diagnostics...'
      OnClick = DiagnosticsItemClick
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
    Text = 'Replace the selected project? The previous version will not be kept after the new file is saved successfully.'
    Title = 'Replace the existing project?'
    Left = 872
    Top = 48
  end
  object DiagnosticsDialog: TTaskDialog
    Caption = 'Delphi Web Studio Pro diagnostics'
    CommonButtons = [tcbOk]
    MainIcon = 0
    Title = 'Local diagnostics'
    Left = 936
    Top = 48
  end
  object SpellingPopupMenu: TPopupMenu
    AutoPopup = False
    Left = 488
    Top = 112
    object AddDictionaryItem: TMenuItem
      Caption = 'Add to &dictionary'
      Enabled = False
      Hint = 'Remember this word in the Windows spelling dictionary'
      OnClick = AddDictionaryItemClick
    end
  end
end
