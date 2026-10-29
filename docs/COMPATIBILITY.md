# Compatibility contract

Last changed: 2026-10-29.

- Preserve MIT history and legacy one-page JSON. Reuse current pages model; localStorage version is not a file format version.
- Migrations preserve recoverable originals, unknown blocks/properties and empty pages.
- Legacy blocks must have a documented Home meaning; active selection must not change export semantics.
- Save/open/preview never publish. Publish requires reviewed destination/file diff and explicit confirmation.
- Export must eventually work without Node, accounts or remote fonts/scripts, at root and nested hosting paths. Baseline fails this requirement.
- Windows 10/11 x64 and RAD Studio 37.0 are the desktop target; WebView2 binding is unverified.
- Native forms remain IDE-editable. React canvas is the owner-approved runtime exception.
- Add standard folders without moving upstream src/api/public/tests.
- Manual editing must work without AI. Exclude commerce/financial features from creation UI.
- GTranslate deferred until core application is written; no translation helper is added now.
