# Media library and PDF viewer

## Browse and add files

Open **View > Media library**, **Insert > Image, video or document**, or **Open media library** in the Media tab. Import a file or folder, search by name, and narrow the results by folder or type. Choose a thumbnail and **Add to page**. For images, click a section or panel to place the image; Escape cancels placement. Other supported types become their matching page blocks.

The grid pages through 36 assets at a time. A **Browse images** or **Browse files** button in Properties opens the same library for that field. **Choose file** updates the field instead of creating a new page object. Imported bytes remain in the project media store and travel with its ZIP. See the [illustrated reference](pdf/Delphi%20Web%20Studio%20Pro%20Editor%20Reference.pdf).

## Organize project files

Choose **View > Manage Media** or **Manage Media** on the Media tab. **New folder** creates a project folder, optionally within another folder. Import into the current folder, drag files onto a folder, or select files and choose **Move to folder**. **All media** displays the whole library. **Unfiled** displays files outside named folders.

Folder membership is project metadata. Moving a file keeps its asset ID, portable path and bytes, so existing images and PDF links keep working. An editable project ZIP preserves both empty folders and the folder assignment of each file. For placement or replacement from an existing field, use the separate Media library picker.

## PDF controls and earlier media validation notes


Last changed: 2026-11-01. The specified M3 mixed-media offline exit scenario has passed an automated browser check on the current editor. Project controls are enabled by default.

Select a PDF Viewer section to set its title, caption, starting page, height, fit mode, and whether page thumbnails, search, print, download, and fullscreen controls appear. Thumbnails can be selected to go to a page. Auto fits the width without enlarging the original; width fills the available width; page fits the whole page in the viewer. Fit enlargement is capped at four times the PDF's original size. Starting pages beyond the document are clamped to its last page. Hiding a download or print link does not protect a PDF on a public website: visitors can still retrieve the file. The print link opens the PDF in the browser for printing.

The optional accessibility label identifies the PDF viewer for screen-reader users without changing its visible title. Set **Mobile display** to **link** to show an open/download link instead of the embedded viewer below 480 pixels; tablet and desktop retain the viewer. This link remains available on phones even if the viewer's download button is hidden.

Import individual files or folders in the Media tab, or drop files and folders onto it from Explorer. Files are copied into the browser's project-specific IndexedDB database; originals are not modified. Before importing, choose whether matching files reuse the existing library item, are kept as separate copies, or are skipped. In the library-only import flow, reuse and skip both leave the existing item available; the result reports them separately. Matches use SHA-256 within the project. Imports validate supported file types, reject unsafe SVG content, and report individual failures. ZIP import requires explicit opt-in. Imports can be cancelled. Search, filter and sort the library, rename displayed items with undo, or replace an item with one-level undo. Add media to a page or drag it onto the canvas.

If you cancel an import, **Resume import** continues with the files that have not yet been processed, using the original import choices. Reopen the same project if you switch projects. The pending list is kept only while the app is open; closing the app discards the list, not the source files or already imported media. Starting another batch asks before discarding the pending list.

After importing an image, select a Hero, Image, Navbar or Footer block and use its image chooser in Properties to select an image from this project's Media library. For a Gallery or Image grid, add image items and choose a Media image for each item. Feature cards and Team members also offer image choosers for each item. Feature images appear in the alternating layout. URL fields remain available for external image addresses. Hero images are shown in the split Hero layout; other nested image fields do not yet have this chooser.

In a Content block, use **Insert a link to Media** to add a text link to an imported file, including a PDF. You can edit the link label in the Body text. The website ZIP includes the linked file; this text link opens the file, while a PDF Viewer block provides the local viewer controls.

To create a searchable list of files, add **Document library** from Components. In Properties, add document items and choose imported PDFs or other documents from Media. Edit each title and description as needed. Visitors can filter the list by title or description and download the files; searching does not examine document contents. The list and its local search work in the exported site without a server.

Navbar logos appear in the editor and exported site. Footer logos are used in the simple and multi-column layouts; the minimal footer does not display a logo. These logo layouts constrain very wide images to 96 CSS pixels so the site name retains room on narrow screens. Other image blocks can be used for larger artwork.

Duplicating a project also copies its media into the new project's library. Media references remain intact, and later changes to the copy do not change the original.

Undoing an image replacement restores its prior dimensions as well as its bytes and checksum. Older browser records that lack those dimensions are decoded when possible. If the media changes during undo, the operation stops instead of overwriting the newer replacement.

Save downloads a project ZIP with a manifest and the project's media. Open validates the package and reuses a local draft when the same saved version is already present. Projects without media can still be saved as JSON. Browser download behavior governs the destination. Previous replacement versions are retained in the browser but are not included in project ZIPs.

Before creating a project ZIP, Save verifies each stored file's size and SHA-256 checksum. Website export also verifies referenced media. If a file no longer matches its recorded metadata, the operation stops with an error so the file can be restored or replaced. Large media collections can take longer to save or export while they are checked.

Site export includes referenced media and a local PDF.js viewer with page navigation, zoom, text search, password prompting and download. Print opens the PDF in the browser. Exported styling is embedded and uses system font fallbacks. User-supplied remote media and optional analytics can still require network access; complete offline export remains unfinished. Keep a saved project ZIP in addition to the browser’s local media database. See [project files](PROJECT_FILES.md) for desktop save and recovery behavior.

