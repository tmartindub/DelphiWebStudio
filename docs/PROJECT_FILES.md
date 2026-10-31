# Experimental portable project files — M1 first increment

Last changed: 2026-10-29. Tracking: issue #2. This is the first M1 PR, not completion of M1 or a released desktop application.

## Enable and use

Set `VITE_WEBSTUDIO_PROJECTS=true` before starting Vite or building. The flag defaults off in `.env.example`. With it enabled, **Open project** appears on Dashboard and the editor; **Save project** appears while a project is open. These commands are separate from the existing HTML Export command and from Publish.

Open accepts unversioned OpenPage SiteConfig JSON or WebStudio schema 2. Each open creates an independent local draft and never edits the selected file. A legacy file is upgraded in memory and saved as a new `.webstudio.json` download. The original is the recovery source; no automatic in-place migration occurs. Repeated opens retain the document projectId but have distinct local draft IDs. Duplicate assigns a new document identity.

Media from a project ZIP is staged before its new draft appears in the project list. If an import fails, the app attempts to remove the media it staged and leaves the selected project unchanged. If the app is interrupted during import, staged media may remain in local storage without a visible draft; the original project ZIP remains available to open again. This is not a complete crash-recovery system. An isolated browser round trip opened, saved and reopened a five-page project containing a PDF, then exported it with the PDF and links intact.

If the current project or its content changes while a project file is opening, the import is stopped before switching projects. The current edit remains in the editor; save it and open the other file again. An isolated browser test paused a two-asset import, edited the current page, and verified the edit remained while staged media was removed.

Use the pencil button on a dashboard project card to rename the project. Saving includes that project name, so reopening the file retains it. The website's own name remains separate. Older files without a project name continue to open using their site name. An isolated browser test renamed the five-page sample, saved and reopened it, and checked both names.

After confirming removal of a dashboard project, use **Undo** in the notification within 15 seconds to restore its project entry and existing media references. An isolated browser test restored a five-page project and its PDF. This undo is temporary and does not replace a separate project file; the current implementation leaves the removed project's media in local storage.

Suggested project and website download filenames avoid Windows reserved device names and fall back to `site` if the name cannot supply a usable filename. This changes the suggested filename only; the project and website names remain unchanged. An isolated browser check covered reserved names, punctuation-only names and non-Latin names.

Save validates a snapshot and starts a JSON download. Browser download settings determine the final location and collision filename. The message says a download was requested and asks the user to choose a destination if prompted; it does not claim an atomic filesystem write or confirmed disk durability. Existing browser draft autosave remains available. Native atomic saves and recovery are later work.

While the editor is open, changes are written to the browser draft as the editor state changes, without waiting for a later screen refresh. Browser storage can still be cleared or fail, so use **Save project** to keep a separate portable copy.

The History panel shows the current session's undo steps, not a durable revision archive. Opening a project or closing the app clears those steps; save separate project files to retain earlier versions. History entries can be activated with the keyboard. A browser test checked the notice and keyboard restoration of a page edit.

An isolated browser test opened a five-page project with a PDF, edited News, closed the test browser normally, restarted it with the same isolated profile, and reopened the draft. The edit and original PDF bytes remained available in a subsequent project ZIP. This checks a clean browser restart, not a crash, power loss, disk failure, cleared storage or the desktop native-save workflow.

If writing local draft storage fails, the editor keeps the current in-memory edits and displays a persistent warning to save a separate project file before closing. A browser test simulated storage quota failures and confirmed that a subsequent separate project download contained the current edit. A restart before saving can still lose changes; this is not crash recovery.

If a local draft cannot be read, contains malformed JSON, has an incompatible basic structure, or uses a newer storage version, the editor warns on startup and prevents writes to the affected stored draft for that session. Save any new work separately before restarting to retry. Isolated browser tests simulated inaccessible and incompatible storage, confirmed the original stored values were unchanged, and requested a separate project download. This does not repair corrupted data or detect every possible invalid storage structure.

The basic checks also reject malformed project entries, missing project identities or names, and duplicate local project IDs. Automated storage tests verify that the original stored text is not overwritten in these cases; the checks do not validate every field in a draft.

For version 2 editor drafts, the startup checks also protect the stored text when the site name, block list or basic page structure is malformed. An automated test confirms that a legacy single-page draft still migrates. These checks do not repair the stored draft or validate every block field.

Save downloads the snapshot captured when the command starts. If the project changes while that snapshot is prepared, newer edits stay in the browser draft and a notice asks you to save again to include them.

