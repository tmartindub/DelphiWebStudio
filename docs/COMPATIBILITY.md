# Compatibility contract

Reviewed November 15, 2026 for version 1.0.0 build 1.

The Windows desktop editions are a 32-bit application (Win32) and a 64-bit application (Win64). They target Windows 10/11 and use Microsoft Edge WebView2 Runtime, the browser engine that displays the editor inside its Windows window. The release checks exercised both architectures on Windows x64; clean-machine installation is a separate acceptance step. Native forms remain editable in RAD Studio 37.0, the Delphi development environment. React is the interface library used for the visual editing canvas; that canvas is the owner-approved runtime interface.

Portable projects preserve the existing pages model, legacy one-page JSON and supported unknown data. JSON is the structured text format used to describe project content and layout. Asset identity is independent of media folders. Gallery normalization gives old and newly added photos the same identity-based editing commands; supported loose gallery photos are absorbed without duplicating the rendered entry, while panel children keep their parent. Save/open/Preview do not publish.

Complete website export produces independent pages in HTML, the format describing webpage structure, together with referenced assets. No build server is needed on the destination. Keep the generated structure intact and review root and nested hosting paths. External links, media, forms, translation services or user custom code can still need network access. Optional AI and service-backed endpoints have separate requirements.

Preserve the upstream MIT license and attribution. New features must keep editor, Preview, saved project and exported-site behavior consistent. See the current guides and release review for specific tested evidence and limits.
