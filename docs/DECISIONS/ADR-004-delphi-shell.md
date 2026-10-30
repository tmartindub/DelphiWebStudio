# ADR-004: Delphi shell with embedded React canvas

Date: 2026-10-29. Status: owner approved resolution; binding feasibility pending.

Native Delphi forms use design-time components with settings in the Object Inspector. Embedded React editor is the approved runtime UI exception. Prefer FMX Windows x64 with a tested WebView2 binding; document any fallback. Native code owns safe saves/dialogs/credentials/local processes. Versioned origin-checked bridge exposes allowlisted capabilities only to the trusted editor. Desktop delivery is required.

## WebView2 investigation, 2026-10-30

RAD Studio 37.0's installed `FMX.WebBrowser.Win.pas` uses WebView2 on Windows, but its WebMessageReceived callback returns without forwarding the message and its `ICoreWebView2` field is private. The public `FMX.WebBrowser.TWebBrowser` surface provides navigation and script evaluation, but does not expose a WebMessageReceived event or virtual-host mapping. Consequently, the stock control alone has not been shown to support the origin-checked native bridge needed here; using script evaluation as a substitute for an authenticated inbound channel would be unsafe.

A Windows-only FMX binding worth evaluating is [WebView4Delphi](https://github.com/salvadordf/WebView4Delphi): its upstream README states FMX support, its source exposes virtual-host mapping and web-message APIs, and its upstream license is MIT. It has not yet been pinned, installed, or compiled with this project's RAD Studio version. If adopted, retain its license and verify the WebView2 runtime/loader redistribution terms and version requirements. No dependency was installed during this investigation.

WebView2's [local-content guidance](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/working-with-local-content) describes virtual-host mapping as a way to give packaged files a consistent web origin supporting storage APIs. Its [security guidance](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/security) calls for validating message sources and contents. An implementation must map only the packaged editor directory, validate the actual sender URI on every inbound message, reject untrusted navigation/messages, avoid exposing raw filesystem paths or shell execution, and enforce explicit native capabilities. Browser permissions and local model startup must remain off until explicitly requested.

Next proof: pin and review a compatible binding, build a small IDE-editable FMX form on Win64, load packaged local assets using a virtual origin, exercise one harmless request/response and reject a message from another origin, then verify storage and navigation across restart. A successful proof does not itself complete the bridge, native saves, installer, or milestone M7.

## Initial request envelope

`src/desktop/bridge-protocol.ts` defines and tests an initial version-1 request envelope for the planned native boundary. It accepts only an explicit operation, request and session identifiers, and the current project identity; it contains no caller-selected path, shell command, or arbitrary payload. Validation checks the WebView event's actual sender URL against the reserved `https://webstudio.local` origin, checks the current session and project, and requires an independently granted capability. The validator is not connected to the editor or a native host, and cannot open or save files. The native implementation must independently enforce these checks, assign and revoke session/capability grants, constrain navigation, prevent replay where appropriate, and define bounded file transfer and response handling before implementing operations.

## Isolated Win64 feasibility proof

On 2026-10-30, upstream WebView4Delphi revision `0a27539f689026bf9d49e158d7078d249a2b4683` was cloned into a temporary evaluation directory. Its SimpleFMXBrowser example built with the installed RAD Studio 37.0 Win64 compiler. An isolated modification mapped a local test folder to `https://webstudio.local`, loaded its test HTML, and received `local-proof-ok` from the WebView event with source `https://webstudio.local/index.html`. The test application closed after the message. It did not load the WebStudio editor, access project data, or publish anything.

The binding's initialization code navigates to `DefaultURL` after `OnAfterCreated` returns. Setting the mapped URL as `DefaultURL` after establishing the mapping avoided the initial navigation overriding the test page. The upstream FMX example creates a native window parent at runtime even though the browser component itself is on the form; the project must respect the owner's IDE-editable form and runtime UI restrictions when deciding how to integrate it. This was an external feasibility test, not project UI code or a decision to add the dependency.

This proves only local asset mapping and a one-way message for one installed runtime. It does not establish origin rejection, message validation in Delphi, secure file operations, rendering of the editor, design-time installation, runtime redistribution, a clean-machine installation, or completion of M7. The exact dependency and WebView2 runtime requirements must be pinned and reviewed before integration.

## VCL design-time alternative, 2026-10-30

The pinned WebView4Delphi source has a VCL `TWVWindowParent` control with a published `Browser` property and an upstream SimpleBrowser example whose `.dfm` contains both `TWVWindowParent` and `TWVBrowser`. The example creates the native browser instance for that already-declared control after the WebView2 environment is ready. This is different from constructing the form's controls at runtime; the owner's restrictions still govern any proposed project implementation.

The unchanged upstream Delphi VCL SimpleBrowser example compiled successfully for Win64 Release with RAD Studio 37.0 MSBuild using the source search path from its project file. This was a compile-only test in the temporary evaluation directory: the example was not launched, installed into the IDE, added to this repository, or connected to WebStudio. It does not prove message-origin validation, offline editor loading, packaging, persistence, or clean-machine behavior. VCL is a candidate for further evaluation because the upstream FMX parent explicitly requires runtime construction; it is not yet an approved replacement for the FMX recommendation or a completed desktop shell.

## Isolated VCL local-editor proof, 2026-10-30

A separate, hidden Win64 proof used a `.dfm` declaring the VCL parent, browser and timer, with a private test WebView cache. It mapped the feature-enabled production `dist` folder to `https://webstudio.local`, loaded the editor, and received an injected test message from `https://webstudio.local/index.html` containing `WebStudio|107`, indicating that the root had rendered text. The process closed itself with exit code 0. It was compiled with RAD Studio 37.0 and the previously evaluated WebView4Delphi source; the proof files and cache are disposable test artifacts, not product code.

This narrows the feasibility question: an IDE-declared VCL host can load this build and receive a local-origin message on this machine. The proof checks one expected sender string; it does not test rejection of malicious origins, trusted navigation, native capabilities, safe file operations, UI editing in the IDE, licensing of a distributed runtime, installation, or release readiness. No shell architecture decision or dependency installation has been made.

## Isolated VCL source-check proof, 2026-10-30

A separate hidden Win64 proof mapped two local test folders to `webstudio.local` and `untrusted.local`, navigated to each in turn, and sent the same test message. Its native event handler accepted the message whose WebView-reported source was `https://webstudio.local/index.html` and rejected the message from `https://untrusted.local/index.html`. It exited successfully with both results recorded. This exercised real WebView2 sender reporting and a simple native exact-source decision on this machine; the proof intentionally allowed navigation to the untrusted test origin so it could send the second message.

This is not a product bridge or complete security review. It does not test subframes, redirects, replay, malformed messages, capability grants, navigation prevention, file access, or a clean install. Any desktop implementation must independently enforce its origin and navigation policy and test those cases.

## Native request validation increment

`desktop/bridge/WebStudio.Bridge.pas` now validates a small version-1 native request envelope against the actual sender URL supplied by its caller, a native session and project identity, and an explicit capability set. It rejects unknown fields and operations, invalid IDs, malformed or oversized messages and project-scoped requests without a project. The native validator accepts the canonical integer representation `1` for the version and requires the sender string to start with `https://webstudio.local/`; it is deliberately stricter than the TypeScript prototype's URL normalization.

The Win64 console smoke test `tests/native/DesktopBridgeValidationSmoke.dpr` compiled and passed with RAD Studio 37.0. The native session wrapper accepts a host-provided session ID, project and grants; it serializes validation and request-ID claims, rejects replay, and can revoke a session. It fails closed after 4,096 claims instead of forgetting old IDs. The test exercises concurrent duplicate requests, revocation and the request limit. The future host must generate an unpredictable session ID, manage the session lifetime and avoid freeing it while requests are in flight.

This code is not connected to a WebView, does not choose or grant capabilities, restrict navigation or perform file operations, and is not a complete bridge or security sign-off. A future native host must pass the WebView event's source rather than trusting a message field, establish and revoke session grants, and test the entire boundary.