## Format and preservation

```json
{"format":"webstudio","schemaVersion":2,"projectId":"stable-id","config":{"name":"My site","pages":[{"id":"home","name":"Home","path":"/","blocks":[]}],"blocks":[]}}
```

Unknown document/config/page/block fields and block types are retained through file parsing and serialization. The editor shows an unknown block as its existing placeholder. Empty pages remain intact. Top-level compatibility blocks are normalized to Home; when they match another existing page, that page's content is already retained. If they conflict with every page, import/save rejects the document rather than guessing which content to discard.

Validation rejects duplicate page/block IDs, duplicate paths (including case collisions), traversal/encoded/nonportable Windows paths, missing Home, malformed blocks, prototype-polluting keys, active/privileged URL protocols, invalid known theme values, non-JSON editor values and unsupported format versions. Invalid input is reported before opening a replacement project. Validation does not execute scripts, access files, contact AI or publish.

Current files cover SiteConfig content/theme, non-secret site settings and extension data. Deployment credentials are excluded from saves and rejected in imported files. Assets are not yet integrated. Existing IDs are preserved; newly added pages and duplicated blocks use UUIDs. Page changes and the active-page selection participate in undo/redo.

With the feature enabled, Export produces a ZIP containing a separate HTML file for every page and relative page navigation. Unknown block types cause a clear error rather than being silently omitted. The output currently relies on online fonts and Tailwind; fully self-contained export remains later work. Publishing is disabled in this mode until destination review and verification are implemented.

## Evidence

- Fixture: `samples/five-page.webstudio.json`, SHA-256 `86E4C4A1E1525B3CAED07BB3EE07D7B4C3F684038E683ED05993E7714C79675D`.
- Actual browser Open -> News edit -> Save -> Open downloaded file retained all five pages, edited News text, empty Documents page and original projectId. Home compatibility blocks remained Home after a non-Home edit.
- Traversal-path input was rejected while the current Documents page remained intact.
- A future-chart block opened as a placeholder and survived Save with pluginVersion=7, its series and an unknown root pluginState field intact.
- All 35 automated tests pass (27 new and eight inherited), covering migration/roundtrip/malformed inputs, independent local imports, duplicate identity and targeted storage updates. Lint, TypeScript and the feature-enabled production build pass; CI also builds the default mode.
- Screenshot: `docs/m1-project-roundtrip.png`.
- M1 pre-change tracked-source ZIP: `H:\Delphi Web Studio Backups\WebStudio_M1_PreChange_89f6a6d.zip`, 397,371 bytes.

Native safe save/recovery and portable assets remain outstanding. Existing footer/navbar links are not yet bound to page IDs. The feature gate remains experimental until the complete acceptance tests pass.

## Five-page project and media round trip

An isolated browser test opened the five-page sample, imported the sample bulletin PDF, edited News to link to About and the PDF, saved a project ZIP and reopened it as a separate copy. It then exported a website ZIP and verified all five HTML files, the edited text, the rewritten About link, the PDF link, and the original PDF bytes in both ZIPs. This is one browser workflow, not proof of native atomic saving, recovery or all page and asset combinations. The test did not publish a website.

## Native create-only save increment

`desktop/project/WebStudio.ProjectSave.pas` can write a caller-supplied byte snapshot to a uniquely named temporary file beside a new target, flush it, and move it into place without a replace flag. It rejects relative paths and does not overwrite an existing target. The caller must choose the destination and validate the snapshot; this unit is not connected to the editor or a file dialog. It does not implement Save over an existing project, crash recovery, conflict detection, a transactional multi-file project, or protection against a hostile process changing the destination directory.

The same unit can flush an existing staged file and move it to a new filename in the same folder without a replace flag. If the target exists, the staged file remains available and the target is unchanged. An isolated Win64 test checked the successful move, an existing target, a locked stage and a different destination folder. The caller must own and validate the staged file and its directory. This operation is not connected to the editor, cannot replace an existing project, and does not establish complete crash recovery or protect against another process changing the staged file between operations.

The Win64 `tests/native/ProjectSaveSmoke.dpr` test compiled and ran with RAD Studio 37.0. It checked a multi-chunk file, an empty file, failure to overwrite an existing file, relative and missing-directory rejection, and temporary-file cleanup. The implementation relies on Windows file APIs; see Microsoft's [MoveFileEx documentation](https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-movefileexw) for platform semantics. This is an initial native storage increment, not a completed save or recovery workflow.

