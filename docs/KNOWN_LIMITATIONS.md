# Known limitations

Current release review November 15, 2026 — version 1.0.0 build 1.

- Clean Windows 10/11 installation testing remains unverified. Both architectures were built and exercised on the development Windows x64 machine.
- The application and installers are unsigned; Windows can show publisher/reputation warnings. WebView2 is required, and SFTP additionally needs the Windows OpenSSH Client.
- Local loopback SFTP checks do not establish compatibility with every provider. Publishing requires deliberate review and confirmation. No site was published during validation.
- Contact forms need a configured HTTPS form service or the supported visitor email-draft flow. Newsletter signup is not a complete hosted subscription service.
- Wix project import, WordPress theme export, automatic GitHub site creation and automatic push/publish buttons remain future work. HTML/WordPress imports cover supported content and require review.
- Optional local AI needs a compatible runtime and model supplied separately. Cloud AI requires its own key/account and session consent.
- Imported source, custom code and external media need independent review. The lightweight site checker does not certify accessibility, every external link, or overall site safety.
- Portable project/save size and SFTP scan/backup limits are documented in the guides. Retained legacy credentials require explicit removal.

## Historical M0 findings

The following dated record is retained to explain the starting point. It is not the current feature list.


Last changed: 2026-10-29. Experimental M0 baseline.

The numbered list records the original M0 baseline and is retained as historical evidence, not a current feature checklist. The M1 five-page exit scenario has since passed isolated testing; see PROJECT_FILES.md for the evidence and remaining limits. Those baseline findings have been superseded by later work; consult the current limits below.

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

## M3 media increment

The experimental project workflow now saves media in project ZIPs and includes referenced assets and a local PDF viewer in website ZIPs. See MEDIA_LIBRARY.md for operation and remaining limitations. Native atomic save remains outstanding. The numbered entries below describe the original M0 baseline and are retained as historical findings, not a current feature checklist.

## M6 export styling increment

Exports embed generated styling and fall back to system fonts; no Tailwind or Google Fonts network request is needed. User-supplied remote media and optional analytics may still require a network. Other M6 publishing and validation requirements remain outstanding.

Unconfigured contact and newsletter forms are disabled and labeled in both editor and exported pages. Configurable form backends and end-to-end submissions remain future work.

A configured Contact block can open a visitor's email application with a draft; see PROJECT_FILES.md. It is not a hosted form backend and the visitor must send the draft. Newsletter signup remains disabled.
