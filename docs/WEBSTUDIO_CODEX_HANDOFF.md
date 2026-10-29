# WEBSTUDIO — MASTER CODEX IMPLEMENTATION HANDOFF

**Document version:** 1.0 • **Prepared:** 2026-10-29  
**Owner / target GitHub account:** `tmartindub`  
**Upstream:** https://github.com/buildingopen/openpage  
**Required fork destination:** `https://github.com/tmartindub/openpage` (or confirm existing fork/name before proceeding)  
**Working product name:** WebStudio (retain original attribution; final naming subject to owner decision)  
**Audience:** Codex engineering agent taking over full-stack and Delphi development

> **STATUS:** This is an implementation handoff, not a statement that a GitHub fork or code changes have occurred. The fork is a task for Codex after confirming the authenticated account and permissions. Preserve the upstream MIT license and copyright notices.

## 1. Directive to Codex — read first

You are responsible for turning the MIT-licensed OpenPage website builder into **WebStudio**, a professional, **completely free**, offline-first website designer. The product must combine familiar FrontPage-style direct visual editing, Wix-like ease and AI-assisted website generation, and WordPress-like site management, while producing independently hostable sites. Support personal and professional informational sites. **Exclude payments, ecommerce, shopping carts, paid memberships, financial billing, donation collection, and store-management functionality.**

**Non-negotiable behavior:** No forced account, subscription, ads, branding injected into published pages, surprise content, automatic publication, or hosting lock-in. Opening an existing project must not mutate or publish it. Save, Preview, and Publish are separate commands. Do not silently replace content or bypass review. User owns source project and output. Offline operation is the default; online integrations are explicitly optional.

Do not attempt a complete rewrite of OpenPage in Delphi. **Retain React/TypeScript for the visual canvas** and integrate with Delphi through an explicit bridge in a Windows desktop shell. Begin with inspecting/compiling the real upstream repository and recording what works; do not assume file names, interfaces, capabilities, or licenses based solely on this document.

## 2. Verified upstream facts and cautions

Verified from the publicly accessible upstream README on 2026-10-29: repository `buildingopen/openpage` has an MIT license; a JSON-first website configuration; React 19, TypeScript, Vite, Tailwind CSS, Zustand/Immer, dnd-kit; visual drag/drop; Gemini AI generation; theme presets; and HTML export. README describes 19 block types / 42 layout variants and 10 themes. The repository also contains `api/`, `docs/`, `public/`, `src/`, `tests/`, `CLAUDE.md`, `package.json`, and `package-lock.json`. Some older ancillary docs describe different block counts; **treat checked-out code as authoritative**, not README claims.

The README's “standalone HTML” claim needs verification for true offline independence: it also mentions Tailwind CDN and Google Fonts. Implement a packaging test that blocks undeclared remote dependencies in exported sites. OpenPage is not known to support high-fidelity import of arbitrary websites, complete multi-page CMS, or fully offline AI today. Treat these as new features.

References: https://github.com/buildingopen/openpage ; https://github.com/buildingopen/openpage/blob/master/README.md ; https://github.com/buildingopen/openpage/blob/master/LICENSE ; https://github.com/buildingopen/openpage/blob/master/CLAUDE.md .

## 3. GitHub setup and ownership (P0)

