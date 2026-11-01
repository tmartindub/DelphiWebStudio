unit WebStudio.DeploymentReviewForm;

interface

uses System.Classes, Vcl.Controls, Vcl.Forms, Vcl.StdCtrls, Vcl.Dialogs, WebStudio.DeploymentReview;

type
  TDeploymentReviewForm = class(TForm)
    DestinationLabel: TLabel;
    WebsiteLabel: TLabel;
    WebsiteEdit: TEdit;
    WebsiteBrowse: TButton;
    ScanLabel: TLabel;
    ScanEdit: TEdit;
    ScanBrowse: TButton;
    BackupLabel: TLabel;
    BackupEdit: TEdit;
    BackupBrowse: TButton;
    ResultsMemo: TMemo;
    StatusLabel: TLabel;
    ReviewButton: TButton;
    CloseButton: TButton;
    WebsiteDialog: TOpenDialog;
    ScanDialog: TOpenDialog;
    BackupDialog: TOpenDialog;
    CheckButton: TButton;
    procedure WebsiteBrowseClick(Sender: TObject);
    procedure ScanBrowseClick(Sender: TObject);
    procedure BackupBrowseClick(Sender: TObject);
    procedure ReviewButtonClick(Sender: TObject);
    procedure InputChanged(Sender: TObject);
    procedure CheckButtonClick(Sender: TObject);
    procedure FormCloseQuery(Sender: TObject; var CanClose: Boolean);
  private
    FWorking: Boolean;
    FHasReview: Boolean;
    FReview: TDeploymentReview;
    FHost, FUserName, FKeyFile, FKnownHostsFile, FPortText, FRemoteDirectory: string;
  public
    procedure SetConnection(const Host, UserName, KeyFile, KnownHostsFile, PortText, RemoteDirectory: string);
  end;

implementation

uses System.SysUtils, WebStudio.DeploymentPreflight;

{$R *.dfm}

procedure TDeploymentReviewForm.SetConnection(const Host, UserName, KeyFile, KnownHostsFile, PortText, RemoteDirectory: string);
begin
  FHost := Host; FUserName := UserName; FKeyFile := KeyFile; FKnownHostsFile := KnownHostsFile;
  FPortText := PortText; FRemoteDirectory := RemoteDirectory;
  DestinationLabel.Caption := 'Entered destination (not checked during local review): ' + Host + ':' + PortText + ' ' + RemoteDirectory;
end;

procedure TDeploymentReviewForm.WebsiteBrowseClick(Sender: TObject);
begin
  if WebsiteDialog.Execute then WebsiteEdit.Text := WebsiteDialog.FileName;
end;

procedure TDeploymentReviewForm.ScanBrowseClick(Sender: TObject);
begin
  if ScanDialog.Execute then ScanEdit.Text := ScanDialog.FileName;
end;

procedure TDeploymentReviewForm.BackupBrowseClick(Sender: TObject);
begin
  if BackupDialog.Execute then BackupEdit.Text := BackupDialog.FileName;
end;

procedure TDeploymentReviewForm.FormCloseQuery(Sender: TObject; var CanClose: Boolean);
begin
  CanClose := not FWorking;
end;

procedure TDeploymentReviewForm.InputChanged(Sender: TObject);
begin
  if not FWorking then begin
    FHasReview := False;
    if Assigned(CheckButton) then CheckButton.Enabled := False;
    if Assigned(ResultsMemo) then ResultsMemo.Clear;
    if Assigned(StatusLabel) then StatusLabel.Caption := '';
  end;
end;

