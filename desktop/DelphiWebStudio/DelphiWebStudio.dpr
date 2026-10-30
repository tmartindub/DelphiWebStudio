program DelphiWebStudio;

uses
  Vcl.Forms,
  WebStudio.Main in 'WebStudio.Main.pas' {MainForm};

begin
  Application.Initialize;
  Application.MainFormOnTaskbar := True;
  Application.CreateForm(TMainForm, MainForm);
  Application.Run;
end.
