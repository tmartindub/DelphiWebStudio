# Compatibility contract

Reviewed November 18, 2026 for version 1.0.0 build 1.

The desktop editions are a 32-bit Windows application (Win32) and a 64-bit application (Win64). They target Windows 10/11 and display the editor through Microsoft Edge WebView2 Runtime. Win32 also runs on Windows x64; choose Win64 for a 64-bit system. Native forms remain editable in RAD Studio 37.0, the Delphi development environment. React supplies the visual canvas, the owner-approved runtime interface.

The owner's observed startup times were approximately 273 seconds for Win32 on an older genuine 32-bit Windows 10 22H2 Inspiron, 14 seconds for that same Win32 edition on a newer Windows 10 x64 machine, and 6 seconds for Win64 on that newer machine. Basic edits and drag/drop worked after the older computer finished loading. A Windows 11 result was approximately 3.7 seconds, with its application architecture unconfirmed. These observations distinguish the editions and computers; they are not controlled benchmarks, minimum hardware specifications or proof of performance on every Windows installation. No Windows reinstall or clean VM test was reported.

Portable projects preserve the pages model, legacy one-page JSON and supported unknown data. JSON is the structured text format describing project content and layout. Asset identity is independent of media folders. Gallery normalization gives existing and newly added photos the same identity-based editing commands; supported loose gallery photos are absorbed without duplicate rendering, while panel children retain their parent. Opening, saving and Preview do not publish.

Website export produces independent HTML pages with referenced assets and supporting styles/scripts. The destination needs a compatible static web server, not an editor build server. Keep the generated structure intact and test root and nested hosting paths. External links, media, forms, translation services and custom code can still need network access. Use Export -> Review files -> Open reviewed site in browser to test the prepared site locally while keeping the editor running.

Page descriptions supply search-result summaries, with a site description as fallback. H1 denotes the main page heading and H2 a subordinate section. An Image block's Page heading supplies a clipped H1 for banner artwork without adding visible lettering; Footer column headings use H2 with their existing appearance. Plain contact/address columns are not navigation, while intended legacy navigation labels still need destinations. These semantics are shared by editor rendering and website export.

Optional Gemini assistance requires internet access and the Windows-saved Google key for a Free-tier project with billing disabled. The app cannot verify billing status. Accepted components remain ordinary project content, and exported websites do not depend on Gemini. Optional local AI and serverless API endpoints have separate requirements. SFTP uses Windows OpenSSH Client and a compatible host with the user's account/key and trusted-host details.

Preserve the upstream MIT license and attribution. New features must keep editor, Preview, saved project and exported-site behavior consistent. See the illustrated guides and [release review](RELEASE_1_0_REVIEW.md) for exact validation evidence and its limits.
