program ProjectSaveSmoke;
{$APPTYPE CONSOLE}
uses System.SysUtils, System.IOUtils, System.Classes, WebStudio.ProjectSave in '..\..\desktop\project\WebStudio.ProjectSave.pas', WebStudio.ProjectOpen in '..\..\desktop\project\WebStudio.ProjectOpen.pas';
var
  Id: TGUID;
  Folder, Target, EmptyTarget: string;
  Data, Actual: TBytes;
  Index: Integer;
  Rejected: Boolean;
  LockedFile: TFileStream;
begin
  if CreateGUID(Id) <> 0 then raise Exception.Create('Could not make test ID.');
  Folder := TPath.Combine(TPath.Combine(GetCurrentDir, 'test-results'), 'native-save-' + GUIDToString(Id));
  if TDirectory.Exists(Folder) then raise Exception.Create('Test folder already exists.');
  TDirectory.CreateDirectory(Folder);
  Target := TPath.Combine(Folder, 'project.webstudio.json');
  EmptyTarget := TPath.Combine(Folder, 'empty.webstudio.json');
  try
    SetLength(Data, 1048587);
    for Index := 0 to High(Data) do Data[Index] := Byte(Index mod 251);
    SaveNewProjectFile(Target, Data);
    Actual := ReadProjectFile(Target, Length(Data));
    if Length(Actual) <> Length(Data) then raise Exception.Create('Saved byte count differs.');
    for Index := 0 to High(Data) do if Data[Index] <> Actual[Index] then raise Exception.Create('Saved bytes differ.');
    Rejected := False;
    try ReadProjectFile(Target, Length(Data) - 1);
    except on E: EArgumentException do Rejected := True end;
    if not Rejected then raise Exception.Create('Oversized project file was read.');
    LockedFile := TFileStream.Create(Target, fmOpenWrite or fmShareExclusive);
    try
      Rejected := False;
      try ReadProjectFile(Target, Length(Data));
      except on E: EFOpenError do Rejected := True end;
      if not Rejected then raise Exception.Create('Exclusively locked project file was read.');
    finally LockedFile.Free end;
    Rejected := False;
    try SaveNewProjectFile(Target, TEncoding.UTF8.GetBytes('replacement'));
    except on E: EOSError do Rejected := True end;
    if not Rejected then raise Exception.Create('An existing file was overwritten.');
    Actual := TFile.ReadAllBytes(Target);
    if (Length(Actual) <> Length(Data)) or (Actual[0] <> Data[0]) or (Actual[High(Actual)] <> Data[High(Data)]) then raise Exception.Create('Existing file changed.');
    SaveNewProjectFile(EmptyTarget, nil);
    if TFile.GetSize(EmptyTarget) <> 0 then raise Exception.Create('Empty file differs.');
    if Length(ReadProjectFile(EmptyTarget, 0)) <> 0 then raise Exception.Create('Empty read differs.');
    Rejected := False;
    try ReadProjectFile('relative.webstudio.json', 100);
    except on E: EArgumentException do Rejected := True end;
    if not Rejected then raise Exception.Create('Relative open path was accepted.');
    Rejected := False;
    try SaveNewProjectFile('relative.webstudio.json', nil);
    except on E: EArgumentException do Rejected := True end;
    if not Rejected then raise Exception.Create('Relative path was accepted.');
    Rejected := False;
    try SaveNewProjectFile(TPath.Combine(Folder, 'missing\project.json'), nil);
    except on E: EOSError do Rejected := True end;
    if not Rejected then raise Exception.Create('Missing folder was accepted.');
    if Length(TDirectory.GetFiles(Folder)) <> 2 then raise Exception.Create('Temporary files were left behind.');
    Writeln('Native create-only save and bounded project open passed.');
  finally
    if TFile.Exists(Target) then TFile.Delete(Target);
    if TFile.Exists(EmptyTarget) then TFile.Delete(EmptyTarget);
    TDirectory.Delete(Folder, False);
  end;
end.
