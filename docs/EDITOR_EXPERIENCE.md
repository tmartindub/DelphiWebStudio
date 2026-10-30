# Editor experience

Last changed: 2026-10-29. M2 is in progress.

The application chrome uses the blue and orange palette from VCL2FMXConverter 7. New blank projects begin with an empty Home page. Eight local starters cover personal, portfolio, community, church, school club, business, documentation and blog sites. Starter text is generic and editable; pricing, contact forms, subscriptions and fabricated testimonials are not inserted. Pricing is hidden from creation palettes while existing pricing blocks remain readable and exportable.

The description box selects a starter locally; it does not claim to be AI or send the description to an external service. Local AI remains M4 work. The application no longer requests Google Fonts on startup or while editing; installed/system fonts are used. Generated HTML still needs the separate offline export work.

The editor has Beginner, Designer and Professional (JSON) views using the same site model. The Professional option opens the existing JSON editor. JSON changes are validated and undoable. These controls do not yet provide the complete advanced visual and source editing capabilities described in the handoff.

M2 still requires full page navigation editing, reusable headers/footers and sections, advanced responsive layout controls, direct HTML/CSS/JS editing, deeper keyboard/accessibility testing and all specified templates/features before the milestone is complete.

## Responsive preview checks

Desktop preview can expand to 1,200 pixels; tablet and phone previews use 768 and 375 pixels. On a narrower editor window, the fixed device previews can be scrolled horizontally. A sample centered hero, image, and PDF block were compared with exported HTML at those three widths; their measured widths matched and the sample did not horizontally overflow. The centered hero uses the same root font size and container breakpoint in preview and export. The PDF preview uses the browser's PDF object while export uses the bundled viewer, so their controls differ.

Other component types and variants still have separate preview and export renderers. Navigation and arbitrary user content have not all been verified for matching layout or overflow. These checks do not guarantee every page, device, browser, or screen size.

The centered, split, gradient, and minimal hero layouts were compared at 375, 768 and 1,200 pixels. Their tested heading sizes and widths matched, as did the split layout direction; this does not cover every feature or arbitrary content. Contact and newsletter blocks now identify themselves as unconnected and disable their controls until a backend is implemented. No successful submission is simulated.
