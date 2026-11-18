# Delphi Web Studio Pro installers

Last changed: November 18, 2026. Current release: 1.0.0 build 1; Windows file/product version 1.0.0.1.

## Current Package Studio Pro workflow

Package Studio Pro is the installer-authoring application used for the release. It reads a `.wiproj` project describing the package and combines its checked payload with a Windows setup program. The current release has separate Win32 and Win64 packages with the same editor features, guides and installation choices. Choose Win64 for 64-bit Windows and Win32 for 32-bit Windows; Win32 also runs on 64-bit Windows.

From the repository root, rebuild the stages before packaging:

```powershell
& '.\tools\build-release.ps1' -NodeExe 'C:\path\to\node.exe'
& '.\tools\package-release.ps1'
```

The packaging script defaults to `C:\New Delphi Projects\Package Studio Pro`. Its complete authoring inputs are saved under `MySetups\DelphiWebStudioPro-1.0.0.1` there:

- `DelphiWebStudioPro-1.0.0.1-Win32.wiproj`
- `DelphiWebStudioPro-1.0.0.1-Win64.wiproj`

Each project points to its corresponding retained payload and can be opened and built in Package Studio Pro. If source, binaries or manuals change, rerun the staging and packaging scripts so those payloads are refreshed. The distributable files under `export\release-1.0.0.1` are:

- `DelphiWebStudioPro-1.0.0.1-Win32-Setup.exe`
- `DelphiWebStudioPro-1.0.0.1-Win64-Setup.exe`

Send the matching Setup executable to the target computer. It contains the application, architecture-matched WebView2 loader, local editor assets, SFTP workflow, seven DOCX/PDF guides, privacy/recovery documents and license notices. It excludes private projects, browser profiles, credentials, test outputs, development tools, optional local AI runtimes/models and serverless API handlers. Package hashes and final payload evidence belong in [release package validation](../../docs/RELEASE_PACKAGE_VALIDATION.md).

## Target computer requirements and preservation

Both packages target Windows 10/11 and need Microsoft Edge WebView2 Runtime, the browser engine embedded in the editor. Setup checks its presence and offers Microsoft's download address if needed; it does not silently download or install the Runtime. Ordinary editing works without Node.js or a Google account. Optional Gemini assistance needs an internet connection and the user's saved key for a Google Free-tier project with billing disabled. Optional local AI files are supplied separately.

SFTP (SSH File Transfer Protocol) is the encrypted upload workflow included in both editions. It uses Windows OpenSSH Client and the hosting provider's connection details, the user's SSH key and a trusted-hosts file. Missing OpenSSH does not block local editing or export. Setup installs per Windows account into architecture-specific application folders. Uninstall uses the recorded file-ownership journal and preserves separately saved projects, the local WebView profile, local revisions, saved credentials and optional AI files. Keep verified project backups before installation or upgrade.

The application and installers are unsigned, so Windows may show an unknown-publisher or reputation warning. Owner startup/install observations and earlier Package Studio lifecycle checks are documented in the [release review](../../docs/RELEASE_1_0_REVIEW.md). They do not establish fresh-Windows VM acceptance or an interactive upgrade/uninstall of the final rebuilt packages. The Test Guide covers creation, editing, save/reopen, export, local browser review and preservation checks on the intended target computer.

Opening, saving, reviewing and exporting do not publish a website. Upload and rollback remain separate reviewed actions; preparing this application release does not publish a user's project.

## Historical Inno Setup prototype - November 1, 2026

The remainder is a dated November 1 prototype record, retained for historical context. Its x64-only Inno Setup script, experimental version numbers, file hashes and test limits are not the current release package workflow.

Inno Setup is the Windows installer compiler used by that earlier script. It turns an already staged application into a Setup executable for another computer. Microsoft Edge WebView2 is the browser engine embedded in the editor; its loader connects the application to the installed Runtime.

The Inno Setup script builds a per-user Windows x64 installer from an already built and verified desktop stage. It installs the executable, WebView2 loader, local editor assets, MIT license, third-party notices, collected dependency and WebView2 SDK license texts, and offline privacy and recovery documents. It does not install Node.js, download anything, configure hosting, or publish a website. Uninstall removes installed program files but does not remove the separate WebView profile, project files or optional AI files.

