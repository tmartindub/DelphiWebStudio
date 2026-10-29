# Experimental portable project files — M1 first increment

Last changed: 2026-10-29. Tracking: issue #2. This is the first M1 PR, not completion of M1 or a released desktop application.

## Enable and use

Set `VITE_WEBSTUDIO_PROJECTS=true` before starting Vite or building. The flag defaults off in `.env.example`. With it enabled, **Open project** appears on Dashboard and the editor; **Save project** appears while a project is open. These commands are separate from the existing HTML Export command and from Publish.

Open accepts unversioned OpenPage SiteConfig JSON or WebStudio schema 2. Each open creates an independent local draft and never edits the selected file. A legacy file is upgraded in memory and saved as a new `.webstudio.json` download. The original is the recovery source; no automatic in-place migration occurs. Repeated opens retain the document projectId but have distinct local draft IDs. Duplicate assigns a new document identity.

Save validates a snapshot and starts a JSON download. Browser download settings determine the final location and collision filename. The success message deliberately says that download started; it does not claim an atomic filesystem write or confirmed disk durability. Existing browser draft autosave remains available. Native atomic saves and recovery are later work.

## Format and preservation

```json
{"format":"webstudio","schemaVersion":2,"projectId":"stable-id","config":{"name":"My site","pages":[{"id":"home","name":"Home","path":"/","blocks":[]}],"blocks":[]}}
```

Unknown document/config/page/block fields and block types are retained through file parsing and serialization. The editor shows an unknown block as its existing placeholder. Empty pages remain intact. Top-level compatibility blocks are normalized to Home; when they match another existing page, that page's content is already retained. If they conflict with every page, import/save rejects the document rather than guessing which content to discard.

Validation rejects duplicate page/block IDs, duplicate paths (including case collisions), traversal/encoded/nonportable Windows paths, missing Home, malformed blocks, prototype-polluting keys, active/privileged URL protocols, invalid known theme values, non-JSON editor values and unsupported format versions. Invalid input is reported before opening a replacement project. Validation does not execute scripts, access files, contact AI or publish.

Current files cover SiteConfig content/theme and extension data. Existing per-project SEO/settings and assets/credentials are not yet integrated into this portable format. Connection credentials must never be added automatically to it. IDs already in valid files are preserved; the remaining editor page/block timestamp generators and page-aware undo are still M1 follow-up work.

## Evidence

- Fixture: `samples/five-page.webstudio.json`, SHA-256 `86E4C4A1E1525B3CAED07BB3EE07D7B4C3F684038E683ED05993E7714C79675D`.
- Actual browser Open -> News edit -> Save -> Open downloaded file retained all five pages, edited News text, empty Documents page and original projectId. Home compatibility blocks remained Home after a non-Home edit.
- Traversal-path input was rejected while the current Documents page remained intact.
- A future-chart block opened as a placeholder and survived Save with pluginVersion=7, its series and an unknown root pluginState field intact.
- All 35 automated tests pass (27 new and eight inherited), covering migration/roundtrip/malformed inputs, independent local imports, duplicate identity and targeted storage updates. Lint, TypeScript and the feature-enabled production build pass; CI also builds the default mode.
- Screenshot: `docs/m1-project-roundtrip.png`.
- M1 pre-change tracked-source ZIP: `H:\Delphi Web Studio Backups\WebStudio_M1_PreChange_89f6a6d.zip`, 397,371 bytes.

Complete multi-page static export, navigation references, native safe save/recovery, project settings/assets and consistent page undo remain outstanding. The inherited HTML exporter still has the offline/block-coverage gaps recorded in M0. This feature gate must stay experimental until those acceptance tests pass.
