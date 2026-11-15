param(
  [string]$PackageStudioRoot = 'C:\New Delphi Projects\Package Studio Pro'
)
$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
$builder = Join-Path $PackageStudioRoot 'bin\WIPBuild.exe'
if (-not (Test-Path -LiteralPath $builder)) { throw 'Build the repaired Package Studio Pro first.' }
$releaseFolder = Join-Path $projectRoot 'export\release-1.0.0.1'
New-Item -ItemType Directory -Path $releaseFolder -Force | Out-Null
$workRoot = Join-Path $projectRoot ('test-results\package-release-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $workRoot | Out-Null
try {
  foreach ($platform in @('Win32', 'Win64')) {
    $bits = if ($platform -eq 'Win64') { '64' } else { '32' }
    $payload = Join-Path $workRoot "$platform\payload"
    New-Item -ItemType Directory -Path $payload -Force | Out-Null
    $binaryFolder = Join-Path $projectRoot "bin\$platform"
    $exe = Get-Item -LiteralPath (Join-Path $binaryFolder 'DelphiWebStudioPro.exe')
    if ($exe.VersionInfo.FileVersion -ne '1.0.0.1') { throw 'Rebuild version 1.0.0.1 before packaging.' }
    foreach ($name in @('DelphiWebStudioPro.exe', 'WebView2Loader.dll', 'editor')) {
      Copy-Item -LiteralPath (Join-Path $binaryFolder $name) -Destination $payload -Recurse
    }
    foreach ($name in @('LICENSE', 'README.md', 'SECURITY.md', 'THIRD_PARTY_NOTICES.md')) {
      Copy-Item -LiteralPath (Join-Path $projectRoot $name) -Destination $payload
    }
    $docs = Join-Path $payload 'docs'
    New-Item -ItemType Directory -Path $docs | Out-Null
    foreach ($folder in @('guides', 'pdf')) {
      Copy-Item -LiteralPath (Join-Path $projectRoot "docs\$folder") -Destination $docs -Recurse
    }
    foreach ($name in @('PRIVACY.md', 'RECOVERY.md', 'KNOWN_LIMITATIONS.md', 'COMPATIBILITY.md', 'RELEASE_1_0_REVIEW.md', 'THIRD_PARTY_LICENSE_TEXTS.txt', 'WEBVIEW2_SDK_LICENSE.txt')) {
      Copy-Item -LiteralPath (Join-Path $projectRoot "docs\$name") -Destination $docs
    }
    $requirements = @(
      'Windows 10 or 11|Windows10|https://www.microsoft.com/windows',
      'Microsoft Edge WebView2 Runtime|WebView2|https://developer.microsoft.com/microsoft-edge/webview2/',
      'Windows OpenSSH Client for SFTP|OpenSSH-Optional|https://learn.microsoft.com/windows-server/administration/openssh/openssh_install_firstuse'
    )
    if ($platform -eq 'Win64') { $requirements += 'Windows x64|Windows-x64|Choose the Win32 installer on a 32-bit Windows computer.' }
    $config = [ordered]@{
      schema = 'PackageStudioPro.Project.v1'
      productName = "Delphi Web Studio Pro ($bits-bit)"
      publisher = 'DelphiWebStudio'
      version = '1.0.0.1'
      installFolder = "{localappdata}\Programs\Delphi Web Studio Pro\$platform"
      licenseText = [IO.File]::ReadAllText((Join-Path $projectRoot 'LICENSE'))
      files = @(Get-ChildItem -LiteralPath $payload -File -Recurse | Sort-Object FullName | Select-Object -ExpandProperty FullName)
      shortcuts = @("StartMenu|Delphi Web Studio Pro ($bits-bit)|DelphiWebStudioPro.exe", "StartMenu|Delphi Web Studio Pro User Guide ($bits-bit)|docs\pdf\Delphi Web Studio Pro User Guide.pdf", "Desktop|Delphi Web Studio Pro ($bits-bit)|DelphiWebStudioPro.exe")
      registry = @(); environment = @(); pathEntries = @(); fileAssociations = @()
      prerequisites = $requirements
      features = @('Core|Required|Windows editor, SFTP tools, guides and notices')
      signingEnabled = $false; signingCertificatePath = ''; signToolPath = ''; timestampUrl = ''
    }
    $projectFile = Join-Path $workRoot "$platform\release.wiproj"
    $config | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $projectFile -Encoding utf8
    $output = Join-Path $workRoot "$platform\output"
    & $builder $projectFile $output
    if ($LASTEXITCODE -ne 0) { throw "Package Studio failed for $platform." }
    $setup = @(Get-ChildItem -LiteralPath $output -File -Filter '*Setup.exe')
    if ($setup.Count -ne 1) { throw 'Expected one self-contained setup executable.' }
    $destination = Join-Path $releaseFolder "DelphiWebStudioPro-1.0.0.1-$platform-Setup.exe"
    Copy-Item -LiteralPath $setup[0].FullName -Destination $destination -Force
    $hash = Get-FileHash -LiteralPath $destination -Algorithm SHA256
    "$($hash.Hash.ToLower())  $([IO.Path]::GetFileName($destination))" | Set-Content -LiteralPath "$destination.sha256" -Encoding ascii
    Copy-Item -LiteralPath (Join-Path $output 'build-report.txt') -Destination (Join-Path $releaseFolder "$platform-build-report.txt") -ErrorAction SilentlyContinue
    Write-Output "Prepared $destination"
  }
} finally {
  $resolved = [IO.Path]::GetFullPath($workRoot)
  $allowed = [IO.Path]::GetFullPath((Join-Path $projectRoot 'test-results')) + '\'
  if ($resolved.StartsWith($allowed, [StringComparison]::OrdinalIgnoreCase) -and (Test-Path -LiteralPath $resolved)) {
    Remove-Item -LiteralPath $resolved -Recurse -Force
  }
}
