unit WebStudio.LocalAIForm;

interface

uses
  System.Classes, Vcl.Controls, Vcl.Forms, Vcl.StdCtrls, Vcl.Dialogs;

type
  TLocalAIForm = class(TForm)
    IntroLabel: TLabel;
    RuntimeLabel: TLabel;
    RuntimeEdit: TEdit;
    RuntimeBrowseButton: TButton;
    ModelLabel: TLabel;
    ModelEdit: TEdit;
    ModelBrowseButton: TButton;
    BriefLabel: TLabel;
    BriefMemo: TMemo;
    GenerateButton: TButton;
    CancelButton: TButton;
    RuntimeDialog: TOpenDialog;
    ModelDialog: TOpenDialog;
    procedure RuntimeBrowseButtonClick(Sender: TObject);
    procedure ModelBrowseButtonClick(Sender: TObject);
    procedure GenerateButtonClick(Sender: TObject);
  end;

implementation

uses System.SysUtils, System.IOUtils;

{$R *.dfm}

procedure TLocalAIForm.RuntimeBrowseButtonClick(Sender: TObject);
begin
  if RuntimeDialog.Execute then RuntimeEdit.Text := RuntimeDialog.FileName;
end;

procedure TLocalAIForm.ModelBrowseButtonClick(Sender: TObject);
begin
  if ModelDialog.Execute then ModelEdit.Text := ModelDialog.FileName;
end;

procedure TLocalAIForm.GenerateButtonClick(Sender: TObject);
begin
  if not TFile.Exists(RuntimeEdit.Text) or not TFile.Exists(ModelEdit.Text) then
  begin
    MessageDlg('Choose the supported local runtime ZIP and model file.', mtInformation, [mbOK], 0);
    Exit;
  end;
  if (Trim(BriefMemo.Text) = '') or (Length(BriefMemo.Text) > 4000) then
  begin
    MessageDlg('Describe the website in 1 to 4000 characters.', mtInformation, [mbOK], 0);
    Exit;
  end;
  ModalResult := mrOk;
end;

end.
