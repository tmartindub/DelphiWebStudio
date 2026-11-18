# Delphi Web Studio Pro architecture map

Last reviewed November 15, 2026 for version 1.0.0 build 1. See the [Engineering Guide](pdf/Delphi%20Web%20Studio%20Pro%20Engineering%20Guide.pdf) for the detailed implementation and the [Runtime Flow](pdf/Delphi%20Web%20Studio%20Pro%20Runtime%20Flow.pdf) for execution order.

## Current architecture

The Windows shell is the Delphi window and native code that handle operating-system work. Microsoft Edge WebView2 supplies the browser engine embedded in that window. React builds the interactive editor, and TypeScript adds type checking to its JavaScript code. A narrow bridge carries supported requests between that editor and the native shell. JSON (JavaScript Object Notation) is the structured text used for project descriptions; the manifest is the versioned record that packages those descriptions and media references for saving.

| Area | Ownership |
| --- | --- |
| Windows shell | desktop/DelphiWebStudio/WebStudio.Main.dfm defines the form. WebStudio.Main.pas hosts WebView2, loads the adjacent editor bundle and coordinates native dialogs and downloads. |
| Bridge | src/desktop/native-bridge.ts and bridge-protocol.ts define editor requests. desktop/bridge/WebStudio.Bridge.pas checks message origin and supported operations. |
| Site and editing state | src/store/configStore.ts holds page and block content with undo. editorStore.ts tracks the active session. projectsStore.ts owns local drafts and saved manifest metadata. |
| Page commands | src/editor/CanvasToolbar.tsx separates scrolling tabs from actions derived from the selected page ID. src/project/page-links.ts visits known link fields, including Navbar submenus. |
| Media | src/media/media-library.ts stores project-scoped bytes and metadata. MediaLibraryDialog.tsx distinguishes picker and manager modes. Moving between folders keeps the asset ID and portable path. |
| Gallery | src/blocks/gallery/gallery-photos.ts normalizes stable photo IDs at project/configuration boundaries. Canvas actions, focused properties, position changes and export use the same collection. |
| Saved project | src/project/project-file.ts validates the versioned manifest. ProjectFileCommands.tsx matches reopened saved snapshots to existing drafts and packages media. desktop/project/WebStudio.ProjectSave.pas supports native staged replacement. |
| Site output | src/lib/export-html.ts renders independent HTML pages, rewrites known links and packages media. Calendar, Navbar, gallery and biography interactions use client scripts. src/routes/Deploy.tsx separates file review, local browser preview and optional deployment. |

Responsive rows in src/index.css and src/lib/export.css reflow from 940 px and collapse when the section container is at most 640 px. This is separate from the 700 px page-column rule. The Contact and multi-column Footer blocks use container widths for their internal grids. The native local website preview is implemented in desktop/project/WebStudio.WebsitePreview.pas and uses a temporary loopback server for the reviewed ZIP.

## Original upstream baseline

The remainder records the inspected upstream starting point and the first portable-project increment. OpenPage is the open-source website builder from which the project was forked. In this baseline, Google Gemini supplies online artificial intelligence, Vercel hosts optional server functions, and Pexels supplies an external image-search service. Use the map above for current behavior.

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

## M1 first increment

src/project/project-file.ts defines feature flag, schema-2 parsing/validation/serialization and legacy conversion. ProjectFileCommands.tsx provides explicit local Open/Save downloads from Dashboard and CanvasToolbar. projectsStore keeps imported document extension fields separately from editable draft config, with independent local IDs. Tests in project-file.test.ts and project-storage.test.ts cover model/storage invariants. PROJECT_FILES.md records the tested browser flow and remaining M1 scope.
