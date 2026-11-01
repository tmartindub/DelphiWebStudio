program DesktopDiagnosticsSmoke;
{$APPTYPE CONSOLE}

uses Winapi.Windows, Winapi.Messages, Winapi.CommCtrl, System.SysUtils, Vcl.Forms, Vcl.Dialogs,
  WebStudio.Main in '..\..\desktop\DelphiWebStudio\WebStudio.Main.pas' {MainForm};

{$R '..\..\desktop\DelphiWebStudio\DelphiWebStudio.res'}

type
  TObserver = class
    Seen: Boolean;
    procedure DialogCreated(Sender: TObject);
  end;

procedure TObserver.DialogCreated(Sender: TObject);
var Dialog: TTaskDialog;
begin
  Dialog := TTaskDialog(Sender);
  if (Pos('WebView2 version:', Dialog.Text) = 0) or
     (Pos('Local editor: Not loaded', Dialog.Text) = 0) or
     (Pos('do not include project contents or credentials', Dialog.Text) = 0) then
    raise Exception.Create('The local diagnostic information is incomplete.');
  Seen := True;
  PostMessage(Dialog.Handle, TDM_CLICK_BUTTON, IDOK, 0);
end;

var Observer: TObserver;
begin
  Application.Initialize;
  Application.ShowMainForm := False;
  Application.CreateForm(TMainForm, MainForm);
  Observer := TObserver.Create;
  try
    MainForm.DiagnosticsDialog.OnDialogCreated := Observer.DialogCreated;
    MainForm.DiagnosticsItem.Click;
    if not Observer.Seen then raise Exception.Create('Diagnostics dialog did not open.');
    Writeln('Local diagnostics dialog passed.');
  finally Observer.Free; MainForm.Free end;
end.
