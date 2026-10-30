# Media library and PDF viewer

Last changed: 2026-10-29. Experimental M3 increment; enable `VITE_WEBSTUDIO_PROJECTS=true`.

Import individual files or folders in the Media tab. Files are copied into the browser's project-specific IndexedDB database; originals are not modified. Imports validate supported file types, reject unsafe SVG content, deduplicate by SHA-256 within the project, and report individual failures. ZIP import requires explicit opt-in. Imports can be cancelled. Search, filter and sort the library, rename displayed items with undo, or replace an item with one-level undo. Add media to a page or drag it onto the canvas.

After importing an image, select a Hero, Image, Navbar or Footer block and use its image chooser in Properties to select an image from this project's Media library. For a Gallery or Image grid, add image items and choose a Media image for each item. Feature cards and Team members also offer image choosers for each item. Feature images appear in the alternating layout. URL fields remain available for external image addresses. Hero images are shown in the split Hero layout; other nested image fields do not yet have this chooser.

In a Content block, use **Insert a link to Media** to add a text link to an imported file, including a PDF. You can edit the link label in the Body text. The website ZIP includes the linked file; this text link opens the file, while a PDF Viewer block provides the local viewer controls.

Navbar logos appear in the editor and exported site. Footer logos are used in the simple and multi-column layouts; the minimal footer does not display a logo. These logo layouts constrain very wide images to 96 CSS pixels so the site name retains room on narrow screens. Other image blocks can be used for larger artwork.

Duplicating a project also copies its media into the new project's library. Media references remain intact, and later changes to the copy do not change the original.

Undoing an image replacement restores its prior dimensions as well as its bytes and checksum. Older browser records that lack those dimensions are decoded when possible. If the media changes during undo, the operation stops instead of overwriting the newer replacement.

Save downloads a project ZIP with a manifest and the project's media; Open validates it and restores a separate local project. Projects without media can still be saved as JSON. Browser download behavior governs the destination. Previous replacement versions are retained in the browser but are not included in project ZIPs.

Before creating a project ZIP, Save verifies each stored file's size and SHA-256 checksum. Website export also verifies referenced media. If a file no longer matches its recorded metadata, the operation stops with an error so the file can be restored or replaced. Large media collections can take longer to save or export while they are checked.

Site export includes referenced media and a local PDF.js viewer with page navigation, zoom, text search, password prompting and download. Print opens the PDF in the browser. Exported styling is embedded and uses system font fallbacks. User-supplied remote media and optional analytics can still require network access; complete offline export remains unfinished. Browser IndexedDB is not a substitute for a saved project ZIP, and native atomic file saving remains future desktop work.

The PDF preview and exported viewer initially fit pages to the available width without enlarging them. Zoom is expressed relative to that fit; zooming in can intentionally require horizontal scrolling. The exported viewer was checked at 375, 768 and 1440 pixels using the sample bulletin, including phone-width search and zoom. Individual PDFs and devices may still need additional testing.

Validation included a browser import, save and reopen of 1,000 images and 100 PDFs; PDF preview/search and export viewer were exercised locally with external requests blocked. Complex PDF fonts, large files, accessibility, and all supported document variants require further testing before release.

Imported image paths inside feature items and gallery entries are resolved to temporary browser URLs for editor preview without changing the stored project paths. An isolated browser test imported a PNG, displayed it in an alternating feature and a gallery, and confirmed that both paths remained portable in the project model. Deeply nested extension data is not automatically resolved.

The editor PDF Viewer block now renders pages with the bundled PDF.js renderer, including previous/next navigation and download. An isolated WebView2 desktop test imported the sample PDF and rendered it both in the media preview and in a page block. The hidden test window took substantial time to finish rendering; interactive performance, other PDFs and device sizes still require testing. The exported site retains its separate, fuller PDF viewer.

An isolated Edge editor test imported a generated two-page PDF, checked the page canvas fits the Mobile, Tablet and Desktop preview areas without horizontal overflow, navigated forward and back, and repeated responsive preview changes. This covers one simple two-page file in the browser editor; WebView2 performance and other PDF variants still need testing.

Media rename and undo-rename now read and update each current record within the same database transaction, so a concurrent replacement is not overwritten by a stale rename snapshot. Replacement checks that the original media record has not changed before writing; if it has, replacement stops and asks for another attempt. Automated tests exercise overlapping rename and replacement operations. This reduces a demonstrated race but does not establish complete crash recovery or cross-device synchronization.

Concurrent imports now check for matching media and add a new record in the same database transaction. An isolated Edge test imported eight identical files concurrently and retained one record; restored project packages still retain distinct asset IDs when their bytes match.

Before undoing a media replacement, the editor verifies the saved previous version's size and SHA-256 checksum. If the previous bytes are corrupt, undo stops and keeps the current file and previous record for inspection. Large files can take longer to verify.

The editor's PDF Viewer block has zoom controls from 50% to 300% of its fitted page width. Enlarging a page can require horizontal scrolling; the starting fit remains responsive. An isolated Edge test exercised zoom in, zoom out, repeated zoom changes, two-page navigation and the Mobile, Tablet and Desktop preview sizes. A separate desktop test confirmed the sample PDF still imports and renders with the updated editor; zoom controls have not yet been independently exercised in that desktop test.
