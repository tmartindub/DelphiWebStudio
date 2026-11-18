# Release package validation — November 18, 2026

The Win32 and Win64 installers contain Delphi Web Studio Pro **1.0.0 build 1**, with Windows file/product version **1.0.0.1**. The release tag is **v1.0.0.1**; the older v1.0.0 tag is preserved. Both applications were rebuilt after the page-heading and footer-checker corrections. All seven illustrated manuals and their companion PDFs are included.

## Installer and authoring files

The installers are in `export/release-1.0.0.1`:

| Edition | Installer | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| 32-bit | `DelphiWebStudioPro-1.0.0.1-Win32-Setup.exe` | 24,361,444 | `07232b3cc68ff72a750245548f230711c3e81424025a50ad1d7674e6ed34286b` |
| 64-bit | `DelphiWebStudioPro-1.0.0.1-Win64-Setup.exe` | 24,852,744 | `e4bd35a056fcfe4ad7f9951ed386c5177b32943c5e5bc60a9e7e7915fc813690` |

SHA-256 is a file fingerprint that identifies the exact tested package. Each installer has a matching `.sha256` file. The detailed local record is `export/release-1.0.0.1/package-verification.json`.

The complete Package Studio Pro authoring projects and matching payloads are saved under `C:\New Delphi Projects\Package Studio Pro\MySetups\DelphiWebStudioPro-1.0.0.1`. Open the `.wiproj` ending in `Win32` or `Win64` to build that edition. Previously generated historical export copies are not the current deliverables.

## Application and documentation checks

The complete regression run passed **447 tests**, with **two pre-existing optional integration checks skipped**. ESLint found no errors in the source, API and tests. TypeScript, Vite and both elevated native Release builds passed. An npm registry bulk advisory check covering all 322 locked package names and their recorded versions, including development dependencies, returned zero advisories. This was a dated registry check, not an independent security audit.

The actual Win32 and Win64 executables were tested with the complete corrected church project in isolated local profiles. Each reported **zero Check site findings and zero Export review findings**, then generated a valid 109-file website ZIP containing 13 published pages. Each published page has its description and one main H1 heading; footer column titles use H2. The separate Welcome Page remains a draft. All exported original media bytes were preserved, and measured image/footer styles and layout remained unchanged within floating-point precision. No JavaScript page errors occurred. Initial local asset lookups during asynchronous import were distinguished from the final rendered and exported results.

All seven manuals were refreshed in LibreOffice and rendered. Every one of their **148 pages** was visually reviewed. All **148 table-of-contents entries** have dotted leaders, working bookmark destinations and page numbers matching their companion PDFs. Original illustrations, tables, heading order and external links were preserved. The manuals explain descriptions, semantic headings, image title artwork, footer checks, local export and the tested release scope.

The earlier authorized live Gemini tests on both architectures verified that a named hero color change affected the hero and left the lower section unchanged, with Preview, Apply and Undo. This refresh made no additional Gemini request. The broader dated functional evidence and owner installation observations are in the [release review](RELEASE_1_0_REVIEW.md).

## Package checks

Each embedded ZIP passed its corruption check. All **40 payload files per edition** matched the current originals and saved authoring payload byte for byte, including the architecture-matched executable and Microsoft WebView2 loader, `index-Cg7QEAXm.js` editor bundle, all **14 guide files**, final README, licensing/privacy notices and SFTP instructions. No stale editor assets or unexpected payload files were present. Both loaders had valid Microsoft signatures.

Both packages have the correct per-user installation folder, platform prerequisites and three shortcuts. Their embedded console installer runtimes passed dry-runs with **40 planned file copies and three shortcuts**. The builder changes the Windows privilege manifest for per-user installation; executable sections outside the resource section still match the original runtime. Both graphical and console installer manifests specify `asInvoker`.

These final packages were checked by payload verification and dry-run. A new interactive installation, upgrade and uninstall on a fresh Windows machine was not performed in this refresh. Earlier engine lifecycle tests and the owner's actual installation/startup observations retain their original, narrower scope.

## Preservation and cleanup

Before changes, the complete pre-change backup ZIP was checked successfully:

`H:\Delphi Web Studio Backups\DelphiWebStudioPro-pre-SEO-headings-footer-20261118-202723-UTC.zip`

It contains 2,888 entries and has SHA-256 `895ba26852cea22e6c60bbec9717534ace26e09d628af13ddf888497503574ad`.

The saved church project received descriptions and the accessible Happenings heading. Its 83 media entries, page paths and visibility, appearance and dummy email destinations were preserved. Its matching local draft was updated with exact-before-value checks and verified after a normal restart; the other 13 drafts remained unchanged. The existing Website Test export and other saved project were preserved. On a different computer, open the corrected project ZIP to obtain its metadata changes; installing the new editor alone does not rewrite an older project copy.

Temporary browser profiles, extracted installer payloads and builder output were removed after their checks. Private website projects, drafts and credentials are excluded from the installers and GitHub release assets. No website was published, no domain was changed and no email was sent.

## Requirements and practical limits

Both editions require Windows 10 or 11 and Microsoft Edge WebView2 Runtime; Win64 requires 64-bit Windows. SFTP uses the optional Windows OpenSSH Client and the user's own server credentials. Gemini requires internet access and the user's own saved Google key. Free-tier operation requires the Google project to remain on Free tier with billing disabled; Google controls quotas and availability. Ordinary local editing and export need neither service.

The application and installers are unsigned, so Windows may display publisher or reputation warnings. Very old computers can have substantially longer startup times. See [compatibility](COMPATIBILITY.md), [known limitations](KNOWN_LIMITATIONS.md) and the [release review](RELEASE_1_0_REVIEW.md) for details. Validation supports the documented paths rather than guaranteeing every device or hosting provider.
