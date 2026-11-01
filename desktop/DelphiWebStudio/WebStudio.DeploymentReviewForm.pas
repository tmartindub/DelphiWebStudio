unit WebStudio.DeploymentReviewForm;

interface

uses System.Classes, Vcl.Controls, Vcl.Forms, Vcl.StdCtrls, Vcl.Dialogs;

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
    procedure WebsiteBrowseClick(Sender: TObject);
    procedure ScanBrowseClick(Sender: TObject);
    procedure BackupBrowseClick(Sender: TObject);
    procedure ReviewButtonClick(Sender: TObject);
    procedure InputChanged(Sender: TObject);
    procedure FormCloseQuery(Sender: TObject; var CanClose: Boolean);
  private
    FWorking: Boolean;
  end;

implementation

uses System.SysUtils, WebStudio.DeploymentReview;

{$R *.dfm}

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
  begin
    Summary := '';
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
    except
      on E: Exception do MessageText := E.Message;
    end;
    TThread.Queue(nil, procedure
    begin
      ResultsMemo.Text := Summary;
      StatusLabel.Caption := MessageText;
      FWorking := False;
      ReviewButton.Enabled := True;
      CloseButton.Enabled := True;
      WebsiteEdit.Enabled := True; WebsiteBrowse.Enabled := True;
      ScanEdit.Enabled := True; ScanBrowse.Enabled := True;
      BackupEdit.Enabled := True; BackupBrowse.Enabled := True;
    end);
  end).Start;
end;

end.
