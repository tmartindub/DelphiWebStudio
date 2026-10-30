# M0 upstream baseline

Last changed: 2026-10-29 (America/New_York).

## Identity and preservation

- Authenticated owner: `tmartindub`, verified using connector and CLI.
- Upstream: https://github.com/buildingopen/openpage, default branch `master`.
- Starting commit: `9818eb43a88e01b23cb55752e19902d8285a853b`.
- Fork created as `tmartindub/openpage` and renamed on 2026-10-29 to https://github.com/tmartindub/DelphiWebStudio. GitHub confirmed `fork: true` and parent `buildingopen/openpage` after the rename.
- Branch: `codex/m0-baseline`; workspace: `C:\New Delphi Projects\Delphi Web Studio`.
- Remotes: origin = `https://github.com/tmartindub/DelphiWebStudio.git`; upstream = `https://github.com/buildingopen/openpage.git`. Authenticated owner search found no private counterpart. No private counterpart was created.
- Workspace was empty. Pre-change ZIP: `H:\Delphi Web Studio Backups\WebStudio_PreChange_20261029_180857.zip`, 18,733 bytes, contains handoff and global directives; ZIP entries verified.
- Original MIT license, copyright and history remain intact.

## Actual toolchain

| Tool | Version/status |
| --- | --- |
| Node.js | 24.19.0, bundled desktop runtime |
| npm | 11.6.2, temporary official npm package via bundled pnpm; absent from PATH |
| GitHub CLI | 2.96.0 |
| React | 19.2.4 |
| TypeScript | 5.9.3 |
| Vite / Vitest | 7.3.1 / 4.0.18 |
| Tailwind / Zustand | 4.2.1 / 5.0.11 |
| RAD Studio | bds.exe product version 37.0 |
| Delphi x64 | dcc64.exe 37.0.59082.6021; installed, not compiled in M0 |

## Untouched upstream checks

| Check | Result |
| --- | --- |
| npm ci | PASS: 337 packages added, 338 audited; lockfile unchanged |
| tsc -b | PASS |
| Production build | PASS: 1,806 modules; 16.38s; JS 553.97 kB / 162.92 kB gzip; CSS 65.66 kB / 10.93 kB gzip |
| Unit tests | PASS: 2 files, 8 tests (5 deployment security, 3 export metadata/analytics) |
| Lint | FAIL: react-hooks/purity in LeftSidebar; react-hooks/set-state-in-effect in RightSidebar |
| Dependency audit | 29 vulnerabilities: 2 low, 5 moderate, 20 high, 2 critical |
| Offline HTML | FAIL: Google Fonts and Tailwind CDN requests fail with ERR_INTERNET_DISCONNECTED |

Sandbox initially produced GitHub authentication/DNS failures and Vite realpath EPERM. Repeating with appropriate access confirmed valid authentication and passing tests/build. These were environment restrictions. Build also warns about a >500 kB JS chunk.

## Browser smoke test actually performed

1. Start Vite on loopback 127.0.0.1:5173; create via **or start blank**.
2. Select Hero; set headline to `WebStudio M0 save and export check`.
3. Select Design -> Ocean. Export retains Inter/Sora/JetBrains Mono, confirming chosen theme.
4. Reload: editor reports **No project selected**, because active selection is not persisted.
5. Go to Dashboard and reopen Untitled Project: edited headline is present.
6. Export downloads untitled-project.html, preserving edited headline.
7. Open the actual file in installed Edge through Playwright with offline=true. Content remains, but font stylesheet and cdn.tailwindcss.com fail. The h1 falls back to 32px without Tailwind. The upstream fully self-contained export claim is false.

Local diagnostic evidence, ignored by Git: test-results/baseline-audit.json, baseline-export.html, baseline-offline.mjs, baseline-offline.json, baseline-offline.png. These are test evidence, not backups. No site was published and no external AI call was made.

## Narrow M0 corrections

LeftSidebar uses crypto.randomUUID at block creation, resolving the lint failure and that timestamp collision risk. RightSidebar derives the Properties tab from selection state rather than setting state inside an effect; explicit Design selection remains available. CI covers install/lint/tests/build; audit is a visible advisory job until findings are resolved, not a release security sign-off.

## M1 first PR plan

Reuse existing page support. Introduce versioned portable project import/export, lossless validation, stable IDs, safe unique paths, explicit saves and reopen integrity. Resolve active-page/legacy-block ambiguity and undo selection consistency. Preserve legacy APIs. Exercise legacy one-page, five-page, unknown-block and invalid fixtures. Gate the new project workflow. Complete page-aware export/block coverage must be tested before M1 completion.
