# Local AI action foundation (experimental)

Last changed: 2026-10-30. This is a development-only foundation for M4, not a functioning AI wizard or model connection.

`src/ai/site-actions.ts` defines a versioned, preview-only request and a limited set of typed page, theme and block operations. Evaluation works on a copy of the validated project and returns a readable list of changes. It does not contact a model, execute commands, read files, publish a site or modify the editor. The result can be accepted only against the same source snapshot; a changed project or altered preview is rejected. An editor caller must still show the proposed changes, obtain the user's approval, and apply the result as one undoable change. No such user interface is wired yet.

The initial allowlist can create and rename pages, change six-digit theme colors, and add or edit limited hero and text blocks. It can move blocks and remove only supported hero or text blocks. It does not add media, run code, change URLs, publish or support arbitrary components. Rejected actions leave the input project unchanged. Unknown existing block fields are preserved.

There is no local model, inference process management, model installer, JSON-schema integration, conversational planner, UI approval workflow, or quality benchmark yet. The action contract alone is not an M4 completion or a general security guarantee. Do not send private project data to an external provider without the user's separate opt-in.