1. Authenticate GitHub as `tmartindub`; verify account with `gh auth status` or connected GitHub API. Do not fork into a personal or organization account with a different name.
2. Check for an existing `tmartindub/openpage` repository/fork before creating. If it exists, inspect whether it is already the correct fork and contains user work. **Never overwrite, delete, force-push, or recreate it.** If collision exists, consult owner; suggested alternate name `webstudio` only with explicit approval.
3. Fork `buildingopen/openpage` to account `tmartindub`, keeping fork relationship. Suggested CLI command **only after checks**: `gh repo fork buildingopen/openpage --clone=false --remote=false`; verify the actual target owner. Consider API fork with explicit organization/user target if supported.
4. Clone approved fork and set `upstream` remote to `https://github.com/buildingopen/openpage.git`. Record upstream commit SHA in `docs/UPSTREAM_BASELINE.md`.
5. Preserve `LICENSE`, copyright notices, and third-party notices. Keep original commit history and attribution. Set repository description accurately; write new `README.md` explaining WebStudio aims and upstream provenance.
6. Work in feature branches and PRs. Protect default branch; no force pushes. Prefer small reviewable changes, gated by tests and build verification.
7. Add `docs/ROADMAP.md`, `docs/DECISIONS/` for ADRs, `docs/COMPATIBILITY.md`, `docs/KNOWN_LIMITATIONS.md`, `SECURITY.md`, `CONTRIBUTING.md`, `CHANGELOG.md`, and `THIRD_PARTY_NOTICES.md`.
8. No secrets in repository. `.env.example` only; `.env`, model weights, binaries, uploaded personal files, signing keys, and temporary generated websites are gitignored.

**First Codex response must report:** repo and fork existence, actual authenticated GitHub owner, upstream SHA, branch, toolchain, baseline test/build results, and all blockers. Do not claim successful fork unless API confirms it.

## 4. Target users and experience

**Personas:** (a) beginner making a first website, (b) community/church/club coordinator publishing news and PDF bulletins, (c) photographer/hobbyist with galleries, (d) small informational business site, (e) professional designer who needs precise HTML/CSS editing and independent hosting.

**Primary workflow:** Install -> Create/Open/Import -> site planning wizard (manual or optional AI) -> editable pages -> drag/drop media/components -> desktop/tablet/mobile preview -> accessibility/SEO/link validation -> Save -> inspect deployment diff -> explicit Publish. Project should reopen intact after process crash.

**Three interface modes on same site model:** Beginner (templates, rich properties), Designer (responsive layout, layers, styling), Professional (HTML/CSS/JS editing, source inspection). Do not maintain three incompatible project formats.

**User-controlled content:** AI can propose a church calendar, blog, form, etc. but never inserts unrequested business scheduling or payment widgets. Template choice must not silently add advertisements, signup forms, commerce widgets, paid banners, or publishing links.

## 5. Architectural strategy and non-goals

### 5.1 Recommended staged architecture

- **Web visual editor:** Extend upstream React + TypeScript app; JSON typed schema remains authoritative.
- **Shared domain:** `SiteProject` schema with pages, components, reusable patterns, themes, assets, navigation, content collections, metadata, revisions, publish profiles. Schema versioning/migration is mandatory.
- **Desktop container:** Delphi FMX Windows x64 application using supported WebView2 binding (evaluate Delphi version/library availability before choosing wrapper). Desktop shell owns filesystem access, file dialogs, media import, backups, publish staging, native OS integrations, local AI lifecycle.
- **IPC bridge:** versioned JSON messages across WebView2 web-message APIs, with request ID, originating project/session ID, capability permissions, success/error and timeout. No raw shell command execution by web content. Validate source origin.
- **AI backend:** local llama.cpp or compatible runtime as child process bound to `127.0.0.1` with dynamic port and security token where applicable; quantized model distributed separately or in optional full installer. Optional BYO external provider. Structured actions validated and applied transactionally.
- **PDF viewing:** Mozilla PDF.js or equivalent locally bundled license-compliant viewer for published static sites and editor preview.
- **Storage:** human-readable project JSON and asset files; optional SQLite index for fast media search and content indexing. The canonical project MUST remain portable and not require a hidden central server.
- **Publishing:** deterministic static site generator, asset fingerprinting, local export + SFTP/FTPS (prefer secure SFTP), optional GitHub Pages/deploy adapters.

### 5.2 Non-goals for initial release

Full visual WYSIWYG reconstruction of every arbitrary website; editing Wix proprietary websites; running WordPress server plugins without a backend; server-side member accounts, checkout/payments; cloud hosted AI service; unrestricted auto-execution of LLM-generated code; complete browser-grade HTML/CSS editor rewrite.

### 5.3 Proposed repository shape (adapt after upstream inspection)

