unit WebStudio.SftpForm;

interface

uses System.Classes, Vcl.Controls, Vcl.Forms, Vcl.StdCtrls, Vcl.Dialogs;

type
  TSftpForm = class(TForm)
    HostLabel: TLabel;
    HostEdit: TEdit;
    UserLabel: TLabel;
    UserEdit: TEdit;
    PortLabel: TLabel;
    PortEdit: TEdit;
    KeyLabel: TLabel;
    KeyEdit: TEdit;
    KeyBrowse: TButton;
    HostsLabel: TLabel;
    HostsEdit: TEdit;
    HostsBrowse: TButton;
    ExplanationLabel: TLabel;
    StatusLabel: TLabel;
    TestButton: TButton;
    CloseButton: TButton;
    KeyDialog: TOpenDialog;
    HostsDialog: TOpenDialog;
    procedure KeyBrowseClick(Sender: TObject);
    procedure HostsBrowseClick(Sender: TObject);
    procedure TestButtonClick(Sender: TObject);
    procedure FormCloseQuery(Sender: TObject; var CanClose: Boolean);
  private
    FChecking: Boolean;
  end;

implementation

uses System.SysUtils, WebStudio.SftpConnection;

{$R *.dfm}

procedure TSftpForm.KeyBrowseClick(Sender: TObject);
begin
  if KeyDialog.Execute then KeyEdit.Text := KeyDialog.FileName;
end;

procedure TSftpForm.HostsBrowseClick(Sender: TObject);
begin
  if HostsDialog.Execute then HostsEdit.Text := HostsDialog.FileName;
end;

procedure TSftpForm.FormCloseQuery(Sender: TObject; var CanClose: Boolean);
begin
  CanClose := not FChecking;
end;

procedure TSftpForm.TestButtonClick(Sender: TObject);
var
  Host, UserName, KeyFile, KnownHosts: string;
  Port: Integer;
begin
  if not TryStrToInt(PortEdit.Text, Port) or (Port < 1) or (Port > 65535) then begin
    StatusLabel.Caption := 'Enter a port from 1 to 65535.';
    Exit;
  end;
  Host := Trim(HostEdit.Text);
  UserName := Trim(UserEdit.Text);
  KeyFile := KeyEdit.Text;
  KnownHosts := HostsEdit.Text;
  FChecking := True;
  TestButton.Enabled := False;
  CloseButton.Enabled := False;
  StatusLabel.Caption := 'Testing connection...';
  TThread.CreateAnonymousThread(procedure
  var MessageText: string;
  begin
    try
      TestSftpConnection(Host, UserName, KeyFile, KnownHosts, Port);
      MessageText := 'Connection successful. No files were uploaded.';
    except
      on E: Exception do MessageText := E.Message;
    end;
    TThread.Queue(nil, procedure
    begin
      StatusLabel.Caption := MessageText;
      FChecking := False;
      TestButton.Enabled := True;
      CloseButton.Enabled := True;
    end);
  end).Start;
end;

end.
