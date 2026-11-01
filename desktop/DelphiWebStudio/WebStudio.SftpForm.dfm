object SftpForm: TSftpForm
  BorderStyle = bsDialog
  Caption = 'SFTP connection test'
  ClientHeight = 442
  ClientWidth = 620
  Position = poScreenCenter
  OnCloseQuery = FormCloseQuery
  object HostLabel: TLabel
    Left = 16
    Top = 20
    Caption = 'Host'
  end
  object UserLabel: TLabel
    Left = 16
    Top = 57
    Caption = 'Username'
  end
  object PortLabel: TLabel
    Left = 390
    Top = 57
    Caption = 'Port'
  end
  object KeyLabel: TLabel
    Left = 16
    Top = 95
    Caption = 'Private key'
  end
  object HostsLabel: TLabel
    Left = 16
    Top = 132
    Caption = 'Trusted hosts file'
  end
  object ExplanationLabel: TLabel
    Left = 16
    Top = 174
    Width = 585
    Height = 42
    AutoSize = False
    WordWrap = True
    Caption = 'Use an SSH key and trusted hosts file. Scan or back up up to 512 MiB; backup files must be 64 MiB or less. Links are unsupported. No files are uploaded.'
  end
  object RemoteLabel: TLabel
    Left = 16
    Top = 226
    Caption = 'Remote snapshot'
  end
  object StatusLabel: TLabel
    Left = 16
    Top = 306
    Width = 585
    Height = 42
    AutoSize = False
    WordWrap = True
  end
  object FolderLabel: TLabel
    Left = 16
    Top = 266
    Caption = 'Destination folder'
  end
  object HostEdit: TEdit
    Left = 125
    Top = 16
    Width = 475
    TabOrder = 0
  end
  object UserEdit: TEdit
    Left = 125
    Top = 53
    Width = 240
    TabOrder = 1
  end
  object PortEdit: TEdit
    Left = 430
    Top = 53
    Width = 75
    TabOrder = 2
    Text = '22'
  end
  object KeyEdit: TEdit
    Left = 125
    Top = 91
    Width = 390
    TabOrder = 3
  end
  object KeyBrowse: TButton
    Left = 525
    Top = 90
    Width = 75
    Caption = 'Browse...'
    TabOrder = 4
    OnClick = KeyBrowseClick
  end
  object HostsEdit: TEdit
    Left = 125
    Top = 128
    Width = 390
    TabOrder = 5
  end
  object HostsBrowse: TButton
    Left = 525
    Top = 127
    Width = 75
    Caption = 'Browse...'
    TabOrder = 6
    OnClick = HostsBrowseClick
  end
  object RemoteEdit: TEdit
    Left = 125
    Top = 222
    Width = 475
    TabOrder = 7
    TextHint = '/path/to/website-snapshot.json'
  end
  object DownloadButton: TButton
    Left = 240
    Top = 398
    Width = 140
    Caption = 'Download snapshot...'
    TabOrder = 8
    OnClick = DownloadButtonClick
  end
  object FolderEdit: TEdit
    Left = 125
    Top = 262
    Width = 475
    TabOrder = 9
    TextHint = '/path/to/website'
  end
  object ScanButton: TButton
    Left = 75
    Top = 398
    Width = 145
    Caption = 'Scan destination...'
    TabOrder = 10
    OnClick = ScanButtonClick
  end
  object BackupButton: TButton
    Left = 75
    Top = 355
    Width = 145
    Caption = 'Back up destination...'
    TabOrder = 11
    OnClick = BackupButtonClick
  end
  object ReviewButton: TButton
    Left = 240
    Top = 355
    Width = 140
    Caption = 'Review website...'
    TabOrder = 12
    OnClick = ReviewButtonClick
  end
  object TestButton: TButton
    Left = 396
    Top = 398
    Width = 110
    Caption = 'Test connection'
    TabOrder = 13
    OnClick = TestButtonClick
  end
  object CloseButton: TButton
    Left = 525
    Top = 398
    Width = 75
    Caption = 'Close'
    ModalResult = 2
    TabOrder = 14
  end
  object KeyDialog: TOpenDialog
    Options = [ofHideReadOnly, ofNoChangeDir, ofFileMustExist, ofPathMustExist, ofEnableSizing]
    Title = 'Select SSH private key'
    Left = 32
    Top = 272
  end
  object HostsDialog: TOpenDialog
    Options = [ofHideReadOnly, ofNoChangeDir, ofFileMustExist, ofPathMustExist, ofEnableSizing]
    Title = 'Select trusted known_hosts file'
    Left = 80
    Top = 272
  end
  object SnapshotSaveDialog: TSaveDialog
    DefaultExt = 'json'
    Filter = 'Website snapshots|*.json'
    Options = [ofHideReadOnly, ofNoChangeDir, ofPathMustExist, ofEnableSizing]
    Title = 'Save snapshot with a new filename'
    Left = 128
    Top = 328
  end
  object BackupSaveDialog: TSaveDialog
    DefaultExt = 'zip'
    Filter = 'ZIP backup|*.zip'
    Options = [ofHideReadOnly, ofNoChangeDir, ofPathMustExist, ofEnableSizing]
    Title = 'Save destination backup with a new filename'
    Left = 176
    Top = 328
  end
end