The Microsoft Edge WebView2 Runtime must be installed separately; see [Microsoft's runtime distribution guidance](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/distribution). Setup checks the per-machine and per-user runtime registry entries. If neither contains a usable version, interactive setup offers to open the Microsoft download page and stops. Silent setup logs the missing prerequisite and stops. Optional local AI files are separate. An independent license audit and a clean Windows installation and end-to-end workflow are still required before release.

For the initial local build, Inno Setup 6.7.4 was obtained from the [official download page](https://jrsoftware.org/isdl.php), verified with a valid Pyrsys B.V. Authenticode signature, and installed in portable mode under `test-results`. Its installer SHA-256 was `a549929319f9120716677c685535ca4671e4b937b5fdc87e2585f32d8eb30e8c`. The compiler reported non-commercial use; confirm the applicable Inno Setup license before any commercial use.

To rebuild Delphi Web Studio Pro with an installed or portable `ISCC.exe`, use a freshly built stage containing `DelphiWebStudioPro.exe`, the x64 `WebView2Loader.dll` and the `editor` directory.

```powershell
& 'C:\path\to\ISCC.exe' '/DStageDir=C:\path\to\verified-stage' '/DAppBuildVersion=0.1.1' '/OC:\path\to\output' 'desktop\installer\DelphiWebStudioPro.iss'
```

### Historical prototype acceptance procedure

Use a disposable Windows 10 or 11 x64 machine or VM and a fictional project. Start on a profile with no Web Studio data. Confirm the missing-runtime prompt on a machine without WebView2, then install Microsoft's Evergreen Runtime and run Setup again. Verify startup, creation, save, close, reopen, website ZIP export, and local browser preview with a PDF and gallery. Install the next version over the first, verify the same project and local data still open, then uninstall and verify the saved project file and local profile remain. Record the installer version, Windows version, WebView2 version, and results. The package uses the Win64 build and matching x64 loader.

The experimental installer built on 2026-11-01 from `bin/DelphiWebStudio-Preview-M7-20261101-1908` is in `bin/DelphiWebStudio-Installer-M7-20261101-1918`. Its SHA-256 is `0ed66fabdddc3b0203e5817c343038607a829412134ab44a8e4f57554bca7800`. On the existing Windows machine, the exact installer installed nine files matching the preview, the installed executable remained running during a brief isolated-profile startup check, and uninstall preserved a synthetic user file. It has not yet been tested on a clean Windows machine or through the full workflow as the installed executable.

The first local test installed to a fresh folder under `test-results`, compared all staged executable, loader and editor files by SHA-256, and uninstalled. The uninstaller preserved a synthetic user-created file in the install folder.

An isolated upgrade test built versions 0.1.0 and 0.1.1 from the installer script with a separate test application ID. Installing the second version added a changed application asset and preserved a synthetic user-created file; the test installation was then uninstalled. This verifies a local installer upgrade on the existing Windows system, not automatic update checks or clean-machine acceptance.

A second isolated test installed the package to a fresh folder, then compiled a test harness from the same desktop source alongside the installed editor and loader. With a fresh WebView profile and Node.js absent from the test process's PATH, it opened a synthetic five-page project, saved and reopened it, exported the website ZIP, and verified the pages, a page link and original PDF bytes. The test installation was then uninstalled. It used the machine's existing WebView2 Runtime and a legacy test save dialog; it was not a clean Windows VM test and did not exercise new-site creation, editing or AI in that run.

A further isolated installed-assets test used `tests/native/DesktopInstalledAIWorkflowSmoke.dpr`, the pinned llama.cpp runtime and the separately obtained supported 4B model. With a fictional brief and Node.js absent from PATH, it created a blank project, generated and approved a five-page plan, edited a headline, saved the project and exported five HTML pages containing the edit. An initial attempt failed to produce a reviewable plan without capturing its cause; a subsequent run passed. The test installation and its model process stopped afterward. This used the existing Windows installation and WebView2 Runtime, a test harness built from current desktop source, and legacy save dialogs; it is not a clean-machine or complete import-and-AI test.

The runtime prerequisite check was tested with the installed runtime and with a temporary installer variant pointing to a nonexistent test registry identifier. The latter stopped before installing; no system runtime or registry setting was changed by that simulation.

An isolated local installer test on 2026-11-01 verified that the installed privacy and recovery files matched their source files. It used the existing Windows system and did not replace clean-Windows acceptance or a full release test.
