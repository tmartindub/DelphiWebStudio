# Editor experience

Last changed: 2026-10-29. M2 is in progress.

The application chrome uses the blue and orange palette from VCL2FMXConverter 7. New blank projects begin with an empty Home page. Eight local starters cover personal, portfolio, community, church, school club, business, documentation and blog sites. Starter text is generic and editable; pricing, contact forms, subscriptions and fabricated testimonials are not inserted. Pricing is hidden from creation palettes while existing pricing blocks remain readable and exportable.

The description box selects a starter locally; it does not claim to be AI or send the description to an external service. Local AI remains M4 work. The application no longer requests Google Fonts on startup or while editing; installed/system fonts are used. Generated HTML still needs the separate offline export work.

The editor has Beginner, Designer and Professional (JSON) views using the same site model. The Professional option opens the existing JSON editor. JSON changes are validated and undoable. These controls do not yet provide the complete advanced visual and source editing capabilities described in the handoff.

An automated no-code check on the current preview created a community site, edited its home page, added an About page, checked the phone, tablet and desktop previews, and exported both pages. The exported sample had no horizontal overflow at 375, 768 and 1440 pixels. This is evidence for the M2 exit scenario, not a test by a nontechnical person or a guarantee for every site.

Shared headers and footers, reusable sections, page links, and preset and custom preview widths are available. M2 remains in progress: the Professional mode does not yet provide the handoff's HTML/CSS/JS editing and source inspection, and the broader editor requirements remain to be checked.

## Responsive preview checks

Desktop preview can expand to 1,200 pixels; tablet and phone previews use 768 and 375 pixels. On a narrower editor window, the fixed device previews can be scrolled horizontally. A sample centered hero, image, and PDF block were compared with exported HTML at those three widths; their measured widths matched and the sample did not horizontally overflow. The centered hero uses the same root font size and container breakpoint in preview and export. The PDF preview uses the browser's PDF object while export uses the bundled viewer, so their controls differ.

Other component types and variants still have separate preview and export renderers. Navigation and arbitrary user content have not all been verified for matching layout or overflow. These checks do not guarantee every page, device, browser, or screen size.

The centered, split, gradient, and minimal hero layouts were compared at 375, 768 and 1,200 pixels. Their tested heading sizes and widths matched, as did the split layout direction; this does not cover every feature or arbitrary content. Unconfigured contact and newsletter blocks identify themselves as unconnected. A contact block can optionally open the visitor email application with a draft; the visitor sends it there. No successful submission is simulated.

Feature grid, list and alternating examples were also checked at 375, 768 and 1,200 pixels. Export now retains images in alternating feature sections; a nested-page media ZIP test covers their paths. Remaining blocks and varied user content still need checks.

The page navigation generated for multi-page ZIP export is also shown in the editor preview, with page links selectable there. Its size and wrapping were compared at 375, 768 and 1,200 pixels in an isolated sample; this does not resolve the separate legacy Navbar block's incomplete link behavior.

CTA simple/split and statistics grid/bar/counter examples were compared at 375, 768 and 1,200 pixels. Tested text sizes, split directions and grid column counts matched, and the samples had no horizontal overflow. The statistics counter export now retains its selected variant. This does not establish full visual parity or verify arbitrary content.

Long unbroken text now wraps within the editor's page preview and exported page rather than being clipped at the edge. An isolated browser check exercised a long headline at 375, 768 and 1,200 pixels and a long button label at phone width. Components with explicit fixed sizes or preformatted content still need separate testing.

## New content blocks

New Features, Testimonials, Stats, FAQ, Team and Logo Cloud blocks start without made-up entries. Add your own entries in Properties. Existing project data is retained. Check site identifies explicitly empty blocks before export.

Video blocks accept common YouTube watch, short, live and share links and Vimeo page or player links. The preview and exported page use the corresponding provider's embedded player, so playback requires an internet connection and remains subject to the provider's availability and settings. Check site flags unsupported addresses; it does not verify that a video exists or can be played.
