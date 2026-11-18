# Experimental Windows installer

Inno Setup is the Windows installer compiler used by the script in this folder. It turns an already staged application into a Setup executable for another computer. Microsoft Edge WebView2 is the browser engine embedded in the editor; its loader connects the application to the installed Runtime.

The Inno Setup script builds a per-user Windows x64 installer from an already built and verified desktop stage. It installs the executable, WebView2 loader, local editor assets, MIT license, third-party notices, collected dependency and WebView2 SDK license texts, and offline privacy and recovery documents. It does not install Node.js, download anything, configure hosting, or publish a website. Uninstall removes installed program files but does not remove the separate WebView profile, project files or optional AI files.

The Microsoft Edge WebView2 Runtime must be installed separately; see [Microsoft's runtime distribution guidance](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/distribution). Setup checks the per-machine and per-user runtime registry entries. If neither contains a usable version, interactive setup offers to open the Microsoft download page and stops. Silent setup logs the missing prerequisite and stops. Optional local AI files are separate. An independent license audit and a clean Windows installation and end-to-end workflow are still required before release.

For the initial local build, Inno Setup 6.7.4 was obtained from the [official download page](https://jrsoftware.org/isdl.php), verified with a valid Pyrsys B.V. Authenticode signature, and installed in portable mode under `test-results`. Its installer SHA-256 was `a549929319f9120716677c685535ca4671e4b937b5fdc87e2585f32d8eb30e8c`. The compiler reported non-commercial use; confirm the applicable Inno Setup license before any commercial use.

To rebuild Delphi Web Studio Pro with an installed or portable `ISCC.exe`, use a freshly built stage containing `DelphiWebStudioPro.exe`, the x64 `WebView2Loader.dll` and the `editor` directory.

```powershell
& 'C:\path\to\ISCC.exe' '/DStageDir=C:\path\to\verified-stage' '/DAppBuildVersion=0.1.1' '/OC:\path\to\output' 'desktop\installer\DelphiWebStudioPro.iss'
```

## Clean Windows acceptance

Use a disposable Windows 10 or 11 x64 machine or VM and a fictional project. Start on a profile with no Web Studio data. Confirm the missing-runtime prompt on a machine without WebView2, then install Microsoft's Evergreen Runtime and run Setup again. Verify startup, creation, save, close, reopen, website ZIP export, and local browser preview with a PDF and gallery. Install the next version over the first, verify the same project and local data still open, then uninstall and verify the saved project file and local profile remain. Record the installer version, Windows version, WebView2 version, and results. The package uses the Win64 build and matching x64 loader.

The experimental installer built on 2026-11-01 from `bin/DelphiWebStudio-Preview-M7-20261101-1908` is in `bin/DelphiWebStudio-Installer-M7-20261101-1918`. Its SHA-256 is `0ed66fabdddc3b0203e5817c343038607a829412134ab44a8e4f57554bca7800`. On the existing Windows machine, the exact installer installed nine files matching the preview, the installed executable remained running during a brief isolated-profile startup check, and uninstall preserved a synthetic user file. It has not yet been tested on a clean Windows machine or through the full workflow as the installed executable.

The first local test installed to a fresh folder under `test-results`, compared all staged executable, loader and editor files by SHA-256, and uninstalled. The uninstaller preserved a synthetic user-created file in the install folder.

An isolated upgrade test built versions 0.1.0 and 0.1.1 from the installer script with a separate test application ID. Installing the second version added a changed application asset and preserved a synthetic user-created file; the test installation was then uninstalled. This verifies a local installer upgrade on the existing Windows system, not automatic update checks or clean-machine acceptance.

A second isolated test installed the package to a fresh folder, then compiled a test harness from the same desktop source alongside the installed editor and loader. With a fresh WebView profile and Node.js absent from the test process's PATH, it opened a synthetic five-page project, saved and reopened it, exported the website ZIP, and verified the pages, a page link and original PDF bytes. The test installation was then uninstalled. It used the machine's existing WebView2 Runtime and a legacy test save dialog; it was not a clean Windows VM test and did not exercise new-site creation, editing or AI in that run.

A further isolated installed-assets test used `tests/native/DesktopInstalledAIWorkflowSmoke.dpr`, the pinned llama.cpp runtime and the separately obtained supported 4B model. With a fictional brief and Node.js absent from PATH, it created a blank project, generated and approved a five-page plan, edited a headline, saved the project and exported five HTML pages containing the edit. An initial attempt failed to produce a reviewable plan without capturing its cause; a subsequent run passed. The test installation and its model process stopped afterward. This used the existing Windows installation and WebView2 Runtime, a test harness built from current desktop source, and legacy save dialogs; it is not a clean-machine or complete import-and-AI test.

The runtime prerequisite check was tested with the installed runtime and with a temporary installer variant pointing to a nonexistent test registry identifier. The latter stopped before installing; no system runtime or registry setting was changed by that simulation.

An isolated local installer test on 2026-11-01 verified that the installed privacy and recovery files matched their source files. It used the existing Windows system and did not replace clean-Windows acceptance or a full release test.
