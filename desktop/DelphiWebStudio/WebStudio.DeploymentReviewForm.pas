unit WebStudio.DeploymentReviewForm;

interface

uses System.Classes, Vcl.Controls, Vcl.Forms, Vcl.StdCtrls, Vcl.Dialogs, WebStudio.DeploymentReview, WebStudio.SftpInventory;

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
    RecoveryLabel: TLabel;
    RecoveryEdit: TEdit;
    PublishButton: TButton;
    JournalDialog: TSaveDialog;
    ReceiptLabel: TLabel;
    ReceiptEdit: TEdit;
    ReceiptBrowse: TButton;
    ReceiptDialog: TOpenDialog;
    RollbackReviewButton: TButton;
    RollbackButton: TButton;
    procedure WebsiteBrowseClick(Sender: TObject);
    procedure ScanBrowseClick(Sender: TObject);
    procedure BackupBrowseClick(Sender: TObject);
    procedure ReviewButtonClick(Sender: TObject);
    procedure InputChanged(Sender: TObject);
    procedure CheckButtonClick(Sender: TObject);
    procedure PublishButtonClick(Sender: TObject);
    procedure ReceiptBrowseClick(Sender: TObject);
    procedure RollbackReviewButtonClick(Sender: TObject);
    procedure RollbackButtonClick(Sender: TObject);
    procedure FormCloseQuery(Sender: TObject; var CanClose: Boolean);
  private
    FWorking: Boolean;
    FHasReview: Boolean;
    FHasPreflight: Boolean;
    FHasRollbackReview: Boolean;
    FAdded: TArray<TSftpInventoryEntry>;
    FReview: TDeploymentReview;
    FHost, FUserName, FKeyFile, FKnownHostsFile, FPortText, FRemoteDirectory: string;
  public
    procedure SetConnection(const Host, UserName, KeyFile, KnownHostsFile, PortText, RemoteDirectory: string);
  end;

implementation

uses System.SysUtils, WebStudio.DeploymentPreflight, WebStudio.DeploymentExecutor,
  WebStudio.RollbackReview, WebStudio.RollbackExecutor;

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

procedure TDeploymentReviewForm.ReceiptBrowseClick(Sender: TObject);
begin
  if ReceiptDialog.Execute then ReceiptEdit.Text := ReceiptDialog.FileName;
end;

procedure TDeploymentReviewForm.FormCloseQuery(Sender: TObject; var CanClose: Boolean);
begin
  CanClose := not FWorking;
end;

