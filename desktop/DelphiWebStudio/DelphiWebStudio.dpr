program DelphiWebStudio;

uses
  Vcl.Forms,
  WebStudio.Main in 'WebStudio.Main.pas' {MainForm};

{$R *.res}

begin
  Application.Initialize;
  Application.MainFormOnTaskbar := True;
  Application.CreateForm(TMainForm, MainForm);
  Application.Run;
end.
