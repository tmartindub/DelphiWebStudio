# Security

Experimental software, not production-ready. See known limitations and baseline dependency audit.

Never commit credentials, private documents, model weights or generated personal sites. Do not put secrets in public issues. Use GitHub private vulnerability reporting if enabled; otherwise request a private channel from the owner without revealing exploit details publicly.

Required boundaries include safe local paths/URLs, sandboxed imports, unprivileged preview, origin-checked allowlisted IPC, protected native credentials and explicit publishing approval. They are not all present in the baseline. Do not use production credentials or publish sites during ordinary development checks.
