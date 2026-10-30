program ProjectSaveSmoke;
{$APPTYPE CONSOLE}
uses System.SysUtils, System.IOUtils, WebStudio.ProjectSave in '..\..\desktop\project\WebStudio.ProjectSave.pas';
var
  Id: TGUID;
  Folder, Target, EmptyTarget: string;
  Data, Actual: TBytes;
  Index: Integer;
  Rejected: Boolean;
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
    Actual := TFile.ReadAllBytes(Target);
    if Length(Actual) <> Length(Data) then raise Exception.Create('Saved byte count differs.');
    for Index := 0 to High(Data) do if Data[Index] <> Actual[Index] then raise Exception.Create('Saved bytes differ.');
    Rejected := False;
    try SaveNewProjectFile(Target, TEncoding.UTF8.GetBytes('replacement'));
    except on E: EOSError do Rejected := True end;
    if not Rejected then raise Exception.Create('An existing file was overwritten.');
    Actual := TFile.ReadAllBytes(Target);
    if (Length(Actual) <> Length(Data)) or (Actual[0] <> Data[0]) or (Actual[High(Actual)] <> Data[High(Data)]) then raise Exception.Create('Existing file changed.');
    SaveNewProjectFile(EmptyTarget, nil);
    if TFile.GetSize(EmptyTarget) <> 0 then raise Exception.Create('Empty file differs.');
    Rejected := False;
    try SaveNewProjectFile('relative.webstudio.json', nil);
    except on E: EArgumentException do Rejected := True end;
    if not Rejected then raise Exception.Create('Relative path was accepted.');
    Rejected := False;
    try SaveNewProjectFile(TPath.Combine(Folder, 'missing\project.json'), nil);
    except on E: EOSError do Rejected := True end;
    if not Rejected then raise Exception.Create('Missing folder was accepted.');
    if Length(TDirectory.GetFiles(Folder)) <> 2 then raise Exception.Create('Temporary files were left behind.');
    Writeln('Native create-only project save passed.');
  finally
    if TFile.Exists(Target) then TFile.Delete(Target);
    if TFile.Exists(EmptyTarget) then TFile.Delete(EmptyTarget);
    TDirectory.Delete(Folder, False);
  end;
end.
