# Delphi Web Studio privacy notice (experimental)

Last changed: 2026-11-01

Delphi Web Studio is experimental. This notice describes the current local desktop build; it is not a guarantee for third-party websites, services, browser builds, or future versions.

## Information kept on this computer

The editor stores local project drafts and settings in its WebView browser storage. Imported media and local revisions are stored in local browser databases. A project saved to a file contains its project content and, when applicable, packaged media. WordPress and HTML imports can retain their original XML, HTML and CSS as inactive project data; those files may include private author details or other information. Backup and recovery files may also contain private project content. Protect the computer and any files you share or back up.

New Gemini and Deploy Access Keys entered in Settings are held in memory until the app closes or the page reloads. Keys saved by an older build remain in local browser storage or project settings without application-level encryption until the user explicitly chooses the corresponding **Remove older saved key** control; they are not removed automatically. The deployment key is excluded from portable project files. Do not share browser profiles or recovery material containing secrets. Testing a Gemini key sends it to Google. Only use third-party services when you intend to and have reviewed their privacy terms.

## Network use

The optional local AI feature runs the selected model as a local process bound to the computer's loopback interface. Downloading its runtime or model opens a browser and contacts the selected download provider. The separate cloud-generation path can send its prompt to Google when a key is available or to a configured server endpoint; do not include private content unless you intend to send it. The optional SFTP functions connect to the configured server when requested. Opening, saving, previewing and exporting a project do not publish a website. Review any links, custom code, external media or configured third-party services in a project: these may contact external services when used or viewed.

The Microsoft Edge WebView2 Runtime may collect and send diagnostic information as described in [Microsoft's WebView2 data and privacy documentation](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/data-privacy). This is separate from the application's own project storage and optional network features.

## Retention and removal

Uninstalling the experimental application does not remove saved projects, the WebView profile, local revisions or optional AI files. Removing browser/profile data may permanently remove local drafts and media; first save and verify separate project files and backups. The application does not currently provide a complete privacy or data-erasure audit.
