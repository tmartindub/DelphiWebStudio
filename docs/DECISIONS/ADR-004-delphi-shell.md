# ADR-004: Delphi shell with embedded React canvas

Date: 2026-10-29. Status: owner approved resolution; binding feasibility pending.

Native Delphi forms use design-time components with settings in the Object Inspector. Embedded React editor is the approved runtime UI exception. Prefer FMX Windows x64 with a tested WebView2 binding; document any fallback. Native code owns safe saves/dialogs/credentials/local processes. Versioned origin-checked bridge exposes allowlisted capabilities only to the trusted editor. Desktop delivery is required.

## WebView2 investigation, 2026-10-30

RAD Studio 37.0's installed `FMX.WebBrowser.Win.pas` uses WebView2 on Windows, but its WebMessageReceived callback returns without forwarding the message and its `ICoreWebView2` field is private. The public `FMX.WebBrowser.TWebBrowser` surface provides navigation and script evaluation, but does not expose a WebMessageReceived event or virtual-host mapping. Consequently, the stock control alone has not been shown to support the origin-checked native bridge needed here; using script evaluation as a substitute for an authenticated inbound channel would be unsafe.

A Windows-only FMX binding worth evaluating is [WebView4Delphi](https://github.com/salvadordf/WebView4Delphi): its upstream README states FMX support, its source exposes virtual-host mapping and web-message APIs, and its upstream license is MIT. It has not yet been pinned, installed, or compiled with this project's RAD Studio version. If adopted, retain its license and verify the WebView2 runtime/loader redistribution terms and version requirements. No dependency was installed during this investigation.

WebView2's [local-content guidance](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/working-with-local-content) describes virtual-host mapping as a way to give packaged files a consistent web origin supporting storage APIs. Its [security guidance](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/security) calls for validating message sources and contents. An implementation must map only the packaged editor directory, validate the actual sender URI on every inbound message, reject untrusted navigation/messages, avoid exposing raw filesystem paths or shell execution, and enforce explicit native capabilities. Browser permissions and local model startup must remain off until explicitly requested.

Next proof: pin and review a compatible binding, build a small IDE-editable FMX form on Win64, load packaged local assets using a virtual origin, exercise one harmless request/response and reject a message from another origin, then verify storage and navigation across restart. A successful proof does not itself complete the bridge, native saves, installer, or milestone M7.