```text
openpage/
  src/                 # keep/extend upstream editor
  api/                 # existing backend compatibility, decouple Gemini
  packages/
    site-schema/       # versioned JSON schema, validators, migrations
    site-renderer/     # shared browser preview/export rendering
    editor-components/ # page/media/blog/PDF blocks
    ai-actions/        # typed action API, undo, validator
  desktop/
    DelphiWebStudio/   # FMX *.dpr, *.pas, *.fmx, project files
    bridge/            # typed IPC message specifications
    native-tools/      # optional helper executables
  resources/
    pdfjs/             # pinned licensed assets
    templates/
  tests/
    fixtures/          # example small sites, upload edge cases
    visual/
    integration/
  docs/
  build/
```

Codex may choose a simpler structure where upstream constraints warrant, but must record rationale and avoid unnecessary mass moves.

## 6. P0: baseline technical reconnaissance

**Before changing implementation**, read package scripts, TypeScript types, store implementation, block registry/rendering, export path, AI endpoint, tests, deployment assumptions, public assets, and CLAUDE.md. Execute dependency install using repo lockfile (`npm ci`), typecheck/lint/tests/build as available; record versions and failures. Inventory third-party dependencies, audit vulnerabilities and redistribution requirements. Inspect whether browser builds truly work offline. Write a brief architecture map with actual file paths and data flows.

Produce a tiny end-to-end smoke test: new site -> add text -> change theme -> save -> reload -> export -> open exported HTML offline (network disabled). Preserve baseline behavior through subsequent PRs.

## 7. Canonical site data model (P1)

Define a versioned, normalized `SiteProject` and stable IDs. Proposed conceptual shape:

```json
{
  "schemaVersion": 2,
  "projectId": "uuid",
  "name": "Example Site",
  "settings": {"locale": "en-US", "baseUrl": "/", "homepageId": "page-home"},
  "theme": {"tokens": {}, "breakpoints": {"mobile": 480, "tablet": 900}},
  "pages": [
    {"id": "page-home", "slug": "/", "title": "Home", "metadata": {}, "componentIds": ["cmp-hero"]}
  ],
  "components": [{"id": "cmp-hero", "type": "hero", "version": 1, "props": {}, "responsive": {}}],
  "assets": [{"id": "asset-logo", "path": "assets/images/logo.png", "hash": "sha256...", "mime": "image/png"}],
  "navigation": [],
  "collections": [],
  "reusableSections": [],
  "revisions": [],
  "publishProfiles": []
}
```

This is illustrative, not a demand to replace OpenPage's current schema wholesale. Create migrations from upstream one-page JSON. Enforce unique stable IDs, valid references, valid slugs, safe URL protocols, responsive values in supported ranges, and referential integrity. Save files atomically (temp + fsync/rename where feasible) with recovery snapshots. Separate user content from generated preview artifacts. Unknown component types must round-trip safely without data loss, rendered as clearly marked placeholders.

**Cross-cutting invariants:** every page has stable ID; paths cannot escape project root; renames update references; exported links resolve; operations are undoable; project save never triggers publish; migrations create backup and support rollback.

## 8. Visual editor (P1/P2)

Implement site-level page tree, breadcrumbs, tabbed pages, navigation menu editor, global header/footer, page duplication, drafts, template-based page creation, reusable section/pattern libraries, component palette with category search, property inspector, layers/outliner, keyboard shortcuts, undo/redo (transaction-based), multi-select, drag/drop, resize handles, spacing/guides, snap, per-breakpoint properties, accessible rich-text editing, link picker, animations/effects (reduced-motion aware), preview at preset and arbitrary viewport widths.

**Composition model:** default semantic responsive Flexbox/Grid; free absolute positioning only as explicit advanced option. Visual controls must manipulate typed models, not rewrite arbitrary HTML strings. Preserve manual custom CSS in designated editable scopes. Ensure user can always see and remove what AI/templates added.

