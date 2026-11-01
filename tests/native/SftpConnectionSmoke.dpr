program SftpConnectionSmoke;

{$APPTYPE CONSOLE}

uses
  System.SysUtils, System.IOUtils, Vcl.Forms, WebStudio.SftpConnection,
  WebStudio.SftpForm, WebStudio.SftpInventory;

var
  DirectoryName, KeyName, HostsName: string;
  Rejected: Boolean;
  Dialog: TSftpForm;
  Entry: TSftpInventoryEntry;
  Entries: TArray<TSftpInventoryEntry>;
begin
  try
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
