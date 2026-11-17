param(
  [string]$PackageStudioRoot = 'C:\New Delphi Projects\Package Studio Pro'
)
$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
$builder = Join-Path $PackageStudioRoot 'bin\WIPBuild.exe'
if (-not (Test-Path -LiteralPath $builder)) { throw 'Build the repaired Package Studio Pro first.' }
$releaseFolder = Join-Path $projectRoot 'export\release-1.0.0.1'
New-Item -ItemType Directory -Path $releaseFolder -Force | Out-Null
$savedProjects = Join-Path $PackageStudioRoot 'MySetups\DelphiWebStudioPro-1.0.0.1'
New-Item -ItemType Directory -Path $savedProjects -Force | Out-Null
$workRoot = Join-Path $projectRoot ('test-results\package-release-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $workRoot | Out-Null
try {
  $payloadHashes = [ordered]@{}
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
    foreach ($name in @('PRIVACY.md', 'RECOVERY.md', 'KNOWN_LIMITATIONS.md', 'COMPATIBILITY.md', 'RELEASE_1_0_REVIEW.md', 'THIRD_PARTY_LICENSE_TEXTS.txt', 'WEBVIEW2_SDK_LICENSE.txt', 'GEMINI_ASSISTANT.md', 'GEMINI_TEXT_ASSISTANCE.md', 'GEMINI_PAGE_ASSISTANCE.md')) {
      Copy-Item -LiteralPath (Join-Path $projectRoot "docs\$name") -Destination $docs
    }
    # Retain complete build inputs as deliverables, independently of temporary output.
    $savedPayload = Join-Path $savedProjects "$platform\payload"
    if (Test-Path -LiteralPath $savedPayload) {
      if ((Get-Item -LiteralPath $savedPayload).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Saved payload cannot be a junction.' }
      if (Get-ChildItem -LiteralPath $savedPayload -Recurse -Attributes ReparsePoint | Select-Object -First 1) { throw 'Saved payload contains a junction.' }
    }
    $packageFiles = @(foreach ($source in Get-ChildItem -LiteralPath $payload -File -Recurse | Sort-Object FullName) {
      $relative = $source.FullName.Substring($payload.Length + 1)
      $destination = Join-Path $savedPayload $relative
      New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
      Copy-Item -LiteralPath $source.FullName -Destination $destination -Force
      $destination
    })
    # Reconcile only generated payload files; keep the saved installer inputs current.
    foreach ($previous in Get-ChildItem -LiteralPath $savedPayload -File -Recurse) {
      if ($previous.FullName.StartsWith([IO.Path]::GetFullPath($savedPayload) + '\', [StringComparison]::OrdinalIgnoreCase) -and $previous.FullName -notin $packageFiles) { Remove-Item -LiteralPath $previous.FullName -Force }
    }
    $platformHashes = [ordered]@{}
    foreach ($file in $packageFiles) { $platformHashes[$file.Substring($savedProjects.Length + 1).Replace('\', '/')] = (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLower() }
    $payloadHashes[$platform] = $platformHashes
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
      files = $packageFiles
      shortcuts = @("StartMenu|Delphi Web Studio Pro ($bits-bit)|DelphiWebStudioPro.exe", "StartMenu|Delphi Web Studio Pro User Guide ($bits-bit)|docs\pdf\Delphi Web Studio Pro User Guide.pdf", "Desktop|Delphi Web Studio Pro ($bits-bit)|DelphiWebStudioPro.exe")
      registry = @(); environment = @(); pathEntries = @(); fileAssociations = @()
      prerequisites = $requirements
      features = @('Core|Required|Windows editor, SFTP tools, guides and notices')
      signingEnabled = $false; signingCertificatePath = ''; signToolPath = ''; timestampUrl = ''
    }
    $projectFile = Join-Path $savedProjects "DelphiWebStudioPro-1.0.0.1-$platform.wiproj"
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
    Write-Output "Saved Package Studio project: $projectFile"
    Write-Output "Prepared $destination"
  }
  $payloadHashes | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $savedProjects 'payload-sha256.json') -Encoding utf8
} finally {
  $resolved = [IO.Path]::GetFullPath($workRoot)
  $allowed = [IO.Path]::GetFullPath((Join-Path $projectRoot 'test-results')) + '\'
  if ($resolved.StartsWith($allowed, [StringComparison]::OrdinalIgnoreCase) -and (Test-Path -LiteralPath $resolved)) {
    Remove-Item -LiteralPath $resolved -Recurse -Force
  }
}
