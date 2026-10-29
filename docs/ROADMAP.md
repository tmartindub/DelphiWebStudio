# WebStudio roadmap

Last changed: 2026-10-29. Milestones are acceptance gates, not completed-feature claims.

| Milestone | Deliverables | Exit gate |
| --- | --- | --- |
| M0 | Fork/history, source audit, baseline evidence, CI | Build/tests and browser edit/reopen/export checked; offline failure documented; M1 plan reviewable |
| M1 | Versioned portable project, migration/validation, IDs/paths, explicit save, page undo, complete multi-page export | Five-page save/reopen/export retains content/navigation; unknown types preserved; no publish |
| M2 | Beginner/designer/pro UX, responsive controls, reusable sections, orange/blue product UI, noncommercial templates | Nontechnical user edits responsive site without code |
| M3 | Bulk media, references/hashes, thumbnails, local PDF.js/document library | Mixed media import/cancel/reopen and PDF toolbar/mobile/offline output verified |
| M4 | Pinned licensed optional local model/runtime, validated proposed actions | Five editable pages without account/API fee; approval/undo and unsafe-action rejection |
| M5 | Collections/articles, RSS/sitemap/search, forms abstraction | Blog/document export works; unconfigured forms flagged |
| M6 | Self-contained export, base paths, SFTP diff/confirmation/receipt/rollback | Offline ZIP and compatible static-host deployment tested |
| M7 | Design-time Delphi shell, WebView2 bridge, native saves/credentials, installer | Clean Windows create/import/edit/AI/export without Node |
| M8 | Static HTML/WordPress import, security/accessibility/performance, docs/release | Regression/license audits, recovery/docs and beta tests; no silent data loss |

Use small feature branches and PRs. M0 includes docs/evidence/CI and minimal lint fixes; M1 follows behind a feature gate. Browser prototype does not complete the required Delphi product. Translation is deferred. Formal guides/help remain separate requested deliverables.

Tracking: [issues 1–9](https://github.com/tmartindub/openpage/issues) correspond to M0–M8, each assigned to its matching GitHub milestone.
