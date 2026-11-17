# Gemini page and section assistance — Stage 2

Last changed: 2026-11-16

This development is local on branch `codex/gemini-pages-stage2`. It has not been pushed to GitHub or published. Stage 1 selected-text assistance remains available.

## Creating something you can edit

Open a project and choose **AI assistant** beside **Page tools**. Select a new page or a section on the current page, then choose an existing page as the style reference. Describe the result you want. For example:

> Create a staff directory matching Home, with six portrait spaces and editable names, roles and biographies. Use clearly marked placeholders for missing details.

For a section, a suitable request is:

> Add three panels for visitors, volunteering and community events. Give each a short description, photo space and a button linking to /contact-us.

Use an existing page's actual address when requesting a button destination. **Facts and wording to use** accepts the names, descriptions or other information the assistant must work from. Missing facts should become labeled placeholders. Review the result for accuracy; the model does not independently verify facts.

Confirm that the saved key belongs to a Google project on **Free tier with billing disabled**, then consent to sharing the displayed context. These confirmations are remembered only for the running session. The assistant reuses the Windows-saved key; it does not ask for a key per project.

Choose **Preview**. The app requests a proposal, checks its structure and turns it into the same components used by the editor. The review lists the proposed changes and shows the new content at desktop, tablet and phone widths. Scroll within the content preview to see the whole result; the desktop preview also scrolls horizontally when the window is narrower than the page. The reference Navbar and Footer are copied only when the corresponding option is selected; they are not repeated in the content-only preview.

A new page's proposed name and address can be corrected before Apply without making another request. The address must be unique, such as `/staff-directory`. Choose **New preview** to request a different result.

**Apply** adds the reviewed page or section in one undoable edit. It never replaces an existing page or changes the global theme. A section goes after the block selected when the assistant opened, or before the footer when no block was selected. Selecting the footer also inserts before it. **Undo** in the assistant restores the previous site and page selection. After closing the assistant, the editor's normal Undo and Redo commands also work.

**Cancel**, Escape and the window's close button discard an unapplied proposal. **Stop** cancels a request in progress. Closing after Apply keeps the addition unless it has been undone. Save the project normally to keep accepted changes in its project file.

## What this phase can build

The supported section types are Hero, prose, cards, staff directory, FAQ, contact form, calendar and gallery. Card sections contain ordinary panels with separately editable text, optional photo spaces and buttons. Children belong to their panel, so moving it uses the existing grouped-object behavior. The normal responsive layout and export code handle these components.

The builder uses the reference content background and available reference fonts, together with the site's theme palette. It chooses readable text colors for the new backgrounds. The model supplies a bounded layout plan, not arbitrary styling or executable HTML.

Photo spaces are placeholders: this phase does not send, select, edit or generate photographs. Add images through the usual component properties and media manager after Apply. Gallery and staff placeholders can be filled in the same way. New calendars contain no invented events. New contact forms contain no generated recipient or service endpoint; configure them through the usual project/form settings before expecting delivery. Previewing or applying a proposal sends no email.

Copying navigation preserves its current destinations. The assistant does not silently add a visitor Navbar link to a new page. When the page is ready, add that link through the normal Navbar controls. Copied Navbar/Footer blocks retain any intentional shared-section behavior already present in the reference.

This phase adds content; it is not autonomous whole-site editing, code development, media understanding, hosting setup or publication.

## Data and free-tier boundaries

Each Preview makes one standard `generateContent` request to `gemini-3.5-flash-lite`. There are no tools, search grounding, automatic retries, alternate models or paid fallback. Google controls availability and quotas.

The API cannot force an arbitrary key onto Free tier. Billing must remain disabled on the key's Google project. The application cannot verify or change that setting. Google says free-tier content may be used to improve its products; do not supply confidential material.

