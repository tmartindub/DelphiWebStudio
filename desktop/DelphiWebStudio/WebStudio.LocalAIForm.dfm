object LocalAIForm: TLocalAIForm
  Left = 0
  Top = 0
  Caption = 'Plan a website with local AI'
  ClientHeight = 410
  ClientWidth = 580
  BorderStyle = bsDialog
  Position = poOwnerFormCenter
  object IntroLabel: TLabel
    Left = 16
    Top = 12
    Width = 548
    Height = 34
    AutoSize = False
    Caption = 'Open a project first. Page planning needs a blank project; colors work on any project. Download files if needed (model: about 1.8 GB).'
    WordWrap = True
  end
  object RuntimeLabel: TLabel
    Left = 16
    Top = 55
    Caption = 'llama.cpp b12012 Windows CPU ZIP'
  end
  object RuntimeEdit: TEdit
    Left = 16
    Top = 74
    Width = 452
    Height = 23
    TabOrder = 1
  end
  object RuntimeDownloadButton: TButton
    Left = 435
    Top = 48
    Width = 129
    Height = 23
    Caption = 'Download runtime'
    TabOrder = 0
    OnClick = RuntimeDownloadButtonClick
  end
  object RuntimeBrowseButton: TButton
    Left = 480
    Top = 73
    Width = 84
    Height = 25
    Caption = 'Browse...'
    TabOrder = 2
    OnClick = RuntimeBrowseButtonClick
  end
  object ModelLabel: TLabel
    Left = 16
    Top = 108
    Caption = 'Qwen3 1.7B Q8 GGUF model'
  end
  object ModelEdit: TEdit
    Left = 16
    Top = 127
    Width = 452
    Height = 23
    TabOrder = 4
  end
  object ModelDownloadButton: TButton
    Left = 435
    Top = 101
    Width = 129
    Height = 23
    Caption = 'Download model'
    TabOrder = 3
    OnClick = ModelDownloadButtonClick
  end
  object ModelBrowseButton: TButton
    Left = 480
    Top = 126
    Width = 84
    Height = 25
    Caption = 'Browse...'
    TabOrder = 5
    OnClick = ModelBrowseButtonClick
  end
  object BriefLabel: TLabel
    Left = 16
    Top = 219
    Caption = 'Describe your website or requested colors'
  end
  object ProposalLabel: TLabel
    Left = 16
    Top = 163
    Caption = 'What would you like to do?'
  end
  object ProposalKind: TComboBox
    Left = 16
    Top = 182
    Width = 548
    Height = 23
    Style = csDropDownList
    ItemIndex = 0
    TabOrder = 6
    Text = 'Plan five pages'
    Items.Strings = (
      'Plan five pages'
      'Suggest website colors')
  end
  object BriefMemo: TMemo
    Left = 16
    Top = 238
    Width = 548
    Height = 112
    MaxLength = 4000
    ScrollBars = ssVertical
    TabOrder = 7
  end
  object GenerateButton: TButton
    Left = 382
    Top = 368
    Width = 88
    Height = 27
    Caption = 'Generate'
    Default = True
    TabOrder = 8
    OnClick = GenerateButtonClick
  end
  object CancelButton: TButton
    Left = 476
    Top = 368
    Width = 88
    Height = 27
    Cancel = True
    Caption = 'Cancel'
    ModalResult = 2
    TabOrder = 9
  end
  object RuntimeDialog: TOpenDialog
    Filter = 'Runtime ZIP|*.zip'
    Options = [ofHideReadOnly, ofNoChangeDir, ofFileMustExist, ofPathMustExist, ofEnableSizing]
    Left = 32
    Top = 360
  end
  object ModelDialog: TOpenDialog
    Filter = 'GGUF model|*.gguf'
    Options = [ofHideReadOnly, ofNoChangeDir, ofFileMustExist, ofPathMustExist, ofEnableSizing]
    Left = 80
    Top = 360
  end
end