`desktop/project/WebStudio.ProjectOpen.pas` adds a read-only operation for a native-caller-selected absolute drive path. The caller sets a maximum byte count before allocation, and the read denies concurrent write access while the file is open. The native smoke test checks a multi-chunk round trip, empty input, size limits, relative-path rejection and an exclusively locked file. The operation does not parse or validate projects, resolve hostile filesystem paths, show a dialog or connect to the editor; those remain the host's responsibility.

`SaveProjectRecoveryZip` can create a new ZIP containing the current bytes of a caller-selected project file before a change. The caller chooses an absolute ZIP path and a source-size limit; an existing recovery ZIP is never intentionally overwritten. Before writing, the operation opens the generated ZIP and checks its entry name and extracted bytes. After writing, it reads back the ZIP and checks that the source still matches the snapshot; if verification fails, it reports the error and leaves any created ZIP for inspection. A Win64 isolated test verified archived bytes for ordinary, empty, Unicode-named and ZIP sources, unchanged source, rejection of an existing ZIP, size limits and a locked source. The operation holds multiple copies of the project and ZIP in memory, is not connected to the editor, and does not perform a save, prevent later concurrent changes, or prove crash recovery. The caller must decide when and where to create a recovery snapshot and handle failures before changing the project.

`RestoreProjectRecoveryZip` reads one recovery entry within caller-supplied archive and project size limits, checks the entry name, CRC and consistency of the local and central ZIP headers, and writes its bytes to a new caller-selected file without replacing an existing file. It reads the result back for comparison and leaves a created file for inspection if that check fails. An isolated Win64 test restored ordinary, empty, Unicode-named and ZIP projects and rejected existing destinations, size-limit violations, malformed or multi-entry archives, traversal names, mismatched headers and a corrupted CRC. The caller must validate the restored project before opening it. This operation is not connected to the editor, holds archive and project bytes in memory, and is not a complete hostile-archive security audit or crash-recovery workflow.

## M3 update

Projects with imported media now save as `.webstudio.zip` files, containing the manifest and media; projects without media save as JSON. Opening a ZIP validates and restores its media into a separate browser project. See MEDIA_LIBRARY.md for details and limitations. The earlier statement that assets are not integrated describes M1 only.

## M6 export styling increment

New exports embed generated Tailwind styles and use installed system font fallbacks, rather than loading Tailwind and Google Fonts. Theme colors are retained. Sites can still request external resources explicitly supplied by the user, including image URLs, favicon, Open Graph images and optional analytics. Those references are not copied or converted. Complete self-contained export, SEO checks, and secure publishing remain unfinished.

## Page addresses

Page addresses can be changed with the link icon beside the active page. Home stays at `/`; other paths are validated and the change can be undone. The dialog offers to update Content text links and known Hero, CTA, Banner and Navbar button links in the same undoable change. External bookmarks and links in other content are not rewritten, so check them after changing an address.

Page renames require a nonempty name. Invalid or unchanged rename requests leave the project and undo history unchanged; a valid rename can be undone and redone.

Use the magnifying glass beside the active page to set its search title and description. The exported page uses these for HTML and sharing metadata; blank fields fall back to the site-wide settings. These edits are saved with the project and can be undone.

If a public site URL is configured in Settings, ZIP export also writes canonical and sharing URLs for each page using that address and its subfolder. Enter the final address carefully; the app does not verify or publish the website.

## Media integrity check

Before opening or saving, known block media IDs and local `assets/` paths are checked against the project media list, including references inside nested items. Missing or mismatched media and duplicate IDs or case-colliding paths produce an error rather than a portable file with silently broken references. An unsuccessful open leaves the current project selected; an unsuccessful save leaves the editing state intact. Unknown block types are preserved and their plugin-specific references are not interpreted. Restoring missing files and native crash-safe saving remain future work.

When a project ZIP is reopened and saved, unrecognized metadata on retained media entries is preserved by media ID while current names, paths, checksums and other known fields are updated. An isolated browser test verified an additional nested metadata field and the original PDF bytes survived a ZIP round trip. Unknown metadata is preserved without interpreting it and may need review after replacing a file.

## Page links in ZIP exports

When a button or link uses an exact project page path such as `/about`, website ZIP export rewrites it to the correct relative HTML file for the page it appears on. Query strings and fragment identifiers are preserved. Links to unknown paths and external sites are unchanged; full broken-link checks remain unfinished. An isolated browser test followed a button from a nested page to another page and then Home while the site was served under a subdirectory.

