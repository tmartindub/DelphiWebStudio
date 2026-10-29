# ADR-002: Versioned portable JSON

Date: 2026-10-29. Status: accepted direction; implementation pending M1.

Use human-readable versioned project JSON and local assets. Extend actual SiteConfig/pages instead of blindly adopting an illustrative schema. Validate IDs, references, paths and URLs; preserve unknown content. Browser persistence versions are not file versions. Keep migration originals recoverable. Preview/export derive from the same content model; caches are not authoritative.