**Component catalog:** headings, paragraph, lists, rich text, buttons, links, images, SVG icons, hero, section, container, columns, cards, separators, accordions, tabs, notices, embeds, video, audio, navigation, footer, gallery, carousel, table, timeline, events display, document cards, PDF viewer, search, article list, tags, breadcrumb, contact form shell, custom HTML embed with strong warnings and sandboxed preview. Pricing/store/payment blocks should not appear in default WebStudio library (existing upstream pricing blocks can remain in code for compatibility but hidden in creation palette and not injected).

**Site template requirements:** clean starter templates for personal site, portfolio, community organization, church, school club, informational business, documentation, and blog. All templates are manually editable and should never require a vendor account or publish company advertising.

## 9. Bulk media library (P1/P2)

Supports dragging from Windows Explorer and Import dialog. Types: JPEG, PNG, GIF, WebP, AVIF where supported, SVG (sanitize), PDF, TXT, DOCX/XLSX/PPTX as downloadable documents, ZIP if opted in, MP3, MP4, WebM, and other safe downloadable files. File types with active content require security-conscious handling; no arbitrary execution. Unsupported formats reported with reason. Never promise all office docs will render natively.

**Import pipeline:** enumerate selected files/folders -> check length/path/type/MIME signature -> apply configurable limits -> copy to staging -> SHA-256 fingerprint -> duplicate match resolution (reuse/keep separate/skip) -> EXIF/orientation and metadata capture -> thumbnail generation -> optional optimized web derivative (non-destructive) -> atomic asset registry update -> progress/cancel/resume report. Originals remain unchanged. Protect against file traversal, symlinks, duplicate collision, malicious SVG, huge/decompression-bomb media, malformed metadata, and zip bombs.

**User controls:** folders/tags, search, sort/filter by type/size/date, drag into pages, alt text and caption management, batch rename, asset replacement preserving logical references, missing-asset inspector, unused asset cleanup with preview and undo, size warnings and delivery optimization. Limit only by configured storage/budget and filesystem constraints; no arbitrary subscription quotas.

**Acceptance:** import 1,000 representative photos + 100 PDFs with cancellation; reopen, browse, link; renamed/replaced assets still resolve; duplicates handled deterministically; broken/corrupt files isolated; no original modified; exports contain only used/site-requested assets unless configured otherwise.

## 10. PDF viewer / document library (P1/P2)

Implement draggable `pdfViewer` block using pinned locally bundled PDF.js. Config includes `assetId`, `height`, `initialPage`, `fitMode` (width/page/auto), `showThumbnails`, `showSearch`, `showPrint`, `showDownload`, `showFullscreen`, `caption`, `mobileMode`, and accessibility label. Provide zoom, next/previous, page number, in-document text search for text PDFs, fullscreen, keyboard controls, printing and download according to page settings. Mobile display must be responsive; offer a clear download/open link fallback.

Embedded viewer must work on static hosts, **without relying on a remote PDF.js CDN**. Bundle worker and character-map assets appropriately; verify relative/absolute URLs under nested sites and subpaths. Password protected PDFs: request authorization in editor; do not embed passwords in published HTML or project JSON. For public static hosting, PDFs are inherently retrievable even when a Download button is hidden; do not misrepresent that as access control. Support PDF cover previews and searchable document-library listings. Textless scanned PDFs require separate OCR capability (optional later), not a fictitious search feature.

**PDF acceptance matrix:** one page, 200+ pages, large (>50 MB), scanned, searchable, encrypted, malformed, links, embedded fonts, unicode, mobile and offline; 404/missing asset; toolbar choices; keyboard-only interaction; fullscreen; print; nested hosting base path.

## 11. Multi-page CMS and content collections (P2/P3)

Blog/article types with title, slug, author display name, summary, hero image, rich content, categories/tags, status, created/modified dates, publish date, optional scheduled date, metadata; category archive pages, post pages, pagination, RSS feed, XML sitemap, internal search index, and navigation integration. Static export supports drafts omission and scheduled content at **build/publish time** only. Automatic timed publication requires an external scheduled runner; never claim it works from static HTML alone.

