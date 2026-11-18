# Local installer refresh — November 17, 2026

The Win32 and Win64 installers for Delphi Web Studio Pro **1.0.0 build 1**, with application Windows file version **1.0.0.1**, have been refreshed for installation testing. They now contain the current executables and editor assets, including the neutral AI Assistant and named-section targeting fixes, together with all seven revised DOCX manuals and their seven companion PDFs. This replaces the older November 16 package contents without changing the application version.

## Installer and authoring files

Both self-contained Setup executables are in `export/release-1.0.0.1`:

| Edition | Installer | SHA-256 |
| --- | --- | --- |
| 32-bit | `DelphiWebStudioPro-1.0.0.1-Win32-Setup.exe` | `1c8e96a71d3f8a1cb44102f06e2e03a09acf0d0d48bbfa22d7fd06204d222540` |
| 64-bit | `DelphiWebStudioPro-1.0.0.1-Win64-Setup.exe` | `198efdd27fa619f0b7cc15dbc33b741cc5a2da894c6de621c77dfc8623565ccd` |

SHA-256 is a file fingerprint used here to identify the exact tested packages. A matching `.sha256` file accompanies each installer. The full verification record is `export/release-1.0.0.1/package-verification.json`.

The complete `.wiproj` authoring projects and their current payloads are saved under `C:\New Delphi Projects\Package Studio Pro\MySetups\DelphiWebStudioPro-1.0.0.1`. Open the file ending in `Win32.wiproj` or `Win64.wiproj` to build that edition in Package Studio Pro.

## Checks completed

For each installer, the embedded ZIP archive passed its corruption check, and all **40 application payload files** matched their current originals byte for byte. The same files also matched the saved authoring payload and its fingerprint manifest. This includes the executable, architecture-matched WebView2 loader, current `index-HZyJIBbK.js` editor bundle, all **14 guide files**, licensing and privacy notices, and SFTP operating information. No superseded editor assets remain in the saved payloads.

Both packages have the correct per-user installation directory, three shortcuts and platform requirements. Their embedded console installer runtimes passed dry-run checks, each reporting 40 planned file copies and three shortcuts without performing an installation. The installer builder rewrites the runtime's Windows privilege manifest for per-user installation; all executable sections outside the resource section remain identical to the builder's original runtime. Both graphical and console installer manifests specify `asInvoker`.

The packaged application files also match the binaries and editor assets used in the earlier successful live Gemini tests on both architectures. Those tests confirmed that the hero turned yellow while the lower section remained unchanged, and that Preview, Apply and Undo worked. No additional Gemini requests were made during this packaging refresh, and application tests or compilation were not repeated because no application code changed.

## Preservation and cleanup

Before replacing the packages, the existing release files and saved Package Studio authoring files were backed up to a ZIP on H:, and its corruption check passed:

`H:\Delphi Web Studio Backups\DelphiWebStudioPro-pre-installer-refresh-20261118-005955-UTC.zip`

The ZIP filename uses UTC; the local backup and refresh date was November 17. Saved projects, the local Website Test export, and both previously tested application build directories remained unchanged. Temporary build output and extracted verification payloads were removed after checking. No website was published, no email was sent, and nothing was pushed to GitHub.

## Remaining installation acceptance

These packages are ready for the user's installation test. This refresh verified package integrity and the installer dry-run; it did not run the interactive installation wizard or establish clean-Windows acceptance. Installation, startup, project save/reopen, local export, upgrade and uninstall preservation should still be exercised on the target test computer before a public release.

Windows 10 or 11 and Microsoft Edge WebView2 Runtime are required; the Win64 edition also requires 64-bit Windows. SFTP uses the optional Windows OpenSSH Client rather than bundled Windows system binaries. The editor can be used without SFTP or AI. Gemini assistance requires internet access and the user's own saved Google key; no credential is supplied in either package.

The application and installers remain unsigned, so Windows may display an unknown-publisher warning. This package refresh does not change the outstanding acceptance items in the earlier release review or constitute public-release approval.
