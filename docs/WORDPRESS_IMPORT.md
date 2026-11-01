# WordPress XML import (experimental)

Choose **Import WordPress XML** on the dashboard or in the editor, select a WordPress WXR XML export, review the report, and choose **Create imported project**. This creates a separate local project; it does not modify the source file or publish anything. The initial importer accepts UTF-8 XML exports up to 1 MiB and at most 500 items. XML document type and entity declarations are rejected.

Posts and pages become editable plain-text content blocks with new local paths. Posts start as drafts; WordPress categories and tags become article tags. A new empty Home page is added. Other item types are counted but not converted. Links, formatting, images, attachments, shortcodes, plugins, themes, and server functionality require manual review or separate import. Keep the original export and verify the imported text and paths before using the project.

The original XML is stored as inactive data in the project so unsupported content is not discarded. It can include private WordPress information, such as author details, and is included when the project is saved or shared. To read or copy it, open the editor's JSON/code panel and choose **Inspect imported source**. Source HTML and scripts are not executed by the importer or the read-only source view. This is an initial conversion, not a complete WordPress site reconstruction.

An isolated Windows WebView2 test imported a fictional WXR with one page, one post, an attachment, and a script. It checked the report, separate project, draft status, inactive script, and original XML after saving, reopening and viewing the source. Clean-Windows acceptance and broader WordPress compatibility remain unverified.
