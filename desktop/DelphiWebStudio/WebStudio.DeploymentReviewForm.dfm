object DeploymentReviewForm: TDeploymentReviewForm
  BorderStyle = bsDialog
  Caption = 'Review website files'
  ClientHeight = 620
  ClientWidth = 700
  Position = poScreenCenter
  OnCloseQuery = FormCloseQuery
  object DestinationLabel: TLabel
    Left = 16
    Top = 16
    Width = 665
    Height = 35
    AutoSize = False
    WordWrap = True
    Caption = 'Entered destination is not checked during this local review.'
  end
  object WebsiteLabel: TLabel
    Left = 16
    Top = 61
    Caption = 'Website ZIP'
  end
  object ScanLabel: TLabel
    Left = 16
    Top = 98
    Caption = 'Destination scan'
  end
  object BackupLabel: TLabel
    Left = 16
    Top = 135
    Caption = 'Backup ZIP'
  end
  object RecoveryLabel: TLabel
    Left = 16
    Top = 172
    Caption = 'Private recovery folder'
  end
  object ReceiptLabel: TLabel
    Left = 16
    Top = 209
    Caption = 'Original receipt'
  end
  object StatusLabel: TLabel
    Left = 16
    Top = 550
    Width = 665
    Height = 30
    AutoSize = False
    WordWrap = True
  end
  object WebsiteEdit: TEdit
    Left = 135
    Top = 57
    Width = 460
    TabOrder = 0
    OnChange = InputChanged
  end
  object WebsiteBrowse: TButton
    Left = 605
    Top = 56
    Width = 75
    Caption = 'Browse...'
    TabOrder = 1
    OnClick = WebsiteBrowseClick
  end
  object ScanEdit: TEdit
    Left = 135
    Top = 94
    Width = 460
    TabOrder = 2
    OnChange = InputChanged
  end
  object ScanBrowse: TButton
    Left = 605
    Top = 93
    Width = 75
    Caption = 'Browse...'
    TabOrder = 3
    OnClick = ScanBrowseClick
  end
  object BackupEdit: TEdit
    Left = 135
    Top = 131
    Width = 460
    TabOrder = 4
    OnChange = InputChanged
  end
  object BackupBrowse: TButton
    Left = 605
    Top = 130
    Width = 75
    Caption = 'Browse...'
    TabOrder = 5
    OnClick = BackupBrowseClick
  end
  object ResultsMemo: TMemo
    Left = 16
    Top = 249
    Width = 664
    Height = 250
    ReadOnly = True
    ScrollBars = ssBoth
    TabOrder = 9
    WordWrap = False
  end
  object RecoveryEdit: TEdit
    Left = 135
    Top = 168
    Width = 545
    TabOrder = 6
    OnChange = InputChanged
  end
  object ReceiptEdit: TEdit
    Left = 135
    Top = 205
    Width = 460
    TabOrder = 7
    OnChange = InputChanged
  end
  object ReceiptBrowse: TButton
    Left = 605
    Top = 204
    Width = 75
    Caption = 'Browse...'
    TabOrder = 8
    OnClick = ReceiptBrowseClick
  end
  object ReviewButton: TButton
    Left = 490
    Top = 587
    Width = 100
    Caption = 'Review files'
    TabOrder = 13
    OnClick = ReviewButtonClick
  end
  object CheckButton: TButton
    Left = 355
    Top = 587
    Width = 120
    Caption = 'Check destination'
    Enabled = False
    TabOrder = 12
    OnClick = CheckButtonClick
  end
  object PublishButton: TButton
    Left = 245
    Top = 587
    Width = 95
    Caption = 'Publish...'
    Enabled = False
    TabOrder = 14
    OnClick = PublishButtonClick
  end
  object CloseButton: TButton
    Left = 605
    Top = 587
    Width = 75
    Caption = 'Close'
    ModalResult = 2
    TabOrder = 15
  end
  object RollbackReviewButton: TButton
    Left = 16
    Top = 510
    Width = 155
    Caption = 'Review added rollback'
    Enabled = False
    TabOrder = 10
    OnClick = RollbackReviewButtonClick
  end
  object RollbackButton: TButton
    Left = 186
    Top = 510
    Width = 165
    Caption = 'Retain added files...'
    Enabled = False
    TabOrder = 11
    OnClick = RollbackButtonClick
  end
  object WebsiteDialog: TOpenDialog
    Filter = 'Website ZIP|*.zip'
    Options = [ofHideReadOnly, ofNoChangeDir, ofFileMustExist, ofPathMustExist, ofEnableSizing]
    Title = 'Select the website ZIP'
    Left = 24
    Top = 452
  end
  object ScanDialog: TOpenDialog
    Filter = 'Destination scan|*.json'
    Options = [ofHideReadOnly, ofNoChangeDir, ofFileMustExist, ofPathMustExist, ofEnableSizing]
    Title = 'Select a destination scan'
    Left = 72
    Top = 452
  end
  object BackupDialog: TOpenDialog
    Filter = 'Destination backup|*.zip'
    Options = [ofHideReadOnly, ofNoChangeDir, ofFileMustExist, ofPathMustExist, ofEnableSizing]
    Title = 'Select the matching backup ZIP'
    Left = 120
    Top = 452
  end
  object JournalDialog: TSaveDialog
    DefaultExt = 'jsonl'
    FileName = 'deployment-receipt.jsonl'
    Filter = 'Deployment receipt|*.jsonl'
    Options = [ofHideReadOnly, ofNoChangeDir, ofPathMustExist, ofEnableSizing]
    Title = 'Choose a new deployment receipt file'
    Left = 168
    Top = 492
  end
  object ReceiptDialog: TOpenDialog
    Filter = 'Deployment receipt|*.jsonl'
    Options = [ofHideReadOnly, ofNoChangeDir, ofFileMustExist, ofPathMustExist, ofEnableSizing]
    Title = 'Select the original deployment receipt'
    Left = 216
    Top = 552
  end
end
