# Delphi Web Studio Pro 1.0

Delphi Web Studio Pro is a visual website editor for Windows that keeps everyday editing and project storage on your computer. Its Delphi desktop application displays the editor through Microsoft Edge WebView2, the browser engine embedded in the Windows window. It extends [OpenPage](https://github.com/buildingopen/openpage), the open-source website builder on which this application is based. The original permissive MIT license and attribution remain in the repository.

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

The editor supports local multi-page projects, reusable sections, independent objects and responsive layout, imported media, and portable project files. JSON (JavaScript Object Notation) is the text format that describes a site's content and layout; a ZIP archive can package that description together with its imported media. The Windows host validates project replacements and distinguishes saving a project from exporting a website. For a walkthrough, see [project files](docs/PROJECT_FILES.md), [editor experience](docs/EDITOR_EXPERIENCE.md), and [media library](docs/MEDIA_LIBRARY.md).

The 32-bit Windows edition (Win32) and 64-bit edition (Win64) are staged locally under `bin/Win32` and `bin/Win64`. Each executable uses the `editor` folder and matching WebView2 loader beside it. GitHub stores the source and documentation. Version 1.0.0 build 1 uses Windows file version 1.0.0.1. Review exported pages on your target devices and keep verified project backups. Local exports do not publish a site.

The [upstream baseline](docs/UPSTREAM_BASELINE.md) and [milestone handoff](docs/WEBSTUDIO_CODEX_HANDOFF.md) record earlier implementation requirements and evidence.

## Installing and checking the release

Separate Win32 and Win64 installers are prepared locally under `export/release-1.0.0.1`. Choose Win64 for 64-bit Windows. Setup requires Windows 10 or 11 and the Microsoft Edge WebView2 Runtime; if the Runtime is absent, follow the official download address in Setup and retry. SFTP, the SSH File Transfer Protocol, uploads files through an encrypted connection to a compatible hosting server. Its tools are included in both editions and use Windows OpenSSH Client, the optional Windows component that supplies that connection. Ordinary local editing works without development tools or a cloud account.

The installers preserve saved projects and the separate local profile. They are unsigned. Clean-Windows installation acceptance remains unverified; see [release review](docs/RELEASE_1_0_REVIEW.md) for exact evidence and limits. Building or installing this software does not publish a website.

## Optional Gemini assistance

The application uses Google Gemini, Google's online artificial intelligence service, for optional help with wording, layouts and existing content. A Gemini model is the software that produces a proposed result from your instructions. Access requires an API key, a secret credential obtained through Google AI Studio, Google's website for managing Gemini access and its Google projects. That Google project controls service usage and billing and is separate from the website project you edit here. Free tier means Google's service allowance for an eligible project; keep billing disabled for the project used with this app.

The Windows editor can reuse a saved Gemini key for selected-text assistance, new pages/sections, and reviewed edits to existing components. The assistant supports follow-up requests, existing media catalogs, content lists and navigation, with Preview, Apply and Undo. It uses the free-tier model without a paid fallback; the owner must keep the Google project on Free tier with billing disabled. See [Gemini assistant](docs/GEMINI_ASSISTANT.md) for operation, privacy and limits. These AI changes are currently local development under the owner's no-push instruction.

## Development checks

The editor is built with React, a library for interactive interfaces, and TypeScript, which adds type checking to JavaScript. Development uses Node.js to run the build tools and npm to install their dependencies. Vite supplies the local development server and production bundler. Release checks used Node 24.22.1 and npm 12.2.2:

```sh
npm ci
npm run dev
npm run lint
npm test
npm run build
```

Vite starts at http://localhost:5173; build includes TypeScript checking. Vercel is an optional cloud hosting platform; its API functions run on that platform rather than inside Vite. Cloud AI/publishing are optional services; do not enter production credentials or publish sites during ordinary checks.

Run `tools/build-release.ps1 -NodeExe <full-node-path>` to rebuild and stage both architectures, then `tools/package-release.ps1` to assemble the installers with Package Studio Pro, the installer-authoring application used for these release packages. The packaging script also retains complete authoring projects and their payloads under `Package Studio Pro/MySetups/DelphiWebStudioPro-1.0.0.1`; open the Win32 or Win64 `.wiproj` there to build it directly in Package Studio Pro. Native development uses RAD Studio 37.0, the Delphi development environment, and its Visual Component Library (VCL) for the Windows interface. The VCL WebView2 host is built for Win32 and Win64. Node is required for editor development and building the web bundle. Running the staged Windows app requires the WebView2 Runtime.

## Attribution

OpenPage copyright (c) 2026 Federico De Ponte, [MIT](LICENSE). Original history/license are preserved. Original README: [docs/UPSTREAM_README.md](docs/UPSTREAM_README.md). See [third-party inventory and packaging obligations](THIRD_PARTY_NOTICES.md).