For Hero, CTA and Banner links, the Properties panel also offers **Choose a site page** below the URL field. Selecting a page fills in its path; the URL field remains editable for external addresses or anchors. Draft articles are omitted from the chooser. The chooser does not yet cover the separate legacy Navbar block, arbitrary links inside content, or automatically update references when a page is removed.

Before deleting a page, the editor lists other pages with Content text links or Hero, CTA, Banner or Navbar button links that point to it. Deletion is explicitly confirmed and can be undone; it does not automatically remove those links. Links in other block types or custom content are not checked, so this is not a complete broken-link audit.

**Check site** runs local checks for project media references, Content text links, known Hero, CTA, Banner and Navbar button destinations, missing media or image descriptions, and unconfigured Contact or Newsletter forms. Select **Open this block** to go to a finding. A missing media reference is shown separately. Unknown root-relative paths are flagged for review because they might instead name a separate hosted file. The media check compares known IDs and paths; it does not verify media bytes. External links, in-page anchors, custom content, visual layout and overall accessibility are not verified. A clean result is not a certification; inspect the exported site separately.

In Preview mode, links to existing site pages switch the visible page without leaving the editor. Other links are not followed there; use the exported website to test external addresses and anchors. In editing mode, clicking a link selects its block instead of navigating away. The split Hero preview also shows its configured image when available.

New Footer blocks start without prefilled legal links or copyright claims. The multi-column layout uses the description and columns actually present in the project instead of generating product or legal placeholder content. Existing saved values are preserved; projects that previously relied on generated placeholder columns will no longer display those placeholders unless the content was explicitly saved.

New Navbar blocks start without placeholder links or a call-to-action label. Existing labels remain intact. Legacy Navbar text labels remain text-only. To add working links, select the Navbar, choose Navigation destinations in Properties, and add a label and URL for each link (for example, /about). Use the page selector to choose an existing non-draft page, or type an external address. These links appear on desktop and in a scrollable mobile menu; the separate site-page navigation also remains available. A browser check exercised a 25-link menu on a phone-sized viewport and checked desktop link boundaries. The centered Navbar layout and its logo appear in both the editor and export.

ZIP export checks page filenames against already packaged files and folders, including case-insensitive collisions and file/folder conflicts. If a page would overwrite a bundled PDF viewer file, export stops and identifies the conflicting page; the project remains open. Rename that page path before retrying.

## Optional sitemap

In Settings → SEO, set **Public site URL** only when the destination is known, including any subfolder (for example, `https://example.com/site/`). ZIP export then includes `sitemap.xml` listing each exported HTML page at that address. The address must be absolute HTTP or HTTPS and must not contain credentials, a query or a fragment. Leave it blank to omit the sitemap. Opening or exporting a project does not publish or submit the sitemap.