The request includes the instructions and facts, site name, up to 100 page names/paths, selected theme values and a bounded text extract from the chosen reference page. It does not serialize the full project. Other pages' contents, media files, arbitrary properties, HTML source, deployment endpoints and stored connection settings are excluded. The saved Gemini credential is sent only as the API authentication header.

Limits are 3,000 instruction characters, 12,000 supporting-fact characters and 12,000 extracted reference-text characters. A page can contain one to eight new sections; section mode requires exactly one. Cards support one to four columns. Each section can have up to 12 items, with at most 36 items per page. Requests time out after 90 seconds. Generated links must target exact existing page paths. The app rejects oversized, unsupported or malformed plans rather than applying part of them.

## Implementation

`src/ai/GeminiPageAssistant.tsx` owns the review window, request cancellation, responsive content preview and Apply/Undo controls. It uses the existing React editor rather than adding native runtime-built forms.

`src/ai/gemini-pages.ts` extracts allowlisted reference context, reads the existing Windows credential and sends the request. Google's transport schema uses simple types and enums; local validation enforces the stricter item, length, column and section limits. Nested numeric/array constraints in the transport schema exceeded Google's serving-state limit during testing, so those constraints are enforced locally instead.

The conversion layer constructs normal `BlockConfig` and section-object records with fresh ids. Returned wording is handled as text. The model cannot create custom HTML, scripts, external links, endpoints or arbitrary project fields. Before Apply, the app checks that both the current site and reviewed proposal still match their snapshots. An intervening edit requires a fresh preview. Apply uses the existing config store and undo stack; accepted additions use normal project serialization and export.

## Verification

The pre-change ZIP is `H:\Delphi Web Studio Backups\DelphiWebStudioPro-stage1-working-pre-stage2-20261117-002324-UTC.zip`: 495 files, 199,551,425 bytes, ZIP CRC verified, SHA-256 `91dcf0c800490d25f961b200c8d0ce52a704f1dc4b6f2a0ce5bb1edbd14e8a1b`. It includes source, working builds, saved projects, documentation and assets. Reinstallable dependencies, generated caches, test results and duplicate Git history are excluded; the earlier complete v1.0 fallback ZIP remains preserved.

The regression suite passed 410 tests, with two existing integration tests skipped. TypeScript, the production bundle, changed-file lint and both native builds passed. Unit checks cover all eight supported section types, stale/tampered-plan rejection, unapproved/external fields, consent, request boundaries, insertion position, preservation of existing pages, exact Undo/Redo, portable save/reopen and HTML export.

Both actual desktop builds passed isolated UI tests for page and section Preview, Cancel, Apply, Undo/Redo, editable proposed names/paths, collision rejection, responsive preview, heading visibility, Stop and quota errors without retry. Each architecture also made two live Gemini requests using only a synthetic reference page: an editable staff-directory page and a two-panel section. Preview left the site unchanged, Apply added the normal components, and Undo restored the exact original site and page selection. No user project was opened and no key contents were logged.

The repeatable desktop check is `tests/browser/gemini-pages.mjs`. It requires an isolated WebView profile and loopback CDP address. Set `WEBSTUDIO_LIVE_GEMINI=1` only for an authorized live test against a confirmed unbilled project. Compact screenshots/results are retained in ignored `test-results/gemini-pages`; disposable profiles and generated caches are removed after validation.

Both architectures also passed a final check editing generated card text through the normal text editor, undoing that edit while keeping the section, and then undoing the section. The test applications were closed. Cleanup removed 655 disposable files totaling 152.69 MiB, including both test profiles, their shader cache, the generated frontend build copy and generated DCUs. The staged editor bundles in `bin/Win32/editor` and `bin/Win64/editor` remain intact. Both saved project ZIPs retained the SHA-256 values recorded before this development.

Official references: [structured output](https://ai.google.dev/gemini-api/docs/structured-output), [model and free-tier pricing](https://ai.google.dev/gemini-api/docs/pricing#gemini-3.5-flash-lite), and [billing](https://ai.google.dev/gemini-api/docs/billing).