The PDF preview and exported viewer initially fit pages to the available width without enlarging them. Zoom is expressed relative to that fit; zooming in can intentionally require horizontal scrolling. The exported viewer was checked at 375, 768 and 1440 pixels using the sample bulletin, including phone-width search and zoom. Individual PDFs and devices may still need additional testing.

Browsers commonly block PDF.js modules when a website is opened directly from a `file:` address. In that case, the exported page hides the nonfunctional embedded viewer and explains that a local web server is needed; if the PDF link is enabled, visitors can open or download the PDF directly. Serving the extracted site locally allows the bundled viewer to run without an internet connection. The Windows editor can serve a reviewed website ZIP over local HTTP through Export > Open reviewed site in browser.

Validation included a browser import, save and reopen of 1,000 images and 100 PDFs; PDF preview/search and export viewer were exercised locally with external requests blocked. Complex PDF fonts, large files, accessibility, and all supported document variants require further testing before release.

The current import workflow was also checked with a canceled and resumed batch of 1,000 small JPEG files and 100 copies of a two-page PDF. The saved project contained all 1,100 files and reopened with the last image and PDF available. The JPEGs were resized variants of one sample photo and the PDFs were identical; this does not establish performance for 1,000 distinct full-resolution photographs or 100 different large PDFs. A separate mixed-media check used two real images, a PDF and a text file, verified their exported bytes, and displayed the images and PDF with external requests blocked.

On 2026-11-01, the mixed-media check was repeated against the current editor: all four files survived save, reopen and local website ZIP export byte-for-byte, and the images and PDF displayed with external requests blocked. This verifies that sample, not every supported file or device.

Imported image paths inside feature items and gallery entries are resolved to temporary browser URLs for editor preview without changing the stored project paths. An isolated browser test imported a PNG, displayed it in an alternating feature and a gallery, and confirmed that both paths remained portable in the project model. Deeply nested extension data is not automatically resolved.

The editor PDF Viewer block now renders pages with the bundled PDF.js renderer, including previous/next navigation and download. An isolated WebView2 desktop test imported the sample PDF and rendered it both in the media preview and in a page block. The hidden test window took substantial time to finish rendering; interactive performance, other PDFs and device sizes still require testing. The exported site retains its separate, fuller PDF viewer.

An isolated Edge editor test imported a generated two-page PDF, checked the page canvas fits the Mobile, Tablet and Desktop preview areas without horizontal overflow, navigated forward and back, and repeated responsive preview changes. This covers one simple two-page file in the browser editor; WebView2 performance and other PDF variants still need testing.

Media rename and undo-rename now read and update each current record within the same database transaction, so a concurrent replacement is not overwritten by a stale rename snapshot. Replacement checks that the original media record has not changed before writing; if it has, replacement stops and asks for another attempt. Automated tests exercise overlapping rename and replacement operations. This reduces a demonstrated race but does not establish complete crash recovery or cross-device synchronization.

Concurrent imports now check for matching media and add a new record in the same database transaction. An isolated Edge test imported eight identical files concurrently and retained one record; restored project packages still retain distinct asset IDs when their bytes match.

Before undoing a media replacement, the editor verifies the saved previous version's size and SHA-256 checksum. If the previous bytes are corrupt, undo stops and keeps the current file and previous record for inspection. Large files can take longer to verify.

The editor's PDF Viewer block has zoom controls from 50% to 300% of its fitted page width. Enlarging a page can require horizontal scrolling; the starting fit remains responsive. An isolated Edge test exercised zoom in, zoom out, repeated zoom changes, two-page navigation and the Mobile, Tablet and Desktop preview sizes. An isolated hidden desktop test also imported the sample PDF, clicked zoom in and observed the enlarged rendered canvas. One earlier run timed out while rendering; hidden-window timing was inconsistent, so interactive desktop performance still needs further testing.

The PDF block now clears its render status when page, zoom or viewport width changes and uses a fresh canvas for each rendering target, avoiding stale completion indicators and reuse of a canvas whose earlier rendering was cancelled. The isolated browser test passed repeated zoom, page and viewport changes. A hidden desktop WebView timed out while waiting for rendering; explicitly activating the test WebView controller produced two successful PDF import/render/zoom runs. This suggests test-window visibility affects timing, but visible interactive performance still needs its own evaluation.

The editor PDF Viewer block also searches extracted PDF text, reports the first matching page, and supports Enter to search. Scanned pages without searchable text cannot be found this way. An isolated browser test found text on page two, handled a missing term, exercised Enter and checked the phone-width control. A separate isolated desktop test found sample text on page one after importing the PDF. Searches are local to the open document; highlight-all and full accessibility testing remain open.

## Gallery export performance

Website ZIP export can generate smaller WebP copies for large local JPEG, PNG, and WebP gallery images. The gallery grid loads those copies as visitors scroll, while the enlarged viewer uses the original. Source photos and saved projects retain their original bytes. Export falls back to the original for small images or if the browser cannot create a smaller copy.

## Moving a gallery photo to a numbered position

Gallery photos show small position numbers while editing. Right-click a photo and choose **Properties** to open its own settings. Enter its destination in **Position**, then press **Enter** or click **Move**. For example, moving photo 49 to position 10 inserts it there and shifts photos 10–48 one place later; it does not swap or replace their images. The selected photo's settings follow it to its new position.

Positions run from 1 through the gallery's photo count. Drag-and-drop and the existing arrow controls remain available. Reordering keeps the photo's caption and media reference together, can be undone, and is retained when the project is saved. Position labels are editing aids and do not appear in Preview or the exported website. This works for existing and new galleries without changing their saved format.
