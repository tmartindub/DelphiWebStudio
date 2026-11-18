# Known limitations

Current release review November 18, 2026 - version 1.0.0 build 1.

- The owner tested installation/startup on existing Windows systems, including Win32 on a genuine 32-bit Windows 10 22H2 computer and both editions on a newer Windows 10 x64 computer. The old machine took about 4 minutes 33 seconds to load, although the editing tried afterward worked. Newer-machine observations are in [Compatibility](COMPATIBILITY.md). These are not minimum specifications or a clean-Windows test; startup depends on the machine and its WebView2 environment.
- The application and installers are unsigned, so Windows can show publisher/reputation warnings. Microsoft Edge WebView2 Runtime, the browser engine embedded in the editor, is required. SFTP additionally needs Windows OpenSSH Client, the optional secure-shell tools; ordinary editing and export remain available without it.
- Earlier local loopback SFTP checks do not establish compatibility with every provider. Real-host publishing, live form delivery and domain changes were not part of this validation. Publishing requires separate review and confirmation.
- Contact forms need a configured HTTPS form service or the supported visitor email-draft flow. Newsletter signup alone is not a hosted subscription service.
- Wix project import, WordPress theme export and automatic GitHub website creation/push remain outside the current workflow. Supported HTML/WordPress content imports require review.
- Optional cloud assistance uses Google Gemini, Google's online artificial intelligence service. It needs internet access, a suitable Google account/project and an API key saved for the Windows account. Keep the Google project on Free tier with billing disabled; the app cannot verify that setting. Quotas and model availability are controlled by Google. There is no paid fallback, automatic retry or autonomous computer/site operation. The assistant proposes supported content changes and cannot read photo/PDF contents, generate images or publish a website.
- Optional local AI needs a compatible runtime and model supplied separately. Those files are not included in the installers, and installing them is unnecessary for Gemini assistance.
- Imported source, custom code and external media need independent review. The lightweight site checker detects selected descriptions, heading and navigation issues; it does not certify accessibility, every external link or overall safety. A banner's Page heading field supplies an H1 for assistive technology, but the author must avoid duplicating a main heading already on the page.
- Portable project/save sizes and SFTP scan/backup limits are documented in the guides. Local draft storage is not a substitute for separately saved and verified project files. Retained legacy credentials require explicit removal.
- Add to dictionary saves a word in the current Windows user's spelling dictionary. WebView2 can retain a cached spelling result for an already checked paragraph; reopen the editor if it continues to underline a newly accepted word. Newly checked text and subsequent sessions recognize the saved word. This command does not change project text or formatting.

## Historical M0 findings

Everything below records earlier milestone states. References to missing features, disabled workflows or outstanding work in those dated notes are historical and are superseded by the current limits above and the release review.



The following dated record is retained to explain the starting point. It is not the current feature list.


Last changed: 2026-10-29. Experimental M0 baseline.

The numbered list records the original M0 baseline and is retained as historical evidence, not a current feature checklist. The M1 five-page exit scenario has since passed isolated testing; see PROJECT_FILES.md for the evidence and remaining limits. Those baseline findings have been superseded by later work; consult the current limits above.

1. Export requires online Tailwind/Google Fonts; offline browser test fails. Editor also loads remote fonts; templates can use external media.
2. Static exporter handles 13 of 19 types. Divider, banner, content, image, video and gallery become comments, losing visible output.
3. Export uses top-level blocks, not all pages; the list can reflect the last edited page rather than Home. Navigation lacks validated page references.
4. No portable project file, explicit atomic filesystem save or recovery. localStorage is current persistence. Reload loses active project selection.
5. Several IDs use timestamps. Paths/IDs/references lack comprehensive validation. Page rename is not undoable; undo can leave selection on a removed page.
6. AI replaces config directly, can discard unknown blocks/empty pages, and lacks local inference or preview/approve transactions.
7. Pricing and promotional defaults remain upstream. Remove from WebStudio creation UI without silently deleting existing content.
8. Exported contact/newsletter forms use onsubmit=false; no working backend is configured.
9. Optional Gemini/deployment credentials use browser storage/project settings. Native protection and safe export boundaries remain required.
10. HTML escaping is not a complete security policy. URL protocols, theme interpolation, imported HTML/SVG and native IPC need hardening.
11. Baseline audit: 29 vulnerabilities, including critical tar and Vitest findings. Proposed fixes include a major @vercel/node downgrade; do not apply blindly. No release security sign-off.
12. No local media import, bundled PDF viewer, CMS/search, HTML importer, SFTP, Delphi shell, installer or local AI is implemented.
13. Eight existing tests cover only export metadata/analytics and deployment utilities. Accessibility, responsive behavior, all variants and clean Windows installation remain unverified.
14. Production JS chunk exceeds 500 kB. No performance budget established.
15. License history is preserved; redistribution notices/fonts/media/models/native runtimes still need final packaging audit.

No application/site was deployed in M0. Translation is deferred by owner instruction.

## Historical M3 media increment (October 2026)

The experimental project workflow now saves media in project ZIPs and includes referenced assets and a local PDF viewer in website ZIPs. See MEDIA_LIBRARY.md for operation and remaining limitations. Native atomic save remains outstanding. The numbered entries below describe the original M0 baseline and are retained as historical findings, not a current feature checklist.

## Historical M6 export styling increment (October 2026)

Exports embed generated styling and fall back to system fonts; no Tailwind or Google Fonts network request is needed. User-supplied remote media and optional analytics may still require a network. Other M6 publishing and validation requirements remain outstanding.

Unconfigured contact and newsletter forms are disabled and labeled in both editor and exported pages. Configurable form backends and end-to-end submissions remain future work.

A configured Contact block can open a visitor's email application with a draft; see PROJECT_FILES.md. It is not a hosted form backend and the visitor must send the draft. Newsletter signup remains disabled.
