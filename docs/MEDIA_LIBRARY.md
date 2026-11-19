# Media library and PDF viewer

Last changed: 2026-10-29. Experimental M3 increment; enable `VITE_WEBSTUDIO_PROJECTS=true`.

Import individual files or folders in the Media tab. Files are copied into the browser's project-specific IndexedDB database; originals are not modified. Imports validate supported file types, reject unsafe SVG content, deduplicate by SHA-256 within the project, and report individual failures. ZIP import requires explicit opt-in. Imports can be cancelled. Search, filter and sort the library, rename displayed items with undo, or replace an item with one-level undo. Add media to a page or drag it onto the canvas.

Save downloads a project ZIP with a manifest and the project's media; Open validates it and restores a separate local project. Projects without media can still be saved as JSON. Browser download behavior governs the destination. Project duplication is disabled when the project contains media. Previous replacement versions are retained in the browser but are not included in project ZIPs.

Site export includes referenced media and a local PDF.js viewer with page navigation, zoom, text search, password prompting and download. Print opens the PDF in the browser. Website fonts and Tailwind still require network access; complete offline export is planned for M6. Browser IndexedDB is not a substitute for a saved project ZIP, and native atomic file saving remains future desktop work.

Validation included a browser import, save and reopen of 1,000 images and 100 PDFs; PDF preview/search and export viewer were exercised locally with external requests blocked. Complex PDF fonts, large files, accessibility, and all supported document variants require further testing before release.
