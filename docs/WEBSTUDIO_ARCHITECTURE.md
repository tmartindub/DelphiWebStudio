# WebStudio architecture map

Last changed: 2026-10-29. Inspected commit: 9818eb43a88e01b23cb55752e19902d8285a853b.

Entry: src/main.tsx -> src/App.tsx (BrowserRouter) -> Dashboard/Editor/Components/Deploy/Settings. src/layout/AppLayout.tsx and TopNav.tsx provide the web shell.

| Responsibility | Actual files and behavior |
| --- | --- |
| Project list | src/store/projectsStore.ts: Zustand persist in localStorage, config/settings per project |
| Content types | src/blocks/types.ts: SiteConfig {name,pages?,blocks,theme?}; PageConfig {id,name,path,blocks}; no portable schemaVersion |
| Editing/undo | src/store/configStore.ts: active page, snapshots, 50 undo entries; localStorage openpage-config version 2; top-level blocks often mirror last edited page |
| UI session | src/store/editorStore.ts: non-persistent selection, viewport, preview, active project and generation flags |
| Open/create | src/routes/Dashboard.tsx: setActiveProject + setConfig |
| Persistence | src/editor/EditorLayout.tsx: autosaves changed editing config into active project; no atomic filesystem save |
| Canvas | src/editor/Canvas.tsx: active page, theme resolution, Google Fonts, block wrappers and viewport frames |
| Block registry | src/blocks/registry.tsx: 19 React renderers, error boundary and unknown-type placeholder |
| Palette | src/lib/block-metadata.ts + src/editor/LeftSidebar.tsx: 19 types, 42 declared variants; includes pricing |
| Properties/theme | src/editor/PropertiesPanel.tsx, DesignPanel.tsx, src/lib/theme-presets.ts: field definitions and 10 presets |
| Page UI | src/editor/CanvasToolbar.tsx: add/rename/delete tabs, viewport, undo, export |
| AI client | src/lib/generate-site.ts: browser Gemini key/direct call, then /api/generate, then labeled template fallback; filters unknown types/empty pages |
| AI server | api/generate.ts: Vercel function, cloud Gemini, environment key, 30s timeout, JSON response |
| Image search | api/pexels.ts: remote API, not local media library |
| Export | src/lib/export-html.ts: separate renderer for 13 types, only config.blocks, CDN Tailwind/fonts, optional analytics |
| Publish | src/routes/Deploy.tsx -> src/lib/publish-site.ts -> api/deploy.ts -> Vercel; no SFTP or destination file diff |
| Tests/build | tests/export-html.test.ts, tests/deploy-security.test.ts; vite.config.ts, TypeScript configs, vercel.json; api is outside app TypeScript project |

## Required direction

Retain React and upstream layout. Introduce a portable versioned project and local assets, shared preview/export behavior, separate explicit saves/preview/publish, validated transactional AI actions and undo. Add native filesystem/credential ownership through a narrow typed Delphi bridge. No native forms/bridge exist yet.

Delphi forms use design-time .fmx/.dfm components and Object Inspector settings. Embedded React canvas is the owner-approved runtime UI exception. Prefer FMX Windows x64; validate an actual WebView2 binding before selecting it. Document any VCL fallback decision.

Owner folders are additive: bin, dcu, docs/guides, docs/pdf, export, help, images and icons, samples, source distributions, tools. Retain src/api/public/tests where upstream expects them. Ignore generated/personal content. GTranslate is deferred until the main application is written.
