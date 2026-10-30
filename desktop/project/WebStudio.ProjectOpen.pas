unit WebStudio.ProjectOpen;
{$B-}

interface

uses System.SysUtils;

{ Reads a native-caller-selected file without writing to it. The caller
  chooses the byte limit, validates the contents and owns UI and permissions. }
function ReadProjectFile(const SourcePath: string; MaximumBytes: UInt64): TBytes;

implementation

uses System.Classes, System.IOUtils;

function ReadProjectFile(const SourcePath: string; MaximumBytes: UInt64): TBytes;
var
  Stream: TFileStream;
  FileSize: Int64;
  Offset: NativeInt;
  ChunkSize: Integer;
begin
  if (Length(SourcePath) < 4) or not CharInSet(SourcePath[1], ['A'..'Z', 'a'..'z']) or
    (SourcePath[2] <> ':') or not CharInSet(SourcePath[3], ['\', '/']) then
    raise EArgumentException.Create('Select an absolute drive path for the project file.');
  Stream := TFileStream.Create(TPath.GetFullPath(SourcePath), fmOpenRead or fmShareDenyWrite);
  try
    FileSize := Stream.Size;
    if (FileSize < 0) or (UInt64(FileSize) > MaximumBytes) or
      (UInt64(FileSize) > UInt64(High(NativeInt))) then
      raise EArgumentException.Create('Project file exceeds the allowed size.');
    SetLength(Result, NativeInt(FileSize));
    Offset := 0;
    while Offset < Length(Result) do begin
      if Length(Result) - Offset > 1048576 then ChunkSize := 1048576
      else ChunkSize := Integer(Length(Result) - Offset);
      Stream.ReadBuffer(Result[Offset], ChunkSize);
      Inc(Offset, ChunkSize);
    end;
  finally
    Stream.Free;
  end;
end;
end.
