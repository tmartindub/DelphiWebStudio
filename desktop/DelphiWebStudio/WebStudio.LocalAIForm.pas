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
    RuntimeDownloadButton: TButton;
    ModelLabel: TLabel;
    ModelEdit: TEdit;
    ModelBrowseButton: TButton;
    ModelDownloadButton: TButton;
    BriefLabel: TLabel;
    BriefMemo: TMemo;
    GenerateButton: TButton;
    CancelButton: TButton;
    RuntimeDialog: TOpenDialog;
    ModelDialog: TOpenDialog;
    procedure RuntimeBrowseButtonClick(Sender: TObject);
    procedure ModelBrowseButtonClick(Sender: TObject);
    procedure RuntimeDownloadButtonClick(Sender: TObject);
    procedure ModelDownloadButtonClick(Sender: TObject);
    procedure GenerateButtonClick(Sender: TObject);
  end;

implementation

uses Winapi.Windows, Winapi.ShellAPI, System.SysUtils, System.IOUtils;

{$R *.dfm}

procedure TLocalAIForm.RuntimeBrowseButtonClick(Sender: TObject);
begin
  if RuntimeDialog.Execute then RuntimeEdit.Text := RuntimeDialog.FileName;
end;

procedure TLocalAIForm.ModelBrowseButtonClick(Sender: TObject);
begin
  if ModelDialog.Execute then ModelEdit.Text := ModelDialog.FileName;
end;

procedure TLocalAIForm.RuntimeDownloadButtonClick(Sender: TObject);
begin
  if ShellExecute(Handle, 'open',
    'https://github.com/ggml-org/llama.cpp/releases/download/b12012/llama-b12012-bin-win-cpu-x64.zip',
    nil, nil, SW_SHOWNORMAL) <= 32 then
    MessageDlg('Could not open the runtime download in your browser.', mtError, [mbOK], 0);
end;

procedure TLocalAIForm.ModelDownloadButtonClick(Sender: TObject);
begin
  if ShellExecute(Handle, 'open',
    'https://huggingface.co/Qwen/Qwen3-1.7B-GGUF/resolve/' +
    '90862c4b9d2787eaed51d12237eafdfe7c5f6077/Qwen3-1.7B-Q8_0.gguf',
    nil, nil, SW_SHOWNORMAL) <= 32 then
    MessageDlg('Could not open the model download in your browser.', mtError, [mbOK], 0);
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