Content collections permit repeatable records (news, events, documents, staff profiles), schema-defined fields, sorting/filtering, reusable page templates, imported CSV/JSON, and collection-backed lists. Configurable article/document search may use generated client-side index; large sites need index-size budgets and lazy loading.

Contact forms: visual form builder with input types, validation, spam protection patterns, success/error states, accessible labels. **No pretending forms work with static hosting**: require optional configured endpoint (self-hosted or third-party), include privacy/consent notices and secure secrets handling. Publish validator should flag unconfigured forms.

## 12. Website import and portability (P3)

**Import tiers:**
- Tier 1: WebStudio JSON/project roundtrip with full fidelity.
- Tier 2: existing OpenPage JSON configs upgraded through migration.
- Tier 3: static HTML/CSS/images folder import; capture pages, local references, basic semantic structures, and editable supported blocks; preserve unknown HTML in isolated raw/embed blocks and warn about non-editable regions.
- Tier 4: WordPress XML content export (WXR) for posts/pages/categories; image acquisition requires separate authorized asset import; cannot import plugins/theme/server functionality automatically.
- Tier 5 (research only): accessible live URL capture or selected site archive with permission; scripts/CSS may not be fully reconstructible.

**Explicitly do not promise:** full Wix export or accurate reverse engineering of arbitrary JavaScript-driven websites. Imports must never overwrite destination or execute foreign scripts in privileged editor context. Include an import report showing preserved, converted, skipped and manual-fix items.

## 13. AI wizard — local first (P2/P3)

**Core principle:** AI proposes validated, typed operations; it must not run arbitrary shell commands, modify on-disk site files directly, inject executable JS without review, or publish automatically. Keep manual editor fully functional without AI.

### Model selection and licensing

Evaluate current quantized GGUF variants of **Qwen3-4B-Instruct-2507** (Apache-2.0 as currently advertised) and **Phi-4-mini-instruct** (MIT as currently advertised) with supported llama.cpp runtime. Before bundling, re-check exact model revision and license, tokenizer/config licenses, GGUF conversion provenance, and Windows runtime dependencies. Download from verified sources, pin SHA-256, preserve model and third-party notices. Do not assume that every community quantization is redistributable. Recommend optional on-demand model download and an explicitly labeled large offline installer. CPU-only fallback; quality benchmark on 8GB/16GB/32GB Windows computers.

### Wizard conversation

Ask minimal initial questions: website purpose, desired pages, audience, design style, logo/photos/documents if any, optional website title. Offer one-click sensible defaults and allow editing afterward. Generate site outline -> propose site pages/menu -> present preview -> apply user-approved transactional mutations -> validate -> create editable project. Example follow-ups: “Make the colors blue and white”, “Use my photos”, “Create a bulletin library from imported PDFs”, “Add a contact page”, “Make this mobile friendly”, “Undo that change”.

### Tool/action contract

Define discriminated typed commands (`createPage`, `renamePage`, `setThemeTokens`, `addBlock`, `modifyBlockProps`, `moveBlock`, `removeBlock`, `insertAsset`, `createDocumentLibrary`, `addPdfViewer`, `updateNavigation`, `generateArticleDraft`). Example:

```json
{"schemaVersion":1,"requestId":"uuid","mode":"preview","operations":[{"op":"addPdfViewer","pageId":"page-bulletins","assetId":"asset-october-pdf","props":{"height":700,"showDownload":true}}]}
```

Validate every operation against JSON schema and registered component capabilities. Check asset existence, page ID, permissions, field lengths and allowed URL protocols. Report proposed changes as readable diff and preview. Commit only after user approves (can support “auto apply safe edits” as explicit preference, but never auto publish). Maintain revisions/undo. Reject unsafe operations and explain. Support generation retries and repair attempts with a strict budget; do not loop indefinitely. Measure schema-valid action rate, usability, edit accuracy and hallucinated asset references.

### AI context/privacy

Provide only necessary sanitized project context; honor user-selected assets. Never upload documents/source to providers without separate opt-in. Redact secrets. Local inferencing should be loopback-only, process supervised, and stopped on exit. External AI is BYO optional; show data destination and approximate charges, if any. AI creates suggested text rather than asserting business facts or contact information it does not know.

