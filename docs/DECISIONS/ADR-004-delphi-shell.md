# ADR-004: Delphi shell with embedded React canvas

Date: 2026-10-29. Status: owner approved resolution; binding feasibility pending.

Native Delphi forms use design-time components with settings in the Object Inspector. Embedded React editor is the approved runtime UI exception. Prefer FMX Windows x64 with a tested WebView2 binding; document any fallback. Native code owns safe saves/dialogs/credentials/local processes. Versioned origin-checked bridge exposes allowlisted capabilities only to the trusted editor. Desktop delivery is required.
