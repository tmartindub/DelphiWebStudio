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
    RemoteLabel: TLabel;
    RemoteEdit: TEdit;
    DownloadButton: TButton;
    SnapshotSaveDialog: TSaveDialog;
    FolderLabel: TLabel;
    FolderEdit: TEdit;
    ScanButton: TButton;
    BackupButton: TButton;
    BackupSaveDialog: TSaveDialog;
    ReviewButton: TButton;
    procedure KeyBrowseClick(Sender: TObject);
    procedure HostsBrowseClick(Sender: TObject);
    procedure TestButtonClick(Sender: TObject);
    procedure FormCloseQuery(Sender: TObject; var CanClose: Boolean);
    procedure DownloadButtonClick(Sender: TObject);
    procedure ScanButtonClick(Sender: TObject);
    procedure BackupButtonClick(Sender: TObject);
    procedure ReviewButtonClick(Sender: TObject);
  private
    FChecking: Boolean;
  end;

implementation

uses System.SysUtils, WebStudio.SftpConnection, WebStudio.SftpInventory, WebStudio.DeploymentReviewForm;

{$R *.dfm}

procedure TSftpForm.KeyBrowseClick(Sender: TObject);
begin
  if KeyDialog.Execute then KeyEdit.Text := KeyDialog.FileName;
end;

procedure TSftpForm.HostsBrowseClick(Sender: TObject);
begin
  if HostsDialog.Execute then HostsEdit.Text := HostsDialog.FileName;
end;

procedure TSftpForm.ReviewButtonClick(Sender: TObject);
var Dialog: TDeploymentReviewForm;
begin
  Dialog := TDeploymentReviewForm.Create(Self);
  try
    Dialog.DestinationLabel.Caption := 'Entered destination (not checked during local review): ' +
      Trim(HostEdit.Text) + ':' + Trim(PortEdit.Text) + ' ' + Trim(FolderEdit.Text);
    Dialog.ShowModal;
  finally Dialog.Free end;
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
  DownloadButton.Enabled := False;
  ScanButton.Enabled := False;
  BackupButton.Enabled := False;
  ReviewButton.Enabled := False;
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
      DownloadButton.Enabled := True;
      ScanButton.Enabled := True;
      BackupButton.Enabled := True;
      ReviewButton.Enabled := True;
      CloseButton.Enabled := True;
    end);
  end).Start;
end;

procedure TSftpForm.DownloadButtonClick(Sender: TObject);
var
  Host, UserName, KeyFile, KnownHosts, RemotePath, Destination: string;
  Port: Integer;
begin
  if not TryStrToInt(PortEdit.Text, Port) or (Port < 1) or (Port > 65535) then begin
    StatusLabel.Caption := 'Enter a port from 1 to 65535.';
    Exit;
  end;
  if not SnapshotSaveDialog.Execute then Exit;
  Host := Trim(HostEdit.Text);
  UserName := Trim(UserEdit.Text);
  KeyFile := KeyEdit.Text;
  KnownHosts := HostsEdit.Text;
  RemotePath := Trim(RemoteEdit.Text);
  Destination := SnapshotSaveDialog.FileName;
  FChecking := True;
  TestButton.Enabled := False;
  DownloadButton.Enabled := False;
  ScanButton.Enabled := False;
  BackupButton.Enabled := False;
  ReviewButton.Enabled := False;
  CloseButton.Enabled := False;
  StatusLabel.Caption := 'Downloading saved snapshot...';
  TThread.CreateAnonymousThread(procedure
  var MessageText: string;
  begin
    try
      DownloadSftpSnapshot(Host, UserName, KeyFile, KnownHosts, Port, RemotePath, Destination);
      MessageText := 'Snapshot saved. Compare it in Export; it is not a live destination scan.';
    except
      on E: Exception do MessageText := E.Message;
    end;
    TThread.Queue(nil, procedure
    begin
      StatusLabel.Caption := MessageText;
      FChecking := False;
      TestButton.Enabled := True;
      DownloadButton.Enabled := True;
      ScanButton.Enabled := True;
      BackupButton.Enabled := True;
      ReviewButton.Enabled := True;
      CloseButton.Enabled := True;
    end);
  end).Start;