procedure TDeploymentReviewForm.InputChanged(Sender: TObject);
begin
  if not FWorking then begin
    FHasReview := False;
    FHasPreflight := False;
    FHasRollbackReview := False;
    if Assigned(CheckButton) then CheckButton.Enabled := False;
    if Assigned(PublishButton) then PublishButton.Enabled := False;
    if Assigned(RollbackReviewButton) then RollbackReviewButton.Enabled := False;
    if Assigned(RollbackButton) then RollbackButton.Enabled := False;
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
  FHasPreflight := False;
  FHasRollbackReview := False;
  PublishButton.Enabled := False;
  RollbackReviewButton.Enabled := False; RollbackButton.Enabled := False;
  CheckButton.Enabled := False;
  ReviewButton.Enabled := False;
  CloseButton.Enabled := False;
  WebsiteEdit.Enabled := False; WebsiteBrowse.Enabled := False;
  ScanEdit.Enabled := False; ScanBrowse.Enabled := False;
  BackupEdit.Enabled := False; BackupBrowse.Enabled := False;
  RecoveryEdit.Enabled := False; ReceiptEdit.Enabled := False; ReceiptBrowse.Enabled := False;
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
      MessageText := 'Review complete. Check the destination before publishing.';
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
      RollbackReviewButton.Enabled := Success;
      FWorking := False;
      ReviewButton.Enabled := True;
      CloseButton.Enabled := True;
      WebsiteEdit.Enabled := True; WebsiteBrowse.Enabled := True;
      ScanEdit.Enabled := True; ScanBrowse.Enabled := True;
      BackupEdit.Enabled := True; BackupBrowse.Enabled := True;
      RecoveryEdit.Enabled := True; ReceiptEdit.Enabled := True; ReceiptBrowse.Enabled := True;
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
  FHasPreflight := False;
  PublishButton.Enabled := False;
  RollbackButton.Enabled := False; RollbackReviewButton.Enabled := False;
  ReviewButton.Enabled := False; CheckButton.Enabled := False; CloseButton.Enabled := False;
  WebsiteEdit.Enabled := False; WebsiteBrowse.Enabled := False;
  ScanEdit.Enabled := False; ScanBrowse.Enabled := False;
  BackupEdit.Enabled := False; BackupBrowse.Enabled := False;
  RecoveryEdit.Enabled := False; ReceiptEdit.Enabled := False; ReceiptBrowse.Enabled := False;
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
      FHasPreflight := Success;
      ReviewButton.Enabled := True; CheckButton.Enabled := FHasReview; CloseButton.Enabled := True;
      PublishButton.Enabled := FHasPreflight and not FHasRollbackReview;
      RollbackButton.Enabled := FHasPreflight and FHasRollbackReview;
      RollbackReviewButton.Enabled := FHasReview;
      WebsiteEdit.Enabled := True; WebsiteBrowse.Enabled := True;
      ScanEdit.Enabled := True; ScanBrowse.Enabled := True;
      BackupEdit.Enabled := True; BackupBrowse.Enabled := True;
      RecoveryEdit.Enabled := True; ReceiptEdit.Enabled := True; ReceiptBrowse.Enabled := True;
    end);
  end).Start;
end;

procedure TDeploymentReviewForm.RollbackReviewButtonClick(Sender: TObject);
var OriginalReceipt: string; Port: Integer; Reviewed: TDeploymentReview;
begin
  if not FHasReview then Exit;
  if (Trim(ReceiptEdit.Text) = '') or not TryStrToInt(FPortText, Port) or (Port < 1) or (Port > 65535) then begin
    StatusLabel.Caption := 'Select the original transfer receipt and enter a valid port.';
    Exit;
  end;
  OriginalReceipt := ReceiptEdit.Text; Reviewed := FReview;
  FWorking := True; FHasPreflight := False; FHasRollbackReview := False;
  ReviewButton.Enabled := False; CheckButton.Enabled := False; CloseButton.Enabled := False;
  PublishButton.Enabled := False; RollbackButton.Enabled := False; RollbackReviewButton.Enabled := False;
  WebsiteEdit.Enabled := False; WebsiteBrowse.Enabled := False; ScanEdit.Enabled := False; ScanBrowse.Enabled := False;
  BackupEdit.Enabled := False; BackupBrowse.Enabled := False; RecoveryEdit.Enabled := False;
  ReceiptEdit.Enabled := False; ReceiptBrowse.Enabled := False;
  StatusLabel.Caption := 'Reviewing receipt-added files...';
  TThread.CreateAnonymousThread(procedure
  var Added: TArray<TSftpInventoryEntry>; Entry: TSftpInventoryEntry; Lines: TStringList; Summary, MessageText: string; Success: Boolean;
  begin
    Success := False; Summary := '';
    try
      Added := ReviewAddedRollback(OriginalReceipt, FHost, FRemoteDirectory, Port, Reviewed);
      if Length(Added) = 0 then raise EInvalidOpException.Create('The receipt contains no added files to retain.');
      Lines := TStringList.Create;
      try
        Lines.Add('Step 1: move these receipt-added files into private recovery:');
        for Entry in Added do Lines.Add('  ' + Entry.Path);
        Lines.Add('');
        Lines.Add('Other files will not be changed in this step.');
        Lines.Add('Then scan and back up again before restoring the earlier website ZIP.');
        Summary := Lines.Text;
      finally Lines.Free end;
      MessageText := 'Rollback list ready. Check the destination before continuing.';
      Success := True;
    except on E: Exception do MessageText := E.Message end;
    TThread.Queue(nil, procedure
    begin
      ResultsMemo.Text := Summary; StatusLabel.Caption := MessageText;
      if Success then FAdded := Added;
      FHasRollbackReview := Success; FWorking := False;
      ReviewButton.Enabled := True; CheckButton.Enabled := FHasReview; CloseButton.Enabled := True;
      RollbackReviewButton.Enabled := FHasReview;
      WebsiteEdit.Enabled := True; WebsiteBrowse.Enabled := True; ScanEdit.Enabled := True; ScanBrowse.Enabled := True;
      BackupEdit.Enabled := True; BackupBrowse.Enabled := True; RecoveryEdit.Enabled := True;
      ReceiptEdit.Enabled := True; ReceiptBrowse.Enabled := True;
    end);
  end).Start;
