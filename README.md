# WebStudio (experimental)

WebStudio is being developed as a free, offline-first visual website designer for Windows, extending [OpenPage](https://github.com/buildingopen/openpage). This repository currently contains the upstream browser editor and M0 engineering baseline. It is not a finished desktop application.

Project repository: [tmartindub/DelphiWebStudio](https://github.com/tmartindub/DelphiWebStudio).

The intended application combines a React/TypeScript canvas with an IDE-editable Delphi shell. Users own their projects and exported sites. Save, Preview and Publish remain separate. No ecommerce, payments, subscriptions, forced account, injected advertising or automatic publishing is in the WebStudio scope.

## Current status

Upstream baseline: `9818eb43a88e01b23cb55752e19902d8285a853b`, branch master. Editor includes 19 block types, 42 catalog variants, 10 themes, basic page tabs and localStorage. Export currently needs online fonts/Tailwind, exports one block list and omits six editor types. PDF, local AI, native saves and the Delphi shell are not implemented.

Eight upstream tests and production build pass. M0 corrects two inherited lint errors. Baseline audit reports 29 vulnerabilities, including two critical; this is not release-ready software.

The first M1 increment adds experimental Open/Save project-file commands, lossless versioned JSON validation and a five-page sample. The current suite has 35 passing tests. Enable with `VITE_WEBSTUDIO_PROJECTS=true`; see [project-file behavior, tests and limits](docs/PROJECT_FILES.md). Complete multi-page HTML export and native safe saving remain outstanding.

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
