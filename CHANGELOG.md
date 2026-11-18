# Changelog

## 1.0.0 build 1 - 2026-11-18

- Released the Win32 and Win64 desktop editions with Windows file/product version 1.0.0.1 and Package Studio Pro installers containing the editor, SFTP workflow, illustrated guides and required notices.
- Added reviewed Google Gemini assistance for selected text, editable page/section creation and changes to existing components, with follow-up refinement, existing-media selection, navigation editing, Preview, Apply and Undo. Requests use the saved Windows credential and the fixed free-tier model without a paid fallback.
- Made AI targeting check the section named in a request, identify a unique match and warn when it conflicts with the selection. Both desktop editions were verified previously with synthetic live Gemini hero-color requests; the lower section remained unchanged.
- Added an Image block Page heading field for a main heading supplied by banner artwork, while preserving its visible appearance. Footer column headings now use the appropriate semantic level without changing their styling.
- Corrected the footer checker so ordinary contact/address columns are not reported as broken navigation; actual legacy navigation labels still require destinations. Added page descriptions and heading guidance to the manuals, together with the local reviewed-export procedure.
- Refreshed all seven DOCX/PDF guide pairs, preserving their illustrations and real dotted-leader tables of contents. Recorded the owner's separate Win32 and Win64 startup observations without treating them as hardware guarantees.
- Passed 447 regression tests, with two pre-existing optional integration checks skipped, plus full source/API/test lint, TypeScript, Vite and both native Release builds. The November 18 npm registry bulk advisory check returned zero advisories for all 322 locked package names and recorded versions, including development dependencies.

The entries below retain their original milestone dates. Counts, local-only restrictions and outstanding work recorded for those milestones describe that earlier state, rather than the current release.

## Historical release preparation - 1.0.0 build 1 — 2026-11-15

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

At that October 29 baseline, desktop hosting, local AI, native durable saves, complete offline export and secure publishing were still outstanding. Later entries and the current release review describe their implemented scope.