end;

procedure TDeploymentReviewForm.RollbackButtonClick(Sender: TObject);
var Website, Scan, Backup, OriginalReceipt, Journal, Recovery: string; Port: Integer;
  Reviewed: TDeploymentReview; Added: TArray<TSftpInventoryEntry>;
begin
  if not FHasReview or not FHasRollbackReview or not FHasPreflight then Exit;
  if not TryStrToInt(FPortText, Port) or (Port < 1) or (Port > 65535) then Exit;
  Recovery := Trim(RecoveryEdit.Text);
  if Recovery = '' then begin StatusLabel.Caption := 'Enter a private recovery folder.'; Exit end;
  if not JournalDialog.Execute then Exit;
  Journal := JournalDialog.FileName;
  if MessageDlg('Move the ' + IntToStr(Length(FAdded)) + ' reviewed added files from ' + FHost + ':' + FPortText + ' ' + FRemoteDirectory +
    ' to private recovery?' + sLineBreak + sLineBreak + 'Ensure this folder is not served by the host: ' + Recovery + sLineBreak +
    'Receipt: ' + Journal + sLineBreak + sLineBreak + 'This is step 1; scan and back up again before restoring the earlier website files.',
    mtWarning, [mbYes, mbNo], 0, mbNo) <> mrYes then Exit;
  Website := WebsiteEdit.Text; Scan := ScanEdit.Text; Backup := BackupEdit.Text; OriginalReceipt := ReceiptEdit.Text;
  Reviewed := FReview; Added := Copy(FAdded);
  FWorking := True; FHasPreflight := False;
  ReviewButton.Enabled := False; CheckButton.Enabled := False; CloseButton.Enabled := False;
  PublishButton.Enabled := False; RollbackButton.Enabled := False; RollbackReviewButton.Enabled := False;
  WebsiteEdit.Enabled := False; WebsiteBrowse.Enabled := False; ScanEdit.Enabled := False; ScanBrowse.Enabled := False;
  BackupEdit.Enabled := False; BackupBrowse.Enabled := False; RecoveryEdit.Enabled := False;
  ReceiptEdit.Enabled := False; ReceiptBrowse.Enabled := False;
  StatusLabel.Caption := 'Preserving reviewed added files...';
  TThread.CreateAnonymousThread(procedure
  var MessageText: string;
  begin
    try
      ExecuteAddedRollback(Website, Scan, Backup, OriginalReceipt, Journal, Reviewed, Added,
        FHost, FUserName, FKeyFile, FKnownHostsFile, Port, FRemoteDirectory, Recovery, True);
      MessageText := 'Added files retained. Scan and back up again. Receipt: ' + Journal;
    except on E: Exception do MessageText := E.Message end;
    TThread.Queue(nil, procedure
    begin
      StatusLabel.Caption := MessageText; FHasReview := False; FHasRollbackReview := False; FHasPreflight := False; FWorking := False;
      ReviewButton.Enabled := True; CheckButton.Enabled := False; CloseButton.Enabled := True;
      RollbackReviewButton.Enabled := False; RollbackButton.Enabled := False; PublishButton.Enabled := False;
      WebsiteEdit.Enabled := True; WebsiteBrowse.Enabled := True; ScanEdit.Enabled := True; ScanBrowse.Enabled := True;
      BackupEdit.Enabled := True; BackupBrowse.Enabled := True; RecoveryEdit.Enabled := True;
      ReceiptEdit.Enabled := True; ReceiptBrowse.Enabled := True;
    end);
  end).Start;
