# Delphi Web Studio Pro 1.0 release review

Reviewed November 15, 2026. Application version **1.0.0 build 1**; Windows FileVersion and ProductVersion **1.0.0.1**.

## Deliverables and scope

The local Win32 and Win64 builds reside in `bin/Win32` and `bin/Win64`, with their matching WebView2 loader and editor bundle. Separate installers are assembled under `export/release-1.0.0.1` using the repaired Package Studio Pro. Setup includes the editor, SFTP workflow, seven illustrated DOCX/PDF guides, license notices and operating information. It excludes saved parish projects, local profiles, credentials, test fixtures, Node.js, optional AI models and the optional serverless API.

Windows 10 or 11 and Microsoft Edge WebView2 are required. The Win64 edition requires Windows x64. SFTP uses Windows OpenSSH Client and an SSH key plus trusted-hosts file. Missing OpenSSH does not prevent ordinary editing. Setup checks prerequisites before copying application files and offers an official Runtime download address rather than installing an undisclosed dependency.

## Validation evidence

- TypeScript application and API checks, ESLint and Release builds passed. Both executable architectures report 1.0.0.1. Their seven icon sizes match the supplied application icon; the Microsoft WebView2 loader signatures are valid.
- All **365 tests in 29 files** passed, with the optional offline-browser and SFTP fixture checks enabled. Dependency audit reported **zero vulnerabilities**, including development dependencies, after removing an unnecessary server-development package and updating the lint dependency tree.
- Native SFTP loopback tests passed for both Win32 and Win64: connection, remote inventory, backup, reviewed transfer, host-key rejection, stale/collision rejection and recovery behavior. The Win32 client now resolves native OpenSSH through Sysnative on 64-bit Windows.
- Both desktop editions passed the gallery interaction test in isolated profiles: old-image normalization, all four addition routes, identical properties, numeric position, duplication, deletion through three routes, Undo, reload and Preview. These tests did not use the parish project.
- Package Studio lifecycle acceptance passed install, hash verification, upgrade, failed-upgrade rollback, unsafe journal rejection, durable installed uninstall, self-cleanup and preservation of user files and unrelated empty folders. The actual wizard bundle reader was exercised with unsigned and synthetic certificate-overlay fixtures; the latter checks layout handling, not a trusted digital signature.
- All seven guides were reviewed against the implementation, refreshed in LibreOffice and visually inspected after rendering. Each has a real updateable TOC with dotted leaders, real page fields, a dated cover without duplicate cover artwork, and screenshots or diagrams appropriate to its purpose.

Google API keys now travel in request headers rather than URL query strings. Windows Credential Manager remains the desktop credential store. SFTP retains strict host-key checking and separate review/confirmation boundaries. Full applicable third-party license texts are included alongside the inventory and original OpenPage MIT attribution.

## Preservation

Prechange ZIP backups were verified on H: in the project-specific backup folders before edits. Saved parish projects were not changed. The saved project SHA-256 values retained from those backups are:

- `ICCTest - Weekly Bulletin.zip`: `fc7b30e88013115f46ca0ea0066aec5cffd48fe88527975359fedfb649fb5a0b`
- `ICCTest.zip`: `bf8678e6ef9d6826095864844d5426c29ed1bd59c9fca27f7f85b0dbfd23245b`

Setup installs per Windows account into architecture-specific application folders. Its ownership journal limits uninstall to recorded unchanged files and installer-created empty directories. Saved projects, the separate WebView profile and saved credentials are not removal targets.

## Outstanding acceptance and practical limits

**Clean-Windows installation and end-to-end interactive wizard acceptance remain unverified.** No clean Windows environment was available; the user previously deferred that test. Run the Test Guide on a clean Windows 10/11 computer before treating broad public installation acceptance as complete.

The application and setup packages are **unsigned**. A trusted signing certificate was not supplied, so Windows may show an unknown-publisher or SmartScreen warning. Synthetic certificate-overlay testing does not replace actual signing and verification.

SFTP compatibility with a particular public host, real hosting publication, live form-service delivery and optional cloud-provider quotas were not exercised. No website was published, no domain/DNS changed and no email sent. Optional serverless API routes need operator authentication, quotas and deployment hardening before public hosting; they are outside this desktop release payload. These checks establish the tested local paths, not a security certification or a guarantee for every device and host.
