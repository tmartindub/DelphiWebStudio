program SftpConnectionSmoke;

{$APPTYPE CONSOLE}

uses
  Winapi.Windows, System.SysUtils, System.Classes, System.IOUtils, Vcl.Forms, WebStudio.SftpConnection,
  WebStudio.SftpForm, WebStudio.SftpInventory, WebStudio.DeploymentReview, WebStudio.DeploymentPreflight, WebStudio.DeploymentReviewForm, WebStudio.DeploymentJournal;

var
  DirectoryName, KeyName, HostsName: string;
  Rejected: Boolean;
  Dialog: TSftpForm;
  Entry: TSftpInventoryEntry;
  Entries: TArray<TSftpInventoryEntry>;
  Receipt: TSftpTransferReceipt;
  Review: TDeploymentReview;
  Transfer: TDeploymentTransfer;
  Path: string;
  ReviewDialog: TDeploymentReviewForm;
  Deadline: UInt64;
  Journal: TDeploymentJournal;
  OperationId, SecondId: TGUID;
begin
  try
    if ParamCount = 19 then begin
      OperationId := StringToGUID(ParamStr(9));
      Receipt := ReplaceSftpFileWithId('127.0.0.1', 'testuser', ParamStr(2), ParamStr(3), StrToInt(ParamStr(1)), ParamStr(4), ParamStr(5), ParamStr(6), StrToUInt64(ParamStr(7)), ParamStr(8), OperationId);
      Writeln(Receipt.Path, '|', Receipt.Size, '|', Receipt.Sha256, '|', Receipt.PreviousPath);
      Exit;
    end;
    if ParamCount = 18 then begin
      Review := ReviewDeployment(ParamStr(1), ParamStr(2), ParamStr(3));
      if Length(Review.Transfers) <> 2 then raise Exception.Create('Unexpected journal test plan.');
      OperationId := StringToGUID('{11111111-1111-1111-1111-111111111111}');
      SecondId := StringToGUID('{22222222-2222-2222-2222-222222222222}');
      Journal := TDeploymentJournal.CreateNew(ParamStr(4), 'example.test', '/site', 22, Review);
      try
        Rejected := False;
        try Journal.Finish except on E: Exception do Rejected := True end;
        if not Rejected then raise Exception.Create('Journal accepted an incomplete plan.');
        Rejected := False;
        try Journal.RecordDirectoryIntent('unrelated') except on E: Exception do Rejected := True end;
        if not Rejected then raise Exception.Create('Journal accepted an unrelated directory.');
        Journal.BeginTransfer(0, OperationId);
        Receipt.Path := '/site/wrong'; Receipt.Size := Review.Transfers[0].DesiredSize;
        Receipt.Sha256 := Review.Transfers[0].DesiredSha256; Receipt.PreviousPath := '';
        Rejected := False;
        try Journal.CompleteTransfer(Receipt) except on E: Exception do Rejected := True end;
        if not Rejected then raise Exception.Create('Journal accepted an unrelated receipt.');
        Receipt.Path := '/site/' + Review.Transfers[0].Path;
        Journal.CompleteTransfer(Receipt);
        Rejected := False;
        try Journal.BeginTransfer(1, OperationId) except on E: Exception do Rejected := True end;
        if not Rejected then raise Exception.Create('Journal accepted a reused identifier.');
        Journal.BeginTransfer(1, SecondId);
        Receipt.Path := '/site/' + Review.Transfers[1].Path;
        Receipt.Size := Review.Transfers[1].DesiredSize;
        Receipt.Sha256 := Review.Transfers[1].DesiredSha256;
        Receipt.PreviousPath := '/site/.webstudio-original-' + GUIDToString(SecondId) + '.bak';
        Journal.CompleteTransfer(Receipt);
        Journal.Finish;
      finally Journal.Free end;
      Rejected := False;
      try
        Journal := TDeploymentJournal.CreateNew(ParamStr(4), 'example.test', '/site', 22, Review);
        Journal.Free;
      except on E: Exception do Rejected := True end;
      if not Rejected then raise Exception.Create('Journal replaced an existing file.');
      Journal := TDeploymentJournal.CreateNew(ParamStr(5), 'example.test', '/site', 22, Review);
      try
        Journal.BeginTransfer(0, OperationId);
        Journal.FailTransfer('synthetic failure');
        Rejected := False;
        try Journal.Finish except on E: Exception do Rejected := True end;
        if not Rejected then raise Exception.Create('Journal finished after a failure.');
      finally Journal.Free end;
      Writeln('Journal checks passed.');
      Exit;
    end;
    if ParamCount = 9 then begin
      for Path in EnsureSftpDirectories('127.0.0.1', 'testuser', ParamStr(2), ParamStr(3), StrToInt(ParamStr(1)), ParamStr(4), ParamStr(5)) do
        Writeln('D:', Path);
      Exit;
    end;
    if ParamCount = 17 then begin
      Review := ReviewDeployment(ParamStr(5), ParamStr(6), ParamStr(7));
      TFile.AppendAllText(ParamStr(5), 'changed after review');
      CheckDeploymentPreflight(ParamStr(5), ParamStr(6), ParamStr(7), Review,
        '127.0.0.1', 'testuser', ParamStr(2), ParamStr(3), StrToInt(ParamStr(1)), ParamStr(4));
      Writeln('Unexpectedly accepted modified input.');
      Exit;
    end;
    if ParamCount = 16 then begin
      Application.Initialize;
      ReviewDialog := TDeploymentReviewForm.Create(nil);
      try
        ReviewDialog.SetConnection('127.0.0.1', 'testuser', ParamStr(2), ParamStr(3), ParamStr(1), ParamStr(4));
        ReviewDialog.WebsiteEdit.Text := ParamStr(5);
        ReviewDialog.ScanEdit.Text := ParamStr(6);
        ReviewDialog.BackupEdit.Text := ParamStr(7);
        ReviewDialog.ReviewButton.Click;
        Deadline := GetTickCount64 + 30000;
        while not ReviewDialog.ReviewButton.Enabled and (GetTickCount64 < Deadline) do begin
          Application.ProcessMessages; CheckSynchronize(0); Sleep(10);
        end;
        if not ReviewDialog.CheckButton.Enabled then raise Exception.Create('Review did not enable the live check.');
        ReviewDialog.CheckButton.Click;
        Deadline := GetTickCount64 + 70000;
        while not ReviewDialog.ReviewButton.Enabled and (GetTickCount64 < Deadline) do begin
          Application.ProcessMessages; CheckSynchronize(0); Sleep(10);
        end;
        if not ReviewDialog.ReviewButton.Enabled or
           (Pos('Destination matched', ReviewDialog.StatusLabel.Caption) = 0) then
          raise Exception.Create('Native live check did not pass.');
        Writeln('Native live check passed.');
      finally ReviewDialog.Free end;
      Exit;
    end;
    if ParamCount = 15 then begin
      Review := ReviewDeployment(ParamStr(5), ParamStr(6), ParamStr(7));
      CheckDeploymentPreflight(ParamStr(5), ParamStr(6), ParamStr(7), Review,
        '127.0.0.1', 'testuser', ParamStr(2), ParamStr(3), StrToInt(ParamStr(1)), ParamStr(4));
      Writeln('Read-only preflight passed.');
      Exit;
    end;
    if ParamCount = 13 then begin
      Application.Initialize;
      ReviewDialog := TDeploymentReviewForm.Create(nil);
      try
        ReviewDialog.WebsiteEdit.Text := ParamStr(1);
        ReviewDialog.ScanEdit.Text := ParamStr(2);
        ReviewDialog.BackupEdit.Text := ParamStr(3);
        ReviewDialog.ReviewButton.Click;
        Deadline := GetTickCount64 + 30000;
        while not ReviewDialog.ReviewButton.Enabled and (GetTickCount64 < Deadline) do begin
          Application.ProcessMessages;
          CheckSynchronize(0);
          Sleep(10);
        end;
        if not ReviewDialog.ReviewButton.Enabled or
           (Pos('Review complete', ReviewDialog.StatusLabel.Caption) = 0) or
           (Pos('New files: 1', ReviewDialog.ResultsMemo.Text) = 0) or
           (Pos('Changed files: 1', ReviewDialog.ResultsMemo.Text) = 0) or
           (Pos('Only on destination: 1', ReviewDialog.ResultsMemo.Text) = 0) or
           not ReviewDialog.CheckButton.Enabled then
          raise Exception.Create('Native review dialog did not show the expected results.');
        ReviewDialog.WebsiteEdit.Text := 'changed input';
        if (ReviewDialog.ResultsMemo.Text <> '') or ReviewDialog.CheckButton.Enabled then raise Exception.Create('Changed inputs did not clear the review.');
        Writeln('Native review dialog passed.');
      finally ReviewDialog.Free end;
      Exit;
    end;
    if ParamCount = 12 then begin
      Review := ReviewDeployment(ParamStr(1), ParamStr(2), ParamStr(3));
      for Path in Review.Added do Writeln('A:', Path);
      for Path in Review.Changed do Writeln('C:', Path);
      for Path in Review.OnlyAtDestination do Writeln('R:', Path);
      for Transfer in Review.Transfers do
        Writeln('T:', Transfer.Path, '|', Ord(Transfer.IsReplacement), '|', Transfer.DesiredSize, '|', Transfer.DesiredSha256, '|', Transfer.ExpectedSize, '|', Transfer.ExpectedSha256);
      Writeln('W:', Review.WebsiteSha256);
      Writeln('S:', Review.ScanSha256);
      Writeln('B:', Review.BackupSha256);
      Exit;
    end;
    if ParamCount = 11 then begin
      Receipt := RestoreSftpOriginal('127.0.0.1', 'testuser', ParamStr(2), ParamStr(3), StrToInt(ParamStr(1)), ParamStr(4), ParamStr(5), ParamStr(6), StrToUInt64(ParamStr(7)), ParamStr(8), StrToUInt64(ParamStr(9)), ParamStr(10));
      Writeln(Receipt.Path, '|', Receipt.Size, '|', Receipt.Sha256, '|', Receipt.PreviousPath);
      Exit;
    end;
    if ParamCount = 10 then begin
      Receipt := ReplaceSftpFile('127.0.0.1', 'testuser', ParamStr(2), ParamStr(3), StrToInt(ParamStr(1)), ParamStr(4), ParamStr(5), ParamStr(6), StrToUInt64(ParamStr(7)), ParamStr(8));
      Writeln(Receipt.Path, '|', Receipt.Size, '|', Receipt.Sha256, '|', Receipt.PreviousPath);
      Exit;
    end;
    if ParamCount = 8 then begin
      Receipt := UploadNewSftpFile('127.0.0.1', 'testuser', ParamStr(2), ParamStr(3), StrToInt(ParamStr(1)), ParamStr(4), ParamStr(5), ParamStr(6));
      Writeln(Receipt.Path, ':', Receipt.Size, ':', Receipt.Sha256);
      Exit;
    end;
    if ParamCount = 7 then begin
      BackupSftpDestination('127.0.0.1', 'testuser', ParamStr(2), ParamStr(3), StrToInt(ParamStr(1)), ParamStr(4), ParamStr(5));
      Writeln('Backup saved.');
      Exit;
    end;
    if ParamCount = 6 then begin
      Entries := ScanSftpInventory('127.0.0.1', 'testuser', ParamStr(2), ParamStr(3), StrToInt(ParamStr(1)), ParamStr(4));
      SaveSftpInventory(Entries, ParamStr(5));
      Writeln('Scan saved.');
      Exit;
    end;
    if ParamCount = 4 then begin
      for Entry in ScanSftpInventory('127.0.0.1', 'testuser', ParamStr(2), ParamStr(3), StrToInt(ParamStr(1)), ParamStr(4)) do
        Writeln(Entry.Path, ':', Entry.Size, ':', Entry.Sha256);
      Exit;
    end;
    if ParamCount = 5 then begin
      DownloadSftpSnapshot('127.0.0.1', 'testuser', ParamStr(2), ParamStr(3), StrToInt(ParamStr(1)), ParamStr(4), ParamStr(5));
      Writeln('Snapshot downloaded.');
      Exit;
    end;
    if ParamCount = 3 then begin
      TestSftpConnection('127.0.0.1', 'testuser', ParamStr(2), ParamStr(3), StrToInt(ParamStr(1)));
      Writeln('SFTP connection succeeded.');
      Exit;
    end;
    Application.Initialize;
    Dialog := TSftpForm.Create(nil);
    try
      if (Dialog.PortEdit.Text <> '22') or not Assigned(Dialog.TestButton.OnClick) then
        raise Exception.Create('SFTP dialog did not load correctly');
    finally
      Dialog.Free;
    end;
    DirectoryName := TPath.Combine(ExtractFilePath(ParamStr(0)), 'sftp-fixtures');
    ForceDirectories(DirectoryName);
    KeyName := TPath.Combine(DirectoryName, 'key');
    HostsName := TPath.Combine(DirectoryName, 'known_hosts');
    if not TFile.Exists(KeyName) then TFile.WriteAllText(KeyName, 'test key');
    if not TFile.Exists(HostsName) then TFile.WriteAllText(HostsName, 'test host');
    Rejected := False;
    try
      TestSftpConnection('-bad', 'user', KeyName, HostsName, 22);
    except on E: EArgumentException do Rejected := True end;
    if not Rejected then raise Exception.Create('Invalid hostname was accepted');
    Rejected := False;
    try
      TestSftpConnection('localhost', 'user@host', KeyName, HostsName, 22);
    except on E: EArgumentException do Rejected := True end;
    if not Rejected then raise Exception.Create('Invalid username was accepted');
    Rejected := False;
    try
      TestSftpConnection('', '', KeyName, HostsName, 22);
    except on E: EArgumentException do Rejected := True end;
    if not Rejected then raise Exception.Create('Empty inputs were accepted');
    Rejected := False;
    try
      TestSftpConnection('127.0.0.1', 'user', KeyName, HostsName, 1);
    except on E: EInvalidOpException do Rejected := True end;
    if not Rejected then raise Exception.Create('Closed port did not fail');
    Writeln('SFTP validation and local closed-port checks passed.');
  except
    on E: Exception do begin Writeln(E.ClassName, ': ', E.Message); Halt(1) end;
  end;
end.