end;

procedure TDeploymentReviewForm.PublishButtonClick(Sender: TObject);
var Website, Scan, Backup, Journal, Recovery: string; Port: Integer; Reviewed: TDeploymentReview;
begin
  if not FHasReview or not FHasPreflight then Exit;
  if not TryStrToInt(FPortText, Port) or (Port < 1) or (Port > 65535) then Exit;
  Recovery := Trim(RecoveryEdit.Text);
  if (Length(FReview.Changed) > 0) and (Recovery = '') then begin
    StatusLabel.Caption := 'Enter a private recovery folder outside the website before continuing.';
    Exit;
  end;
  if not JournalDialog.Execute then Exit;
  Journal := JournalDialog.FileName;
  if MessageDlg('Publish the reviewed files to ' + FHost + ':' + FPortText + ' ' + FRemoteDirectory + '?' + sLineBreak + sLineBreak +
    IntToStr(Length(FReview.Added)) + ' new files; ' + IntToStr(Length(FReview.Changed)) + ' changed files. ' +
    IntToStr(Length(FReview.OnlyAtDestination)) + ' destination-only files will be kept.' + sLineBreak + sLineBreak +
    'Review the full file list before confirming. For changed files, you must ensure the recovery folder is not served by the host: ' + Recovery + sLineBreak +
    'Receipt: ' + Journal, mtWarning, [mbYes, mbNo], 0, mbNo) <> mrYes then Exit;
  Website := WebsiteEdit.Text; Scan := ScanEdit.Text; Backup := BackupEdit.Text; Reviewed := FReview;
  FWorking := True;
  FHasPreflight := False;
  PublishButton.Enabled := False; RollbackButton.Enabled := False; RollbackReviewButton.Enabled := False;
  ReviewButton.Enabled := False; CheckButton.Enabled := False; CloseButton.Enabled := False;
  WebsiteEdit.Enabled := False; WebsiteBrowse.Enabled := False;
  ScanEdit.Enabled := False; ScanBrowse.Enabled := False;
  BackupEdit.Enabled := False; BackupBrowse.Enabled := False; RecoveryEdit.Enabled := False;
  ReceiptEdit.Enabled := False; ReceiptBrowse.Enabled := False;
  StatusLabel.Caption := 'Checking and transferring reviewed files...';
  TThread.CreateAnonymousThread(procedure
  var Outcome: TDeploymentExecution; MessageText: string;
  begin
    try
      Outcome := ExecuteReviewedDeployment(Website, Scan, Backup, Journal, Reviewed,
        FHost, FUserName, FKeyFile, FKnownHostsFile, Port, FRemoteDirectory, Recovery, True);
      MessageText := 'Verified ' + IntToStr(Outcome.VerifiedTransfers) + ' transfers. Receipt: ' + Outcome.JournalPath;
    except
      on E: Exception do MessageText := E.Message;
    end;
    TThread.Queue(nil, procedure
    begin
      StatusLabel.Caption := MessageText;
      FHasReview := False; FHasPreflight := False; FWorking := False;
      FHasRollbackReview := False;
      ReviewButton.Enabled := True; CheckButton.Enabled := False; PublishButton.Enabled := False; CloseButton.Enabled := True;
      RollbackReviewButton.Enabled := False; RollbackButton.Enabled := False;
      WebsiteEdit.Enabled := True; WebsiteBrowse.Enabled := True;
      ScanEdit.Enabled := True; ScanBrowse.Enabled := True;
      BackupEdit.Enabled := True; BackupBrowse.Enabled := True; RecoveryEdit.Enabled := True;
      ReceiptEdit.Enabled := True; ReceiptBrowse.Enabled := True;
    end);
  end).Start;
end;

end.