No `robots.txt` is created: search engines expect it at the host root, which may be outside a subfolder deployment. Sitemap submission and search indexing remain the site owner's responsibility; see [Google's sitemap guidance](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap) and [robots.txt location rules](https://developers.google.com/crawling/docs/robots-txt/create-robots-txt). SEO and accessibility audits remain incomplete.

## Contact email option

A Contact block can be configured with **Contact Email** in Properties. The exported form checks required name, email and message fields, then opens the visitor's configured email application with a draft. The visitor must send that draft; WebStudio does not receive or send the message. The address appears in the exported site. This option requires JavaScript and a working mail handler, and it does not guarantee delivery. The editor preview never launches the mail application. Forms without a valid contact address remain disabled; newsletter signup is still unconfigured. Hosted form backends remain future work.

## Optional site search

In Settings → General, set **Site search** to **Include in website ZIP** to add a Search link and a local search page. Search uses an index embedded in the exported page; it does not send queries to a search service. It searches page names and common text fields such as headings, descriptions, captions, questions and answers. It does not extract text from PDFs or search every possible block or plugin field. The index is part of the public website export and should contain only content intended for publication. A page path that would overwrite `search.html` is rejected. The Search link in the editor is a preview; use the exported website to run a search.

An isolated browser test saved and reopened the setting, searched a nested page, followed the result under a subfolder, and blocked external requests. Full CMS and document-text search remain future work.

Article pages use optional `webstudioArticle` metadata on ordinary pages. Drafts stay in project saves but are omitted from website exports and generated search/sitemaps; see ARTICLE_PAGES.md for operation and limitations.

For Hero, CTA, Banner and Navbar buttons rendered by the HTML exporter, unsupported link schemes, protocol-relative URLs, backslashes and control characters are exported as text rather than active links. **Check site** reports destinations it can inspect; project validation may reject some invalid URLs earlier. This check does not cover every URL field or plugin and is not a complete security audit.

In the current experimental Delphi desktop shell source, Save project and Export prompt for a destination using a Windows Save dialog. Project downloads with the standard `.webstudio.json` or `.webstudio.zip` suggested name are written to a staged file beside the selected destination, flushed and moved to a new destination without replacing an existing file. Choose a new filename for each project save. If finalization fails or the download is interrupted, the status line reports the staged path to check; it may contain partial data. Website exports continue to use the ordinary download flow. An isolated legacy-dialog test checked project save, an existing-file collision, a later retry, and an interrupted project download. The modern dialog, application shutdown during finalization, recovery interface and clean-machine behavior remain open. Older staged previews may still use direct downloads.

In another isolated test, a file appeared at the selected destination while a staged download was in progress. Finalization left that file unchanged and retained the staged bytes for inspection. The test used synthetic data and does not cover every filesystem or process race.

The shell also checks that a project destination keeps the format's `.json` or `.zip` extension, so a ZIP is not saved under a JSON name or vice versa. An isolated legacy-dialog test rejected both mismatches and then completed a correctly named save. This safeguard is in the current source; older previews may not include it.

The current shell source offers **Recover staged file...** in the top bar. Select a `.webstudio-download-*.tmp` file from the project save folder, then choose a new filename in that same folder. The shell recognizes the initial bytes as JSON or ZIP and moves the staged file without replacing an existing destination. A staged file can be incomplete: open the recovered project to validate it and keep other project copies. Cancellation, an unrecognized file, a wrong extension or an existing destination leaves the staged file in place. Isolated Win64 tests exercised these cases and JSON/ZIP recovery using legacy dialogs; they do not establish complete crash recovery or validate every project or archive. Older previews do not have this button.

In an isolated test, closing the shell during an active staged project download left a separate last-good project unchanged, but no staged file remained. Recovery cannot restore a file that WebView2 has removed. If no staged file remains, reopen the local draft if available or use an earlier saved project. This controlled shutdown test is not a power-loss test and does not establish that recent edits always survive.

The current shell source warns on the first attempt to close while a project download is active or a save dialog is pending. Wait for the status line to report the outcome, or close a second time to interrupt it. Isolated Win64 tests checked the warning, the deliberate second close and normal closing after a completed save. This does not prevent forced termination, power loss or interruption while the browser is still preparing a download; older previews do not include the warning.

An isolated test also forcibly terminated its own test process during an active staged project download. A separate last-good test project remained unchanged, but no staged file was observed afterward. This was one forced-process termination, not a power-loss test; it did not establish whether recent editor changes survived in local draft storage.

In a follow-up isolated forced-termination test, the editor first wrote a changed headline to its local draft, then its test process was terminated during a staged download. A new test shell using the same isolated profile reopened the draft and displayed that headline. This covers one edit after it reached local storage; it does not establish survival of unsaved edits, media writes, cleared storage, all shutdown timings or power loss.

An isolated test recovered both JSON and ZIP copies of the five-page sample, reopened each in the editor, and verified that the website export contained all five pages. This test did not simulate a power failure or recover a damaged media archive.

A separate isolated test recovered a five-page project ZIP containing the sample PDF, reopened it, and exported all five pages with an edited page link and the original PDF bytes intact. The native recovery test used legacy dialogs and a completed staged file; it did not simulate a power failure or establish that an interrupted download is complete.

The desktop status line reports when WebView2 marks a selected download complete or interrupted, including the filename. An isolated legacy-dialog test exercised completed project and website downloads, cancellation, a repeated save and an interrupted download. A completion report is WebView2's outcome, not a guarantee of crash-safe disk durability. Modern-dialog and broader failure testing remain open.

Opening a project rejects a JSON file or ZIP manifest larger than 100 MiB before reading its contents. Saving also stops before downloading a manifest above that limit so the application does not produce a project it cannot reopen. The ZIP may be larger when it contains media. This limit helps prevent excessive manifest allocation; it is not a complete defense against every oversized or malformed archive.

An isolated browser check rejected an oversized JSON file and a ZIP whose manifest metadata claimed more than 100 MiB, then opened the five-page sample in the same session. Another browser check simulated an oversized serialized manifest, verified that no download was started, then restored the normal size and saved the sample. This does not test every archive or complete native save and recovery.