## 14. Delphi desktop integration (P3/P4)

Target Delphi on Windows 10/11 x64. Confirm actual RAD Studio version/installed WebView2 wrapper compatibility before writing units. FMX recommended for shell, React for canvas; if FMX/WebView2 integration is unstable, evaluate VCL shell as documented engineering decision, not silent change. Proposed modules: `WS.Main`, `WS.ProjectManager`, `WS.WebBridge`, `WS.LocalServer`, `WS.AssetImporter`, `WS.PdfPreview`, `WS.AIHost`, `WS.Publish`, `WS.Revisions`, `WS.Logging`.

**IPC:** JSON messages `{protocolVersion, requestId, sessionId, origin, method, params}` plus matching replies. Allowlisted methods; ephemeral auth token per session; length limits and rate limiting; only trusted local editor origin; sanitize paths; never expose direct file system APIs to untrusted webpage. Use dedicated threads/tasks for import and export; support cancellation. Ship WebView2 runtime requirements clearly or provide bootstrapper. Package React production assets locally. Local server bound to loopback only and random port; defend against cross-origin/cross-site requests.

**Desktop actions:** New/Open/Save/Save As, project folder, backups, import assets, thumbnail jobs, build/export, SFTP publishing, local AI model management, preview, update checks optional with privacy-safe setting, logging, crash recovery. Use Windows Credential Manager/DPAPI (with appropriate threat model) for saved connection credentials; never store cleartext secrets in project JSON. Network access off by default unless user requests a network operation.

## 15. Export, publishing, search, SEO and accessibility (P2/P4)

**Export:** static `index.html`, page-specific paths, CSS/JS/assets, font packages with licenses, PDF.js runtime as needed, sitemap.xml, robots.txt, RSS, search index. No accidental CDN dependencies. Keep deterministic output for unchanged site inputs (except explicitly documented timestamp fields). Support base path `/` and `/subsite/`; relative asset references must work in either case. Advanced HTML/CSS/JS edits are never silently dropped.

**Publish:** stages `Build -> Validate -> Dry-run diff -> Backup target (where supported) -> Confirm -> Upload -> Verify -> Receipt`. Required manual confirmation after seeing destination and changed/deleted file list. No autosync or automatic publishing unless explicitly configured in a future feature. Start with local export and SFTP; add FTPS/GitHub Pages through adapters. Never send FTP passwords or use insecure FTP by default. Preserve last deployed manifest; support rollback with restore plan. Warn clearly before destructive remote deletions.

**SEO/accessibility:** page title, meta description, canonical URL, Open Graph, heading order, image alt text, navigation landmarks, contrast warnings, keyboard operation, skip links, focus visibility, reduced motion, accessible form labels, mobile layouts, broken links and sitemap validation. Do not promise automated compliance/certification; run audits and surface unresolved issues.

## 16. Security and privacy baseline

Threat model: malformed uploaded PDFs/images/SVG; prompt injection in imported documents; malicious HTML/JS in imported websites; AI tool abuse; local IPC cross-origin requests; traversal via archive names or asset paths; SFTP credential leaks; XSS in preview/export; dependencies with vulnerabilities; accidental publishing; external network references. Enforce upload type/size limits, safe parsing, sandboxing, CSP in preview, safe URL policy (`https:`, relative paths; cautious `mailto:`/`tel:`), HTML sanitization with a reviewed library, and output encoding. Never treat content in imported PDFs or websites as privileged AI instructions. Avoid broad embedded browser privileges. Provide downloadable offline privacy notice.

## 17. Testing and CI strategy

**Test categories:** TypeScript unit tests for schema/migrations/transformations; component tests; Playwright visual/E2E for designer and export; sample-project fixture tests; browser print/PDF tests; integration tests for bridge messages; Delphi DUnitX or equivalent unit tests; Windows UI smoke tests; packaging and installer tests; security fuzz tests for imports.

