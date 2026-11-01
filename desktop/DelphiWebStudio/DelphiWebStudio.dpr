program DelphiWebStudio;

uses
  Vcl.Forms,
  WebStudio.Main in 'WebStudio.Main.pas' {MainForm},
  WebStudio.LocalAIForm in 'WebStudio.LocalAIForm.pas' {LocalAIForm};

{$R *.res}

begin
  Application.Initialize;
  Application.MainFormOnTaskbar := True;
  Application.CreateForm(TMainForm, MainForm);
  Application.Run;
end.
