# Delphi Web Studio Pro privacy notice

Last changed: 2026-11-15

This notice describes Delphi Web Studio Pro 1.0.0 build 1 for Windows. Third-party services, browser builds, and future versions fall outside its scope.

## Information kept on this computer

The editor stores local project drafts and settings in its WebView browser storage. Imported media and local revisions are stored in local browser databases. A project saved to a file contains its project content and, when applicable, packaged media. WordPress and HTML imports can retain their original XML, HTML and CSS as inactive project data; those files may include private author details or other information. Backup and recovery files may also contain private project content. Protect the computer and any files you share or back up.

Gemini and Deploy Access Keys entered in Settings are held in memory for the current session. On Windows, **Save key** also stores the Gemini key in Windows Credential Manager for the current Windows account so it can be reused across projects and restarts. **Remove saved key** removes the Windows copy. Older keys saved in browser storage or project settings remain until removed with the corresponding legacy-key control. The Windows credential is separate from project files and website exports. The deployment key is excluded from portable project files. Testing a Gemini key sends the key and a test request to Google. Authentication is sent in a request header, rather than in the request URL.

## Network use

The optional local AI feature runs the selected model as a local process bound to the computer's loopback interface. Downloading its runtime or model opens a browser and contacts the selected download provider. The separate cloud-generation path is off by default; if enabled for the current session, it can send a generation brief to Google when a key is available or to a configured server endpoint. The setting resets on reload. Do not include private content unless you intend to send it. The optional SFTP functions connect to the configured server when requested. Opening, saving, previewing and exporting a project do not publish a website. Review any links, custom code, external media or configured third-party services in a project: these may contact external services when used or viewed.

**Open reviewed site in browser** serves the reviewed website ZIP to a browser on this computer over a temporary loopback address. The preview can load external resources referenced by the site. The temporary ZIP is removed when you stop the preview or close the editor. The Microsoft Edge WebView2 Runtime may collect and send diagnostic information as described in [Microsoft's WebView2 data and privacy documentation](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/data-privacy).

## Retention and removal

Uninstalling the application preserves saved projects, the WebView profile, local revisions, the Windows credential, and optional AI files. Dashboard → **Local Storage** lets you review local media and revision sizes and explicitly remove local revisions or media left by a removed draft. Removing browser/profile data may permanently remove local drafts and media. First save and verify separate project files and backups.