**Critical acceptance scenarios:**
1. Create a five-page site manually; save/reopen retains all edits, links and assets.
2. AI creates same five-page site from brief and yields schema-valid, editable components; no publish.
3. Import 100 images, 20 PDFs, 10 other docs in one action; correct thumbnails/metadata.
4. Drag a PDF onto a page; page navigation, search for text PDFs, print, zoom, fullscreen, mobile, offline exported display work.
5. Replace a PDF/image while keeping references intact.
6. Blog and document library export to working local static HTML with functional links/search.
7. Exported website opens without network (no external fonts, Tailwind CDN or JS).
8. Viewport tests 375/768/1440px: no unintended horizontal overflow; navigation works.
9. Import legacy OpenPage JSON and export without loss of its supported features.
10. Import existing static HTML, report conversion gaps without discarding originals.
11. No unconfigured contact form falsely appears functional.
12. No publish occurs from Save, Preview, AI edits, or project open.
13. SFTP publish displays complete diff, explicit confirmation, and post-upload verification.
14. Arbitrary invalid AI action cannot modify project; all accepted actions undoable.
15. Crash during save/import/export preserves last good project and gives recovery path.
16. Security scans for path traversal, XSS, malicious SVG, oversized PDF, injected prompt and network origin spoofing.
17. Licenses/third-party notices included; source repository remains usable by other contributors.

**Quality gates:** `npm ci`, lint, typecheck, tests, production build, Playwright tests, dependency/license scan, sample-site offline export validation, Windows builds for Delphi stages. Publish test evidence and screenshots/videos in PR descriptions; no release by merely saying code compiles.

## 18. Milestones, order, deliverables and exit gates

### M0 — Fork, audit, baseline (FIRST)
Fork to `tmartindub/openpage` after owner verification; clone; document exact upstream SHA, architecture, dependencies, licenses; baseline build/test and HTML offline-export audit. Deliver PR with docs/CI fixes only. **Exit:** original editor still builds, renders, saves and exports as baseline; findings documented.

### M1 — Multi-page project model and safe save
Schema v2, migration from original one-page configs, page manager, navigation, durable local saves, revision/undo. **Exit:** 5-page project reopens perfectly and exports correctly.

### M2 — Visual editor UX and templates
Better canvas, component selection, property editing, responsive breakpoints, header/footer, reusable sections, beginner/pro modes. **Exit:** nontechnical user builds site without touching source.

### M3 — Media import and PDF viewer
Batch media import, asset database, thumbnails, drag assets to pages, PDF.js component, document library. **Exit:** real mixed-file collection imported and displayed offline, with no broken references.

### M4 — Free local AI wizard
Pinned permissively licensed model + llama.cpp, local inference management, typed action API and site planner, quality tests. **Exit:** five-page site generated and edited in structured project with no account/API fee.

### M5 — Blog/CMS, search, forms abstraction
Content collections, article authoring, RSS, static site search, contact form validation/backends. **Exit:** publish blog/document site and detect unconfigured forms.

### M6 — Independent export and secure publishing
Self-contained assets, offline export, SEO checks, dry-run SFTP diff/confirmation/verification, rollback. **Exit:** site deploys correctly to arbitrary compatible static host and offline zip.

### M7 — Delphi desktop release
FMX shell, WebView2, typed bridge, native file operations, installer, update and diagnostic support. **Exit:** install on clean Windows VM; full flow from create/import/edit/AI/export without Node installed on user's PC.

### M8 — Professional import, hardening and release
Static HTML importer, WordPress content import, accessible code view, security/quality/performance work, public documentation, beta and release. **Exit:** regression suite, license audit, privacy and recovery docs; no data loss.

**Sequencing note:** React/web prototype may precede desktop shell, but **Delphi delivery remains an explicit product requirement**. Do not treat a working browser demo as completion of the Windows application.

## 19. Definition of done for every PR

