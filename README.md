# Delphi Web Studio Pro 1.0

Delphi Web Studio Pro is a visual website editor for Windows. Design pages, manage their content and media, save a portable project, and export a website you can test locally or place on compatible hosting. The application keeps ordinary editing and project storage on your computer; optional Google Gemini assistance helps with wording, layouts and changes to existing content.

This application extends [OpenPage](https://github.com/buildingopen/openpage), the MIT-licensed website builder created by Federico De Ponte. Its original license, attribution and history remain in this repository.

## Download and install

Get the [v1.0.0.1 release](https://github.com/DelphiWebStudio/DelphiWebstudio/releases/tag/v1.0.0.1), application version **1.0.0 build 1**, Windows file/product version **1.0.0.1**:

- [Win64 installer](https://github.com/DelphiWebStudio/DelphiWebstudio/releases/download/v1.0.0.1/DelphiWebStudioPro-1.0.0.1-Win64-Setup.exe) for 64-bit Windows.
- [Win32 installer](https://github.com/DelphiWebStudio/DelphiWebstudio/releases/download/v1.0.0.1/DelphiWebStudioPro-1.0.0.1-Win32-Setup.exe) for 32-bit Windows; it also runs on 64-bit Windows.

Both editions target Windows 10/11 and use Microsoft Edge WebView2 Runtime, the browser engine embedded in the desktop window. Setup checks for the Runtime and offers Microsoft's download address if it is absent. Local editing does not need Node.js, development tools or a cloud account. The installers include the editor, SFTP workflow, seven illustrated guides and third-party notices; private website projects, profiles and credentials are excluded.

SFTP, the SSH File Transfer Protocol, uploads exported website files through an encrypted connection to a compatible server. It uses the optional Windows OpenSSH Client and the account/key details supplied by your hosting provider. Missing OpenSSH does not prevent local editing or export. The application and installers are unsigned; see the [release review](docs/RELEASE_1_0_REVIEW.md) for tested configurations and practical limits.

## What you can do

- Arrange text, images, buttons, panels and other objects visually, with desktop, tablet and phone layouts.
- Build multiple pages, clickable text and images, anchors, dropdown submenus and reusable shared sections.
- Organize imported media into folders, create galleries with numeric positions and captions, and display PDF documents.
- Maintain calendars, staff directories with biography popups, contact pages and bulletin libraries.
- Format text, clean pasted wording, adjust paragraph spacing, use Windows spelling suggestions and add words to a personal dictionary.
- Ask Gemini to improve selected wording, create an editable page or section, or propose changes to existing components; review, refine, apply and undo the result.
- Save portable projects with their media, check page descriptions and heading structure, export independent HTML pages with their assets, and review the website locally before publishing.

A project is the editable source of your website. JSON (JavaScript Object Notation) is the structured text format that describes its content and layout; a project ZIP can package that description together with imported media. A website export contains the visitor pages and their supporting files. Saving or exporting does not publish a site. See [project files](docs/PROJECT_FILES.md), [editor experience](docs/EDITOR_EXPERIENCE.md) and [media library](docs/MEDIA_LIBRARY.md).

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

## Optional Gemini assistance

The application uses Google Gemini, Google's online artificial intelligence service, to propose content from your instructions. A Gemini model is the software that generates that proposal. Access requires an internet connection and an API key, a secret credential obtained through Google AI Studio, Google's website for managing Gemini access. The key identifies a Google project that controls service usage and billing separately from your editable website project.

Keep that Google project on Free tier with billing disabled, then save its key in the app's Settings for your Windows account. Free tier is Google's limited allowance for an eligible project. The app uses Gemini 3.5 Flash-Lite without automatic retries, alternate models or a paid fallback; it cannot verify or change your billing status. Google controls eligibility, quotas, availability and data-use terms.

The assistant starts with a choice of Create or Edit existing content. Selected wording has its own Help with selected text command. You approve the material to send, inspect a proposal, refine it where supported, and apply only the result you want. Accepted content remains editable and can be undone. Original media files and the saved credential are excluded from the content sent for review; authorized media catalogs contain file details instead. Free-tier material may be used to improve Google's products. The assistant does not publish, upload, send email or operate other applications. Exported websites do not need Gemini. See [Gemini assistant](docs/GEMINI_ASSISTANT.md) for complete procedures and limits.

## Checking and exporting a website

Add a short description under each page's Search details; a site-wide description supplies a fallback. A page's main heading is marked H1 in the generated website, while H2 introduces a subordinate section. If a banner image contains the page title, its Page heading field can provide that main heading to assistive technology without adding duplicate visible lettering.

Run Check site, then open Export and choose Review files. Resolve the findings that apply, download the reviewed ZIP, and use Open reviewed site in browser to test the generated pages locally. Keep the editor running for this temporary preview and choose Stop local preview when finished. Contact/address columns in a footer are ordinary information; intended navigation labels still need working destinations. The checker helps find specific omissions but does not certify accessibility, external links or security.

## Development and release checks

The editor uses React for its interactive interface and TypeScript for checked JavaScript source. Node.js runs the build tools; npm installs their dependencies, and Vite supplies the local development server and production bundle. The November 18 release rebuild used Node 24.22.3. Use the committed lockfile when preparing a source checkout:

```sh
npm ci
npm run dev
npm run lint
npm test
npm run build
```

Vite starts at http://localhost:5173. The build includes TypeScript checking. The Delphi desktop host is built with RAD Studio 37.0 and its Visual Component Library for Win32 and Win64. Running an installed edition requires WebView2, not these development tools.

On November 18, 2026, the full regression run passed **447 tests**, with two pre-existing optional integration checks skipped. Full source/API/test lint, TypeScript, Vite and both native Release builds passed. A separate npm registry bulk advisory check covering all 322 locked package names and their recorded versions, including development dependencies, returned zero advisories. These are dated checks, not an independent security audit or a guarantee for every computer.

Run `tools/build-release.ps1 -NodeExe <full-node-path>` to rebuild both stages, then `tools/package-release.ps1` to assemble the installers with Package Studio Pro. Its complete authoring projects and payloads are retained under `Package Studio Pro/MySetups/DelphiWebStudioPro-1.0.0.1`; open the matching Win32 or Win64 `.wiproj` to build it there. [Installer instructions](desktop/installer/README.md) explain the package inputs. Optional serverless API endpoints are outside the desktop payload and require separate operator configuration. Earlier implementation requirements are retained in the [upstream baseline](docs/UPSTREAM_BASELINE.md) and [milestone handoff](docs/WEBSTUDIO_CODEX_HANDOFF.md).

## Attribution

OpenPage copyright (c) 2026 Federico De Ponte, [MIT](LICENSE). Original history and license are preserved. Original README: [docs/UPSTREAM_README.md](docs/UPSTREAM_README.md). See [third-party inventory and packaging obligations](THIRD_PARTY_NOTICES.md).
