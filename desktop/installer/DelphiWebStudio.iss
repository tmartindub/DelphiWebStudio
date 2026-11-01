#ifndef StageDir
  #error StageDir must point to a verified desktop preview folder
#endif

[Setup]
AppId={{6C0E2605-2CF1-4623-B1F9-2C0D7F79D75F}
AppName=Delphi Web Studio (Experimental)
AppVersion=0.1.0
AppPublisher=Delphi Web Studio contributors
DefaultDirName={localappdata}\Programs\Delphi Web Studio Experimental
DefaultGroupName=Delphi Web Studio (Experimental)
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0
OutputBaseFilename=DelphiWebStudio-Experimental-Setup
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
LicenseFile=..\..\LICENSE
InfoBeforeFile=INSTALL-NOTES.txt
UninstallDisplayIcon={app}\DelphiWebStudio.exe
CloseApplications=no
RestartApplications=no

[Files]
Source: "{#StageDir}\DelphiWebStudio.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#StageDir}\WebView2Loader.dll"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#StageDir}\editor\*"; DestDir: "{app}\editor"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\..\LICENSE"; DestDir: "{app}"; DestName: "LICENSE.txt"; Flags: ignoreversion
Source: "..\..\THIRD_PARTY_NOTICES.md"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\..\docs\PRIVACY.md"; DestDir: "{app}\docs"; Flags: ignoreversion
Source: "..\..\docs\RECOVERY.md"; DestDir: "{app}\docs"; Flags: ignoreversion
Source: "..\..\docs\THIRD_PARTY_LICENSE_TEXTS.txt"; DestDir: "{app}\docs"; Flags: ignoreversion

[Icons]
Name: "{group}\Delphi Web Studio (Experimental)"; Filename: "{app}\DelphiWebStudio.exe"

[Code]
function InitializeSetup: Boolean;
var
  Version: String;
begin
  Result := RegQueryStringValue(HKLM32,
    'SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}', 'pv', Version)
    and (Trim(Version) <> '') and (Trim(Version) <> '0.0.0.0');
  if not Result then
    Result := RegQueryStringValue(HKCU,
      'Software\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}', 'pv', Version)
      and (Trim(Version) <> '') and (Trim(Version) <> '0.0.0.0');
  if not Result then
    SuppressibleMsgBox('Microsoft Edge WebView2 Runtime is required. Install it separately from Microsoft, then run this installer again.', mbError, MB_OK, IDOK);
end;