- Scope stated, with linked milestone/issue.
- Actual files changed and schemas documented.
- TypeScript/Delphi compilation and tests pass; no unverified “done” claims.
- New behavior has automated tests, UI screenshot where relevant, and keyboard/accessibility check.
- Data migrations reversible and exercised with fixtures.
- Undo/redo and save/reopen unaffected.
- External network dependencies, notices, security impact and permissions assessed.
- Developer documents and user instructions updated.
- No surprise UI content, forced account, paid functionality or publish side effects.

## 20. Codex first-session work order (execute sequentially)

**A.** Verify authenticated account and whether destination fork exists; if GitHub permissions unavailable, provide exact commands and await access, do not invent a successful fork.  
**B.** Fork `buildingopen/openpage` to `tmartindub/openpage` without deleting existing repos.  
**C.** Clone, read full README/CLAUDE/LICENSE and relevant source; identify actual versioned schema, renderer, state-store, editor layout, export, AI endpoint and tests.  
**D.** Run baseline build/tests in a reproducible environment, report actual outcomes.  
**E.** Write `docs/WEBSTUDIO_ARCHITECTURE.md`, ADR-001 (extend OpenPage rather than rewrite), ADR-002 (JSON canonical schema), ADR-003 (offline AI structured tools), ADR-004 (Delphi shell + embedded React).  
**F.** Create tracked issues and milestone plan M0–M8.  
**G.** Implement M1 first behind feature flags, keep upstream output functional.  
**H.** Open small PRs and summarize changes + screenshots + test results after each stage.

### Copy-paste initial Codex instruction

> Read `WEBSTUDIO_CODEX_HANDOFF.md` in full. Your first mission is M0: safely create/verify fork of `buildingopen/openpage` under my GitHub user `tmartindub`, preserve the upstream MIT license and git history, clone it, run tests/build, audit the actual architecture and existing export behavior, then propose an incremental implementation PR for M1. Do not overwrite any existing repository, do not force-push, and do not claim features are implemented unless tested. The target is a completely free, offline-first Wix/WordPress/FrontPage-style visual website editor with local AI, unlimited user-owned media, PDF viewer, multi-page CMS, and a Delphi Windows shell; exclude all ecommerce/financial functionality and never publish without explicit user confirmation. At the end of M0 report repository URL, upstream commit, installed toolchain, baseline test results, file-level architecture, and next PR plan.

## 21. Open issues requiring deliberate decisions

- Final branding: WebStudio vs other name; trademark/name search before public release.
- Delphi RAD Studio version and WebView2 wrapper feasibility.
- Whether first public beta ships browser editor only or desktop app; desktop requirement is non-negotiable for complete product.
- Exact AI model/version/quantization and redistribution review.
- Whether interactive forms need a bundled server component or configured endpoint only.
- Content-collection storage scale and static search limits.
- PDF.js packaging, licenses, worker model and hosting under URL subpaths.
- Existing website import scope and fidelity tradeoffs.
- Upstream merging and fork maintenance policy.
- Publishing providers beyond local export and SFTP.

## 22. External references for engineering validation

- OpenPage repository: https://github.com/buildingopen/openpage
- Upstream README: https://github.com/buildingopen/openpage/blob/master/README.md
- Upstream LICENSE: https://github.com/buildingopen/openpage/blob/master/LICENSE
- Upstream CLAUDE.md: https://github.com/buildingopen/openpage/blob/master/CLAUDE.md
- GrapesJS (alternative/editor inspiration, not required dependency): https://grapesjs.com/
- Mozilla PDF.js: https://mozilla.github.io/pdf.js/
- llama.cpp: https://github.com/ggml-org/llama.cpp
- Qwen model example (verify exact licensing/revision): https://huggingface.co/Qwen/Qwen3-4B-Instruct-2507
- GitHub fork documentation: https://docs.github.com/en/get-started/quickstart/fork-a-repo

---

**Owner's overriding instruction:** Make a powerful, polished, FREE application for the public, NOT another developer utility. Reuse OpenPage wisely. Prioritize reliability, easy visual editing, offline privacy, user control, actual PDF/document functionality, and excellent quality over inflated feature claims. No action in the GitHub account has been taken by preparation of this document.
