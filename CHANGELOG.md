# Changelog

## 1.0.0 build 1 — 2026-11-15

- Added Windows file/product version 1.0.0.1, release build settings and a reproducible two-architecture staging script; retained the existing seven-size application icon.
- Corrected Win32 lookup of native OpenSSH for connection and inventory/transfer operations.
- Removed unused Vercel development tooling, updated lint tooling and pinned its safe glob matcher. Dependency audit is clear. Google credentials now travel in authentication headers.
- Prepared Package Studio Pro installers with checked prerequisites, installed uninstall metadata and preservation of project data.
- Updated the seven illustrated guides and their PDF companions, real dotted-leader TOCs, gallery controls and release instructions.


## Unreleased - 2026-11-06

- Group the editor commands into menus, standardize floating windows, and add visual text presets, project previews, and selected object tools.
- Save to the opened or last saved file in the current Windows session; use Save As for a new destination. Show confirmation and current file status in the editor.
- Browse large media collections in a thumbnail library and use the same picker in object properties.
- Add the illustrated Editor Reference in DOCX and PDF.

## Unreleased â€” 2026-10-29

- Embed generated site styles and use system font fallbacks in exports, removing the default Tailwind and Google Fonts network dependencies.

- Begin M3 with a project media library, portable media ZIPs, media blocks, and a locally bundled PDF viewer.

- Begin M2 with the WebStudio blue/orange interface, empty new projects, eight noncommercial starter types, and beginner/designer/professional JSON views.
- Hide pricing in creation palettes, create local starters without sending descriptions online, and make JSON edits validated and undoable.

- Add page-aware undo/redo, unique page and block IDs, validated page paths and Home-page protection.
- Include non-secret site settings in portable files, and export all pages with relative navigation in a ZIP. Disable premature publication in experimental mode.

- Rename the GitHub fork to `tmartindub/DelphiWebStudio`, retaining its OpenPage upstream relationship and history.

- Start M1 behind VITE_WEBSTUDIO_PROJECTS: portable schema-2 JSON Open/Save, lossless unknown-content preservation, input/path validation and five-page fixture.
- Preserve imported document metadata in independent local drafts; assign UUIDs for project creation/duplication and fresh portable identity to duplicates.
- Separate project-file commands from the crowded canvas toolbar row; verify five-page browser save/reopen and rejection without replacement.

- Fork upstream 9818eb43a88e01b23cb55752e19902d8285a853b, retaining license/history.
- Record architecture, build/tests, offline failure, license/dependency inventory and roadmap.
- Add CI and correct two inherited React lint failures.
- Resolve design-time native shell versus embedded React and additive folder layout; defer translation.

Desktop, local AI, native durable project saves, complete offline export and secure publishing remain outstanding.