procedure TDeploymentReviewForm.ReviewButtonClick(Sender: TObject);
var Website, Scan, Backup: string;
begin
  Website := WebsiteEdit.Text;
  Scan := ScanEdit.Text;
  Backup := BackupEdit.Text;
  if (Website = '') or (Scan = '') or (Backup = '') then begin
    StatusLabel.Caption := 'Choose all three files before reviewing.';
    Exit;
  end;
  FWorking := True;
  FHasReview := False;
  CheckButton.Enabled := False;
  ReviewButton.Enabled := False;
  CloseButton.Enabled := False;
  WebsiteEdit.Enabled := False; WebsiteBrowse.Enabled := False;
  ScanEdit.Enabled := False; ScanBrowse.Enabled := False;
  BackupEdit.Enabled := False; BackupBrowse.Enabled := False;
  StatusLabel.Caption := 'Checking files...';
  ResultsMemo.Clear;
  TThread.CreateAnonymousThread(procedure
  var
    Review: TDeploymentReview;
    Path, Summary, MessageText: string;
    Lines: TStringList;
    Success: Boolean;
  begin
    Summary := '';
    Success := False;
    try
      Review := ReviewDeployment(Website, Scan, Backup);
      Lines := TStringList.Create;
      try
        Lines.Add('Backup matches the selected scan. No files were changed.');
        Lines.Add('The scan may be stale and does not establish destination identity.');
        Lines.Add('');
        Lines.Add('New files: ' + IntToStr(Length(Review.Added)));
        for Path in Review.Added do Lines.Add('  ' + Path);
        Lines.Add('');
        Lines.Add('Changed files: ' + IntToStr(Length(Review.Changed)));
        for Path in Review.Changed do Lines.Add('  ' + Path);
        Lines.Add('');
        Lines.Add('Only on destination: ' + IntToStr(Length(Review.OnlyAtDestination)));
        for Path in Review.OnlyAtDestination do Lines.Add('  ' + Path);
        Summary := Lines.Text;
      finally Lines.Free end;
      MessageText := 'Review complete. Publishing remains unavailable.';
      Success := True;
    except
      on E: Exception do MessageText := E.Message;
    end;
    TThread.Queue(nil, procedure
    begin
      ResultsMemo.Text := Summary;
      StatusLabel.Caption := MessageText;
      if Success then FReview := Review;
      FHasReview := Success;
      CheckButton.Enabled := Success;
      FWorking := False;
      ReviewButton.Enabled := True;
      CloseButton.Enabled := True;
      WebsiteEdit.Enabled := True; WebsiteBrowse.Enabled := True;
      ScanEdit.Enabled := True; ScanBrowse.Enabled := True;
      BackupEdit.Enabled := True; BackupBrowse.Enabled := True;
    end);
  end).Start;
end;

procedure TDeploymentReviewForm.CheckButtonClick(Sender: TObject);
var Website, Scan, Backup: string; Port: Integer; Reviewed: TDeploymentReview;
begin
  if not FHasReview then Exit;
  if not TryStrToInt(FPortText, Port) or (Port < 1) or (Port > 65535) then begin
    StatusLabel.Caption := 'Enter a valid port in the SFTP connection dialog.';
    Exit;
  end;
  Website := WebsiteEdit.Text; Scan := ScanEdit.Text; Backup := BackupEdit.Text; Reviewed := FReview;
  FWorking := True;
  ReviewButton.Enabled := False; CheckButton.Enabled := False; CloseButton.Enabled := False;
  WebsiteEdit.Enabled := False; WebsiteBrowse.Enabled := False;
  ScanEdit.Enabled := False; ScanBrowse.Enabled := False;
  BackupEdit.Enabled := False; BackupBrowse.Enabled := False;
  StatusLabel.Caption := 'Checking the destination without changing it...';
  TThread.CreateAnonymousThread(procedure
  var MessageText: string; Success: Boolean;
  begin
    Success := False;
    try
      CheckDeploymentPreflight(Website, Scan, Backup, Reviewed, FHost, FUserName, FKeyFile, FKnownHostsFile, Port, FRemoteDirectory);
      MessageText := 'Destination matched the scan at check time. No files were changed.';
      Success := True;
    except
      on E: Exception do MessageText := E.Message;
    end;
    TThread.Queue(nil, procedure
    begin
      StatusLabel.Caption := MessageText;
      FWorking := False;
      if not Success then FHasReview := False;
      ReviewButton.Enabled := True; CheckButton.Enabled := FHasReview; CloseButton.Enabled := True;
      WebsiteEdit.Enabled := True; WebsiteBrowse.Enabled := True;
      ScanEdit.Enabled := True; ScanBrowse.Enabled := True;
      BackupEdit.Enabled := True; BackupBrowse.Enabled := True;
    end);
  end).Start;
end;

end.
