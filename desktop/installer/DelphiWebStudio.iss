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

[Icons]
Name: "{group}\Delphi Web Studio (Experimental)"; Filename: "{app}\DelphiWebStudio.exe"
