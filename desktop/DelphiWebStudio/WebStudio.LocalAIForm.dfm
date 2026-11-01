object LocalAIForm: TLocalAIForm
  Left = 0
  Top = 0
  Caption = 'Plan a website with local AI'
  ClientHeight = 354
  ClientWidth = 580
  BorderStyle = bsDialog
  Position = poOwnerFormCenter
  object IntroLabel: TLabel
    Left = 16
    Top = 12
    Width = 548
    Height = 34
    AutoSize = False
    Caption = 'Open a blank project in the editor first. Choose the offline runtime and model, then describe your site. Review the pages before applying them.'
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
    TabOrder = 0
  end
  object RuntimeBrowseButton: TButton
    Left = 480
    Top = 73
    Width = 84
    Height = 25
    Caption = 'Browse...'
    TabOrder = 1
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
    TabOrder = 2
  end
  object ModelBrowseButton: TButton
    Left = 480
    Top = 126
    Width = 84
    Height = 25
    Caption = 'Browse...'
    TabOrder = 3
    OnClick = ModelBrowseButtonClick
  end
  object BriefLabel: TLabel
    Left = 16
    Top = 163
    Caption = 'What is your website for?'
  end
  object BriefMemo: TMemo
    Left = 16
    Top = 182
    Width = 548
    Height = 112
    MaxLength = 4000
    ScrollBars = ssVertical
    TabOrder = 4
  end
  object GenerateButton: TButton
    Left = 382
    Top = 312
    Width = 88
    Height = 27
    Caption = 'Generate'
    Default = True
    TabOrder = 5
    OnClick = GenerateButtonClick
  end
  object CancelButton: TButton
    Left = 476
    Top = 312
    Width = 88
    Height = 27
    Cancel = True
    Caption = 'Cancel'
    ModalResult = 2
    TabOrder = 6
  end
  object RuntimeDialog: TOpenDialog
    Filter = 'Runtime ZIP|*.zip'
    Options = [ofHideReadOnly, ofNoChangeDir, ofFileMustExist, ofPathMustExist, ofEnableSizing]
    Left = 32
    Top = 304
  end
  object ModelDialog: TOpenDialog
    Filter = 'GGUF model|*.gguf'
    Options = [ofHideReadOnly, ofNoChangeDir, ofFileMustExist, ofPathMustExist, ofEnableSizing]
    Left = 80
    Top = 304
  end
end
