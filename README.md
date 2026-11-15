# Delphi Web Studio Pro 1.0

Delphi Web Studio Pro is an offline-first visual website editor for Windows. The desktop application hosts a React and TypeScript editor in an IDE-editable Delphi WebView2 form. It extends [OpenPage](https://github.com/buildingopen/openpage). The original license and attribution remain in the repository.

Project repository: [DelphiWebStudio/DelphiWebstudio](https://github.com/DelphiWebStudio/DelphiWebstudio).

## Illustrated guides

| Guide | Editable | PDF |
| --- | --- | --- |
| User Guide | [DOCX](docs/guides/Delphi%20Web%20Studio%20Pro%20User%20Guide.docx) | [PDF](docs/pdf/Delphi%20Web%20Studio%20Pro%20User%20Guide.pdf) |
| Editor Reference | [DOCX](docs/guides/Delphi%20Web%20Studio%20Pro%20Editor%20Reference.docx) | [PDF](docs/pdf/Delphi%20Web%20Studio%20Pro%20Editor%20Reference.pdf) |
| Complete Workflow | [DOCX](docs/guides/Delphi%20Web%20Studio%20Pro%20Complete%20Workflow.docx) | [PDF](docs/pdf/Delphi%20Web%20Studio%20Pro%20Complete%20Workflow.pdf) |
| Runtime Flow | [DOCX](docs/guides/Delphi%20Web%20Studio%20Pro%20Runtime%20Flow.docx) | [PDF](docs/pdf/Delphi%20Web%20Studio%20Pro%20Runtime%20Flow.pdf) |
| Engineering Guide | [DOCX](docs/guides/Delphi%20Web%20Studio%20Pro%20Engineering%20Guide.docx) | [PDF](docs/pdf/Delphi%20Web%20Studio%20Pro%20Engineering%20Guide.pdf) |
| Test Guide | [DOCX](docs/guides/Delphi%20Web%20Studio%20Pro%20Test%20Guide.docx) | [PDF](docs/pdf/Delphi%20Web%20Studio%20Pro%20Test%20Guide.pdf) |
| Capabilities and Publishing Reference | [DOCX](docs/guides/Delphi%20Web%20Studio%20Pro%20Capabilities%20and%20Publishing%20Reference.docx) | [PDF](docs/pdf/Delphi%20Web%20Studio%20Pro%20Capabilities%20and%20Publishing%20Reference.pdf) |

## Current status

The editor supports local multi-page projects, reusable sections, independent objects and responsive layout, imported media, and portable JSON or ZIP project files. The Windows host validates project replacements and distinguishes saving a project from exporting a website. For a walkthrough, see [project files](docs/PROJECT_FILES.md), [editor experience](docs/EDITOR_EXPERIENCE.md), and [media library](docs/MEDIA_LIBRARY.md).

The Win32 and Win64 release builds are staged locally under `bin/Win32` and `bin/Win64`. Each executable uses the `editor` folder and matching WebView2 loader beside it. GitHub stores the source and documentation. Version 1.0.0 build 1 uses Windows file version 1.0.0.1. Review exported pages on your target devices and keep verified project backups. Local exports do not publish a site.

The [upstream baseline](docs/UPSTREAM_BASELINE.md) and [milestone handoff](docs/WEBSTUDIO_CODEX_HANDOFF.md) record earlier implementation requirements and evidence.

## Installing and checking the release

Separate Win32 and Win64 installers are prepared locally under `export/release-1.0.0.1`. Choose Win64 for a Windows x64 computer. Setup requires Windows 10 or 11 and the Microsoft Edge WebView2 Runtime; if the Runtime is absent, follow the official download address in Setup and retry. SFTP tools are included in both editions and use the Windows OpenSSH Client optional feature. Ordinary local editing needs neither Node.js nor a cloud account.

The installers preserve saved projects and the separate local profile. They are unsigned. Clean-Windows installation acceptance remains unverified; see [release review](docs/RELEASE_1_0_REVIEW.md) for exact evidence and limits. Building or installing this software does not publish a website.

## Development

Release checks used Node 24.22.1 and npm 12.2.2:

```sh
npm ci
npm run dev
npm run lint
npm test
npm run build
```

Vite starts at http://localhost:5173; build includes TypeScript checking. Vite alone does not run Vercel API functions. Cloud AI/publishing are optional services; do not enter production credentials or publish sites during ordinary checks.

Run `tools/build-release.ps1 -NodeExe <full-node-path>` to rebuild and stage both architectures, then `tools/package-release.ps1` to assemble the installers with Package Studio Pro. The packaging script also retains complete authoring projects and their payloads under `Package Studio Pro/MySetups/DelphiWebStudioPro-1.0.0.1`; open the Win32 or Win64 `.wiproj` there to build it directly in Package Studio Pro. Native development uses RAD Studio 37.0. The VCL WebView2 host is built for Win32 and Win64. Node is required for editor development and building the web bundle. Running the staged Windows app requires the WebView2 Runtime.

## Attribution

OpenPage copyright (c) 2026 Federico De Ponte, [MIT](LICENSE). Original history/license are preserved. Original README: [docs/UPSTREAM_README.md](docs/UPSTREAM_README.md). See [third-party inventory and packaging obligations](THIRD_PARTY_NOTICES.md).
