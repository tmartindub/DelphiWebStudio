param(
  [Parameter(Mandatory=$true)][string]$NodeExe,
  [string]$RadBin = 'C:\Program Files (x86)\Embarcadero\Studio\37.0\bin'
)
$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
Push-Location $projectRoot
try {
  & $NodeExe node_modules/typescript/bin/tsc -b
  if ($LASTEXITCODE -ne 0) { throw 'TypeScript failed.' }
  & $NodeExe node_modules/vite/bin/vite.js build
  if ($LASTEXITCODE -ne 0) { throw 'Editor build failed.' }
  foreach ($platform in @('Win32', 'Win64')) {
    cmd.exe /d /c "call `"$RadBin\rsvars.bat`" && `"$env:WINDIR\Microsoft.NET\Framework\v4.0.30319\MSBuild.exe`" desktop\DelphiWebStudio\DelphiWebStudioPro.dproj /t:Rebuild /p:Config=Release /p:Platform=$platform /v:quiet /nologo"
    if ($LASTEXITCODE -ne 0) { throw "$platform native build failed. Close its running test instance before retrying." }
    $editorDestination = [IO.Path]::GetFullPath((Join-Path $projectRoot "bin\$platform\editor"))
    $expectedBin = [IO.Path]::GetFullPath((Join-Path $projectRoot "bin\$platform")) + '\'
    if (-not $editorDestination.StartsWith($expectedBin, [StringComparison]::OrdinalIgnoreCase)) { throw 'Invalid editor staging path.' }
    if (Test-Path -LiteralPath $editorDestination) {
      if ((Get-Item -LiteralPath $editorDestination).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Editor staging cannot be a junction.' }
      Remove-Item -LiteralPath $editorDestination -Recurse -Force
    }
    Copy-Item -LiteralPath (Join-Path $projectRoot 'dist') -Destination $editorDestination -Recurse
    $executable = Get-Item -LiteralPath (Join-Path $expectedBin 'DelphiWebStudioPro.exe')
    if ($executable.VersionInfo.FileVersion -ne '1.0.0.1') { throw 'Unexpected release version.' }
    Write-Output "$platform ready: $($executable.FullName), version $($executable.VersionInfo.FileVersion)"
  }
} finally { Pop-Location }
