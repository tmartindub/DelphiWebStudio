# Gemini assistance for text, creation and existing content

Last changed: 2026-11-17. Local development only; GitHub pushing and publication remain on hold.

## Using the assistant

Save a Google AI Studio key in Settings → Application-wide AI connection → Save key. Windows Credential Manager retains it for the current Windows account across projects and restarts. The owner has confirmed Free tier with billing disabled. The API key cannot establish billing status; the application asks for that confirmation and never retries against a different model or paid fallback.

Select wording for **Help with selected text**, or choose **AI assistant** beside Page tools for layouts and content. The toolbar always opens the neutral **AI Assistant** window: neither mode is selected and no request fields appear until you explicitly choose **Create** or **Edit existing content**. Both buttons remain visible, with the active mode highlighted. **Create** uses one reference page and supplied facts. **Edit existing content** takes its initial target from the editor selection only after you choose that mode. **Editing** shows the page and item; **Change selection** opens the page/component controls. Normal editing remains available without AI.

Each mode starts with a blank request and an example below it. For an existing panel, enter “Make this panel 50 percent wide and light blue; keep its text,” then choose **Preview changes**. Follow with “Make it 45 percent wide and use a paler blue” and **Refine preview**. The second request adjusts the proposed version; one **Apply** accepts both as an undoable edit. **Create** uses **Preview new content**, followed by **New preview** for a fresh result. Current page / Proposed page and Desktop / Tablet / Phone support visual review. Use the normal editor Preview after acceptance to exercise links and visitor controls; the AI review is read-only. The separate selected-text assistant keeps its **Preview** action.

**Connection details** contains the model and key information, with **Key saved** or **Setup needed** as the status. Confirm Free tier and sharing near the preview action. **Apply** appears when a proposal exists, **Undo** appears after acceptance, and **Close** is always available. Switching modes ends the previous mode’s temporary review.

Recent conversation shows previewed, applied, undone and discarded results. It stays in this window. Clear conversation removes that request context without changing the project. Discard preview leaves the original untouched; Stop cancels a pending request; Close or Escape discards an unapplied proposal. Apply rejects an intervening project edit rather than overwriting it. The assistant's Undo reverses its latest applied transaction only while it remains the most recent edit; otherwise use normal editor history. Save normally after accepting changes.

## Naming the section to change

For a direct request such as “Change the hero section background to yellow,” the assistant checks the named section against the current page before contacting Google. When the whole page is selected, a unique matching section becomes the request's target. **Request targets** identifies it. The hero's background means the background behind its heading and introductory text, rather than a panel inside it or the section below it.

If another component is selected, the assistant warns that the selection conflicts and offers a **Use …** button for the matching section. Choose that button, check **Editing**, then choose **Preview changes**. The warning makes no Google request and changes no project content. Switching targets discards any unapplied preview and its temporary conversation. If more than one section matches, choose the intended one; if none matches, change the selection or describe an existing section more precisely.

Explicit component types, supported names such as hero/banner, exact section headings and first/last section references help identify targets. An ordinary follow-up such as “Make it smaller” retains the current target. Creation requests and link destinations do not by themselves select an existing section for modification. A request that changes several sections belongs under the whole-page selection. Always review the proposed changes before Apply; the app also rejects a returned operation that attempts to modify another section for a recognized named-section request.

## Existing media and structured content

**Allow project media catalog** is optional. It sends names, logical folders, file types, dimensions and asset IDs—not files, blobs or local paths. Edit mode offers a folder selector; a request can use up to 500 entries. Creation can choose from approved existing images for galleries, staff portraits and card illustrations. Unknown images remain editable placeholders.

Supported list editing includes gallery photos, collage layers, staff members, FAQ and feature items, bulletins and documents, calendar events, Navbar entries and submenus, and Footer resources/buttons. Supply the real facts, dates and biographies. Replacing a gallery photo preserves its existing ID and caption. The assistant can select an existing PDF but does not read its contents or invent an event from it.

Navigation requests can preserve a clickable About parent while adding submenu entries, reorder links, assign image/button destinations, link an exact text phrase, and create or rename an anchor. Internal destinations must exist and not be drafts. Recognized incoming links are repaired when a page path or anchor changes. Shared-section property changes include the corresponding copies and identify them in the review.

## Limits and privacy

