program ProjectBackupStreamingSmoke;
{$APPTYPE CONSOLE}
{$B-}
{ Uses only synthetic files in a new test-results folder. }
uses Winapi.Windows, Winapi.PsAPI, System.SysUtils, System.Classes, System.IOUtils, System.Zip,
  WebStudio.ProjectSave in '..\..\desktop\project\WebStudio.ProjectSave.pas',
  WebStudio.ProjectOpen in '..\..\desktop\project\WebStudio.ProjectOpen.pas';
const ChunkCount = 1536;
var Id: TGUID; Folder, Source, Backup: string; FileStream, Entry: TStream;
  Archive: TZipFile; Header: TZipHeader; BeforeMemory, AfterMemory: TProcessMemoryCounters;
  Buffer, ReadBuffer: array[0..65535] of Byte; Index, Count: Integer; Extra: Byte;
begin
  if CreateGUID(Id) <> 0 then raise Exception.Create('Could not make test ID.');
  Folder := TPath.Combine(TPath.Combine(GetCurrentDir, 'test-results'), 'streaming-backup-' + GUIDToString(Id));
  if TDirectory.Exists(Folder) then raise Exception.Create('Test folder already exists.');
  TDirectory.CreateDirectory(Folder);
  Source := TPath.Combine(Folder, 'large.webstudio.zip');
  Backup := TPath.Combine(Folder, 'large-backup.zip');
  for Index := 0 to High(Buffer) do Buffer[Index] := Byte(Index mod 251);
  FileStream := TFileStream.Create(Source, fmCreate);
  try for Index := 1 to ChunkCount do FileStream.WriteBuffer(Buffer, SizeOf(Buffer)) finally FileStream.Free end;
  FillChar(BeforeMemory, SizeOf(BeforeMemory), 0); BeforeMemory.cb := SizeOf(BeforeMemory);
  if not GetProcessMemoryInfo(GetCurrentProcess, @BeforeMemory, SizeOf(BeforeMemory)) then RaiseLastOSError;
  SaveProjectRecoveryZip(Source, Backup, UInt64(ChunkCount) * SizeOf(Buffer));
  FillChar(AfterMemory, SizeOf(AfterMemory), 0); AfterMemory.cb := SizeOf(AfterMemory);
  if not GetProcessMemoryInfo(GetCurrentProcess, @AfterMemory, SizeOf(AfterMemory)) then RaiseLastOSError;
  if AfterMemory.PeakWorkingSetSize > BeforeMemory.PeakWorkingSetSize + 64 * 1024 * 1024 then
    raise Exception.Create('Recovery ZIP preparation used unexpectedly high working memory.');
  Archive := TZipFile.Create;
  try
    Archive.Open(Backup, zmRead);
    if (Archive.FileCount <> 1) or (Archive.FileName[0] <> 'large.webstudio.zip') then raise Exception.Create('Backup entry differs.');
    Archive.Read(0, Entry, Header, True);
    try
      for Index := 1 to ChunkCount do begin
        Count := Entry.Read(ReadBuffer, SizeOf(ReadBuffer));
        if (Count <> SizeOf(Buffer)) or not CompareMem(@Buffer[0], @ReadBuffer[0], Count) then raise Exception.Create('Backup data differs.');
      end;
      if Entry.Read(Extra, 1) <> 0 then raise Exception.Create('Backup contains extra data.');
    finally Entry.Free end;
  finally Archive.Free end;
  if TFile.GetSize(Source) <> Int64(ChunkCount) * SizeOf(Buffer) then raise Exception.Create('Source size changed.');
  Writeln('Streamed 96 MiB recovery ZIP with bounded working memory and verified every byte.');
end.
