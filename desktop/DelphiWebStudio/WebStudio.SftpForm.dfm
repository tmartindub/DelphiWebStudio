object SftpForm: TSftpForm
  BorderStyle = bsDialog
  Caption = 'SFTP connection test'
  ClientHeight = 326
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
    Caption = 'Use an SSH key and a known_hosts file containing the trusted host key. This checks the connection only; it does not upload files.'
  end
  object StatusLabel: TLabel
    Left = 16
    Top = 220
    Width = 585
    Height = 42
    AutoSize = False
    WordWrap = True
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
  object TestButton: TButton
    Left = 396
    Top = 282
    Width = 110
    Caption = 'Test connection'
    TabOrder = 7
    OnClick = TestButtonClick
  end
  object CloseButton: TButton
    Left = 525
    Top = 282
    Width = 75
    Caption = 'Close'
    ModalResult = 2
    TabOrder = 8
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
end
