# Gemini selected-text assistance

Last changed: 2026-11-18. This selected-text workflow is included in version 1.0.0 build 1. It began as Stage 1 local development on November 16; that milestone's validation is retained below as a dated record. The current release also includes page/section creation and changes to existing components; see [Gemini assistant](GEMINI_ASSISTANT.md). A request or preview does not change a saved project file, and Apply changes the selected wording through normal editor history until you save it.

## Using the assistant

The application uses Google Gemini, Google's online artificial intelligence service, to suggest changes to selected wording. A model is the software that produces a suggestion from the passage and your request. You review that suggestion before the editor changes the text.

Google AI Studio is Google's website for managing Gemini access. Its API key is a secret access credential tied to a Google project, which controls service usage and billing separately from your website project. Free tier is Google's service allowance for an eligible project. This feature requires a project with billing disabled.

Save a Google Gemini key in the application's Settings first. In the editor, enter a text box, highlight the passage to change, and right-click. Choose **Help with selected text…**. The same command is available in Text settings. A collapsed caret does not authorize rewriting an entire box: select the words first.

Choose Grammar, Warmer tone, Professional tone or Shorten, or write an instruction. Confirm that the key belongs to a **Free tier** Google AI Studio project with no billing account attached, and that the selected text and instruction may be sent to Google. These choices are remembered only for the running editor session. Google says free-tier content may be used to improve its products; avoid confidential passages.

**Preview** requests proposed wording and displays it beside the original. It does not change the page. **Apply** replaces only the selected passage, retaining its existing formatting runs, paragraph structure and links. Review facts before applying. **Undo** restores the original; the normal editor Undo/Redo history also contains the operation as **Gemini: edit selected text**. Cancel, closing the window or Escape leaves an unapplied preview unchanged. Stop cancels an in-progress request. An applied change remains applied when closing the window unless Undo is chosen.

## Free-tier boundary

The assistant uses `gemini-3.5-flash-lite`, listed by Google with free-tier text input/output when reviewed on 2026-11-16. It makes one standard generation request, with no tools, search grounding, automatic retries, alternate models, server fallback or template fallback. Quota failures are reported without attempting a paid service.

The Gemini API does not expose a request switch that forces an arbitrary key to be billed as Free tier. The **key's Google project must have billing disabled**. The app cannot verify account billing from a key, change that setting, or guarantee that Google will retain current free allowances. Check the Billing Tier column at https://aistudio.google.com/projects. Do not attach billing to the project used for this feature.

## Implementation and limits

`src/blocks/RichText.tsx` captures the selection after flushing pending typing to the normal project state. It retains a local clone of the selected DOM fragment, the browser's structured representation of that passage, and maps text nodes to stable request segment ids. Only text segments and the instruction cross the network; no project manifest, other page, media file, file path or formatting HTML is sent. Returned segment count, order, ids and sizes are validated. Replacement text is assigned to text nodes, never parsed as HTML or executed.

The original field and DOM are checked again before Apply to reject stale selections. Apply uses the normal config store and undo stack; it does not save a file, export, publish, navigate or modify unrelated fields. Existing shared-section semantics still apply when the edited block is intentionally shared across pages. AI requests and previews are temporary memory, not project data.

Limits: one text box, 12,000 selected characters, 128 formatting segments, 1,500 instruction characters, 24,000 returned characters and a 90-second request timeout. More complex formatting benefits from smaller selections. The model is instructed to preserve factual content, but this is not an independent factual verification service. A longer passage may increase its text box height through the editor's existing auto-growth behavior. Use the separate AI assistant for current page/section creation and supported changes to existing components. Autonomous site or computer operation is outside the assistant's scope.

Sources: https://ai.google.dev/gemini-api/docs/pricing#gemini-3.5-flash-lite and https://ai.google.dev/gemini-api/docs/billing.

## Validation — 2026-11-16

The complete pre-change fallback ZIP is `H:\Delphi Web Studio Backups\DelphiWebStudioPro-v1.0-working-version-complete-pre-Gemini-stage1-20261116-230130-UTC.zip`. It contains all 13,300 project files (including dependencies, saved projects, executables and Git history), is 1,062,962,196 bytes, passed ZIP CRC verification, and has SHA-256 `260365a247e903f184298c4071e3b4a20bbc787689e9b73819119a6d112b72b5`.

TypeScript, the production build and lint for the changed TypeScript files passed. The regression suite passed **398 tests**; two existing integration tests were skipped. Both final desktop applications were rebuilt in `bin\Win32` and `bin\Win64`.

The production UI in both desktop architectures passed isolated tests for Preview, Cancel, Escape, Apply, exact Undo, Ctrl+Z/Ctrl+Y, single-word selections, paragraph boundaries, stale-preview rejection, retention of font/color/links/paragraph appearance, pending typing in independent text boxes, Stop and HTTP 429 quota errors without retry. Credential replies and Gemini responses were simulated within the disposable test pages; no synthetic credential was written to Windows. The test profiles are separate from the user's normal WebView storage. Screenshots and compact results are under the ignored `test-results/gemini-text` folder; disposable profiles are removed after testing.

**Live Gemini validation passed in both desktop builds on 2026-11-16.** Each compiled application read the real saved Windows credential and made one request to `gemini-3.5-flash-lite` using only a synthetic selected passage and a spelling-correction instruction. Gemini returned the corrected wording, Preview left the document unchanged, Apply changed the selection, and Undo restored the exact original rich text. Both runs also passed the nine simulated-request interaction checks, with no page runtime errors. No user project text, media or key contents were logged or included in test results. The owner confirmed that the key's Google project is Free tier with billing disabled; the application does not independently verify billing status. These checks verify connectivity and the selected-text workflow, not the factual accuracy or quality of every future response. The test runner uses `WEBSTUDIO_LIVE_GEMINI=1` for this explicitly authorized live check. Both disposable test applications were closed and their profiles removed.

The saved projects were preserved: `ICCTest - Weekly Bulletin.zip` remained SHA-256 `83EF2B4720C2B70F1FB056946CD05BF435832714494F1DD49E05A43F07DECBB6`; `ICCTest.zip` remained `BF8678E6EF9D6826095864844D5426C29ED1BD59C9FCA27F7F85B0DBFD23245B`. No website was published and no GitHub push was made during that November 16 milestone. Its temporary no-push instruction has since been superseded by authorization for the v1.0 application release.