end;

procedure TSftpForm.ScanButtonClick(Sender: TObject);
var
  Host, UserName, KeyFile, KnownHosts, RemoteFolder, Destination: string;
  Port: Integer;
begin
  if not TryStrToInt(PortEdit.Text, Port) or (Port < 1) or (Port > 65535) then begin
    StatusLabel.Caption := 'Enter a port from 1 to 65535.';
    Exit;
  end;
  if not SnapshotSaveDialog.Execute then Exit;
  Host := Trim(HostEdit.Text);
  UserName := Trim(UserEdit.Text);
  KeyFile := KeyEdit.Text;
  KnownHosts := HostsEdit.Text;
  RemoteFolder := Trim(FolderEdit.Text);
  Destination := SnapshotSaveDialog.FileName;
  FChecking := True;
  TestButton.Enabled := False;
  DownloadButton.Enabled := False;
  ScanButton.Enabled := False;
  BackupButton.Enabled := False;
  ReviewButton.Enabled := False;
  CloseButton.Enabled := False;
  StatusLabel.Caption := 'Scanning destination; this reads files without changing them...';
  TThread.CreateAnonymousThread(procedure
  var
    MessageText: string;
    Entries: TArray<TSftpInventoryEntry>;
  begin
    try
      Entries := ScanSftpInventory(Host, UserName, KeyFile, KnownHosts, Port, RemoteFolder);
      SaveSftpInventory(Entries, Destination);
      MessageText := 'Scan saved. Compare it in Export; scan again if the destination changes.';
    except
      on E: Exception do MessageText := E.Message;
    end;
    TThread.Queue(nil, procedure
    begin
      StatusLabel.Caption := MessageText;
      FChecking := False;
      TestButton.Enabled := True;
      DownloadButton.Enabled := True;
      ScanButton.Enabled := True;
      BackupButton.Enabled := True;
      ReviewButton.Enabled := True;
      CloseButton.Enabled := True;
    end);
  end).Start;
end;

procedure TSftpForm.BackupButtonClick(Sender: TObject);
var
  Host, UserName, KeyFile, KnownHosts, RemoteFolder, Destination: string;
  Port: Integer;
begin
  if not TryStrToInt(PortEdit.Text, Port) or (Port < 1) or (Port > 65535) then begin
    StatusLabel.Caption := 'Enter a port from 1 to 65535.';
    Exit;
  end;
  if not BackupSaveDialog.Execute then Exit;
  Host := Trim(HostEdit.Text);
  UserName := Trim(UserEdit.Text);
  KeyFile := KeyEdit.Text;
  KnownHosts := HostsEdit.Text;
  RemoteFolder := Trim(FolderEdit.Text);
  Destination := BackupSaveDialog.FileName;
  FChecking := True;
  TestButton.Enabled := False;
  DownloadButton.Enabled := False;
  ScanButton.Enabled := False;
  BackupButton.Enabled := False;
  ReviewButton.Enabled := False;
  CloseButton.Enabled := False;
  StatusLabel.Caption := 'Backing up destination without changing it...';
  TThread.CreateAnonymousThread(procedure
  var MessageText: string;
  begin
    try
      BackupSftpDestination(Host, UserName, KeyFile, KnownHosts, Port, RemoteFolder, Destination);
      MessageText := 'Destination backup saved. It reflects the site during the backup.';
    except
      on E: Exception do MessageText := E.Message;
    end;
    TThread.Queue(nil, procedure
    begin
      StatusLabel.Caption := MessageText;
      FChecking := False;
      TestButton.Enabled := True;
      DownloadButton.Enabled := True;
      ScanButton.Enabled := True;
      BackupButton.Enabled := True;
      ReviewButton.Enabled := True;
      CloseButton.Enabled := True;
    end);
  end).Start;
end;

end.
