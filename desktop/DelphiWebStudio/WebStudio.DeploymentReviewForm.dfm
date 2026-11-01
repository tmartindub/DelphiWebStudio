object DeploymentReviewForm: TDeploymentReviewForm
  BorderStyle = bsDialog
  Caption = 'Review website files'
  ClientHeight = 500
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
  object StatusLabel: TLabel
    Left = 16
    Top = 435
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
    Top = 172
    Width = 664
    Height = 250
    ReadOnly = True
    ScrollBars = ssBoth
    TabOrder = 6
    WordWrap = False
  end
  object ReviewButton: TButton
    Left = 490
    Top = 467
    Width = 100
    Caption = 'Review files'
    TabOrder = 7
    OnClick = ReviewButtonClick
  end
  object CloseButton: TButton
    Left = 605
    Top = 467
    Width = 75
    Caption = 'Close'
    ModalResult = 2
    TabOrder = 8
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
end
