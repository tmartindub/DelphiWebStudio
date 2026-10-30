# WebStudio (experimental)

WebStudio is being developed as a free, offline-first visual website designer for Windows, extending [OpenPage](https://github.com/buildingopen/openpage). This repository currently contains the upstream browser editor and M0 engineering baseline. It is not a finished desktop application.

Project repository: [tmartindub/DelphiWebStudio](https://github.com/tmartindub/DelphiWebStudio).

The intended application combines a React/TypeScript canvas with an IDE-editable Delphi shell. Users own their projects and exported sites. Save, Preview and Publish remain separate. No ecommerce, payments, subscriptions, forced account, injected advertising or automatic publishing is in the WebStudio scope.

## Current status

The experimental browser editor includes portable multi-page projects, page-aware undo, local starter designs, an IndexedDB media library and a bundled PDF viewer. Enable these project features with `VITE_WEBSTUDIO_PROJECTS=true`. See [project files](docs/PROJECT_FILES.md), [editor experience](docs/EDITOR_EXPERIENCE.md), and [media library](docs/MEDIA_LIBRARY.md).

The website export still uses online fonts and Tailwind. Local AI, native safe saves and the Delphi shell are not yet implemented. The inherited dependency audit reports 29 vulnerabilities, including two critical; this is not release-ready software.
See [baseline evidence](docs/UPSTREAM_BASELINE.md), [architecture](docs/WEBSTUDIO_ARCHITECTURE.md), [limitations](docs/KNOWN_LIMITATIONS.md), [compatibility](docs/COMPATIBILITY.md) and [roadmap](docs/ROADMAP.md).

## Development

Baseline verified with Node 24.19.0 and npm 11.6.2:

```sh
npm ci
npm run dev
npm run lint
npm test
npm run build
```

Vite starts at http://localhost:5173; build includes TypeScript checking. Vite alone does not run Vercel API functions. Cloud AI/publishing are optional services; do not enter production credentials or publish sites during ordinary checks.

Native development targets RAD Studio 37.0, Windows x64. WebView2 binding remains to be validated. Node is a development tool, not an end-user requirement.

## Attribution

OpenPage copyright (c) 2026 Federico De Ponte, [MIT](LICENSE). Original history/license are preserved. Original README: [docs/UPSTREAM_README.md](docs/UPSTREAM_README.md). See [third-party inventory and packaging obligations](THIRD_PARTY_NOTICES.md).