The fixed model is `gemini-3.5-flash-lite`, with one direct HTTPS request and a 90-second timeout. HTTP 429 stops with a quota explanation; retries remain manual. Request instructions are limited to 3,000 characters. Existing-edit context is limited to 400 targets and 120,000 characters, with at most 50 operations. Creation supports up to eight sections, twelve items per section and 36 per page. Selected-text limits remain documented in GEMINI_TEXT_ASSISTANCE.md.

Consent describes the context for each task. Selected components can contain sensitive text even when credentials and delivery settings are excluded. Whole-page selection includes its components; other pages contribute names and paths only. Free-tier content may improve Google's products. Original media files stay local. The key authenticates in a header and must not be logged or included in screenshots.

The assistant cannot execute generated code, operate arbitrary computer applications, publish, upload through SFTP, send email, install software, configure delivery endpoints, or delete a whole page. It does not create images or read media contents. The ordinary exported website contains the accepted components and has no Gemini dependency. Google controls account eligibility, quotas and future model availability.

## Implementation

- `src/blocks/editable-fields.ts` contains the existing property metadata shared with the Properties window.
- `src/ai/gemini-edits.ts` resolves recognized named sections locally, builds scoped targets, checks operations, resolves approved asset IDs, preserves rich text and incoming links, and constructs immutable before/after previews. Named background edits are checked against the owning block's background field.
- `src/ai/gemini-edit-request.ts` checks the requested target before reading the credential or making its one request, and handles bounded conversation and cancellation.
- `src/ai/GeminiEditAssistant.tsx` owns the temporary conversation and review controls. `GeminiPageAssistant.tsx` provides the neutral entry, explicit task selection, connection details and creation controls.
- `src/ai/AIPagePreview.tsx` reuses normal BlockWrapper rendering with isolated styles and inert interaction.
- `src/ai/gemini-pages.ts` retains the validated creation blueprint and generates ordinary components.

Local validation rejects unknown fields, prototype-related keys, unsupported operations, unsafe protocols, invalid dates, out-of-scope targets and missing assets. No partial transaction is applied. Apply compares both reviewed snapshots and commits through the existing config-store history. Media connections and object URLs owned by the assistant are released when it closes.

## Verification and preserved data

The regression suite passed **443 tests** with two pre-existing integration skips. TypeScript, the production frontend build and both native builds passed. Focused checks include privacy/consent, exact rich-text preservation, panel children, list identity, real media references, dates, Navbar children, inline links, anchor/page-path repair, stale previews, atomic failure, Undo/Redo, portable serialization and static HTML export.

The actual Win32 and Win64 production applications passed isolated UI checks for existing edits, follow-up previews, Apply and exact Undo, media references, staff/bulletin/calendar entries, navigation/anchors, responsive review widths, quota errors, Stop and Escape. Each also read the saved Windows credential and successfully completed two live Gemini requests using only synthetic panel content: an initial size/color change and a follow-up size refinement. No user project text or key contents were logged. Creation UI regression checks passed after task-switch integration; prior stage validation also exercised live page/section creation in both builds.

The named-target correction has its own repeatable native regression, `tests/browser/gemini-targeting.mjs`. It requires an isolated WebView profile and loopback CDP connection, mocks the credential read and Google replies, and rejects live-mode opt-in. Both architectures are checked for a conflicting lower-section selection, explicit Hero selection, rejection of wrong-block and child-panel operations, a yellow Hero in the AI review, Editor and ordinary site Preview, unchanged lower content, exact Undo, whole-page narrowing and duplicate-heading choices. The targeting checks use no real key and make no live Gemini request. Existing native editing regressions also pass with the targeting safeguards in place.

The pre-completion backup is `H:\Delphi Web Studio Backups\DelphiWebStudioPro-stage2-working-pre-AI-completion-20261117-011001-UTC.zip` (500 files, 198,793,489 bytes, CRC verified; SHA-256 `61ffbfa5ac1580ea06cb5eca556b963ae432d578eb30f25bc5b2a61732298b5d`). The complete pre-AI v1.0 fallback remains preserved. Saved project and Website Test hashes are checked again before final commit. Clean-machine installation and arbitrary-provider compatibility remain subject to the existing release limitations.

References: [Google pricing](https://ai.google.dev/gemini-api/docs/pricing), [billing](https://ai.google.dev/gemini-api/docs/billing), [model](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite), [structured outputs](https://ai.google.dev/gemini-api/docs/structured-output).
