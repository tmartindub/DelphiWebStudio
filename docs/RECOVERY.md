# Project backup and recovery (experimental)

Last changed: 2026-11-01

Keep separate project files and backups. Local drafts and revisions are useful working copies, but they are not a substitute for a verified backup. Save a project, then reopen it as a separate copy and check its pages and media. Keep another copy on a separate drive.

## Back up and restore a project file

In the desktop app, choose **Project → Back up project**, select a saved project JSON or ZIP, and choose a new backup ZIP filename. To recover, choose **Project → Restore project backup**, select the backup ZIP, and choose a new project filename. Open the restored project and check it. Backup and restore do not intentionally replace an existing destination. Current limits are 512 MiB for the project and 513 MiB for the backup ZIP.

## Interrupted save or damaged draft

If a save is interrupted, read the status message. **Recover staged file** can copy a retained `.webstudio-download-*.tmp` file to a new project filename in the same folder. A staged file may be incomplete: open the recovered file and check its content. If a project replacement has a problem, inspect the recovery ZIP path shown in the status details; retain the original and any recovery files until the project is verified.

If a stored draft is unreadable, the dashboard can offer **Save unreadable draft data**. This saves whatever raw draft values are readable to a ZIP; it does not include media and cannot be opened directly as a project. The recovery ZIP can contain private data, so keep it private. If storage is inaccessible, the raw recovery download may not be available.

Controlled tests have exercised several save and recovery paths. Power loss, every interruption point and every filesystem have not been proven safe. If recovery fails, preserve the original files and use a verified earlier backup.
