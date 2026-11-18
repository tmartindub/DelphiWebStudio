# Editor experience

## Current editor controls

The canvas is the page displayed for visual editing. A block is a page section such as a banner, navigation bar or gallery; independent objects, such as text boxes and images, can sit inside sections or panels. The Navbar block supplies visitor navigation, while the Footer is the closing section at the bottom of a page. JSON (JavaScript Object Notation) is the structured text describing these components. HTML describes the exported page structure, CSS controls its appearance and JavaScript supplies programmed behavior.

The [illustrated Editor Reference](pdf/Delphi%20Web%20Studio%20Pro%20Editor%20Reference.pdf) describes the current Windows interface. File, Edit, Insert, View, and Advanced collect the editor commands; Page tools holds Plan pages and Check site. The toolbar keeps project status, preview sizes, and common commands visible. Technical imports, JSON, and history live under Advanced.

The Elements palette has categories, visual cards, and heading and paragraph presets. Object properties open in a floating window with paired position and size fields, and the selection toolbar exposes alignment, layering, duplicate, and delete. Use Shift+Click for a group or Alt+Click for overlapping objects. Use View > Media library or a Browse button in Properties to select media by thumbnail.

The page strip scrolls separately from the five fixed commands beside **Add page**. Rename, Duplicate, Search details, Change address and Delete act on the active tab. Home keeps its fixed address and cannot be deleted. **View > Manage Media** opens folder organization, while **View > Media library** opens placement.

Select the Navbar block to edit its **Navigation Links**. A parent link remains clickable and a separate arrow opens its submenu in Preview and the generated site. Add and reorder children in Properties. Escape closes the submenu and restores focus to the arrow.

The Calendar block exposes **Manage events** in editing mode. Visitors can change the displayed month and see its events. The Team Directory shows at most two lines of biography on a card and offers a scrollable full biography when the text overflows. The responsive Gallery retains original image proportions and supports an enlarged photo view with captions. Use Preview and the local website review to check these visitor interactions.

Choose **Wide prose** for longer articles such as a history or parish guide. It uses a wider reading area, justifies paragraph text when the content container is at least 600 CSS pixels, and keeps narrow paragraphs left aligned. Saved prose styling is applied before the editing canvas paints.

Check the footer and contact page at all three preset preview widths. A multi-column footer uses one column on narrow phones, two when its container reaches 28 rem, and automatically fits columns from 45 rem. The bottom links wrap in their own group. The wider contact form stacks Name and Email on phones and places them side by side from a 32 rem container. Preview and export use the same breakpoints.

## Earlier editor validation notes


Last changed: 2026-11-01. M2's specified no-code exit scenario has passed an automated browser check; independent user testing remains unverified.

The application chrome uses the blue and orange palette from VCL2FMXConverter 7. New blank projects begin with an empty Home page. Eight local starters cover personal, portfolio, community, church, school club, business, documentation and blog sites. Starter text is generic and editable; pricing, contact forms, subscriptions and fabricated testimonials are not inserted. Pricing is hidden from creation palettes while existing pricing blocks remain readable and exportable.

The description box selects a starter locally; it does not claim to be AI or send the description to an external service. Local AI remains M4 work. The application no longer requests Google Fonts on startup or while editing; installed/system fonts are used. Generated HTML still needs the separate offline export work.

The editor has Beginner, Designer and Professional views using the same site model. The Professional option opens the JSON editor. JSON changes are validated and undoable. Inspect page HTML displays a read-only snapshot of the active page's generated HTML; the final site ZIP adds navigation and custom code and adjusts links. Professional mode can also add page-specific custom HTML, CSS and JavaScript. The browser editor's isolated HTML/CSS preview does not run scripts. Custom-code preview is unavailable in the desktop app because its embedded browser blocks frames. Exported JavaScript and HTML can run in visitors' browsers, so use only trusted code. Apply the draft and save the project. The website ZIP contains the custom HTML in its page and CSS/JavaScript in separate local files. This is additive custom code, not direct editing of the generated page's existing markup.

An automated no-code check on the current preview created a community site, edited its home page, added an About page, checked the phone, tablet and desktop previews, and exported both pages. The exported sample had no horizontal overflow at 375, 768 and 1440 pixels. This is evidence for the M2 exit scenario, not a test by a nontechnical person or a guarantee for every site.

Shared headers and footers, reusable sections, page links, and preset and custom preview widths are available. The automated exit check does not establish that every broader editor feature is complete or that every site will behave correctly.

In a Content section, select text in Body and choose a page from “Insert a link to a page” to create a link without typing its address. If no text is selected, the page name becomes the link label. Draft articles are excluded.

In Components, click an item to add it at the end of the page, or drag it above or below an existing section on the canvas. The insertion can be undone. Layer reordering remains available in the Layers panel.

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
