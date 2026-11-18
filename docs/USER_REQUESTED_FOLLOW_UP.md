# User requested follow-up

Recorded November 1, 2026. These are requested outcomes for later project work.
This document records the requests; it does not assert that the features already
exist or authorize publication of any website.

## Save the Google key

Google Gemini is Google's online artificial intelligence service. Its API key is a secret credential used to identify the Google project making a request. That service project manages access and usage separately from a website project in the editor.

The user wants to enter the Gemini API key once and have the application retain
it across application restarts, rather than requiring it to be entered for each
session. Provide an appropriate way to replace or remove the saved key. Determine
and implement a protected Windows credential storage approach as part of the
approved implementation, and avoid putting the secret in exported websites,
project files, or Git. Preserve existing user data and handle an existing legacy
key deliberately.

Current behavior: a newly entered Gemini key is held in session state. The
application also reads an older legacy key from browser local storage, when one
exists. Project and configuration drafts use browser local storage; media and
local revisions use IndexedDB, the embedded browser's local database. Those stores are not presently a protected,
persistent credential feature for newly entered keys.

## Define compatible hosting

Define which hosting environments and configurations can serve the app's
exported sites, including static files, paths and subfolders, assets, and
features requiring external services. Work toward tested, documented compatibility
and make any remaining limitations clear. Do not claim compatibility with every
host without verification.

## Future Wix import

Work toward importing Wix sites in the future. The user is investigating this
separately with ChatGPT and expects to provide that material later. The format,
access method, fidelity, constraints, and scope are not yet established.

## Export to WordPress

The user's goal is to export a Delphi Web Studio Pro site to WordPress intact and
have it work there, reducing the need to use the WordPress editor. The user does
not expect this work to import WordPress themes or other WordPress items.
Investigate the destination format, supported functionality, installation and
update path, and fidelity; do not claim intact export until verified.

## GitHub site setup

Consider an assisted or automatic way to create and configure a GitHub website
for a user or organization, because many users may not know the setup steps.
Define authentication, ownership, permissions, account-plan constraints, and
the point at which a site becomes publicly accessible. The user has explicitly
instructed that no site be published yet.

## Push and Push and Publish

The user wants separate **Push** and **Push and Publish** buttons. Push should
push changes; Push and Publish should push and publish changes. Define their
exact repository, branch, visibility, confirmation, and publication behavior
before implementation. GitHub Pages can automatically publish pushes to a
configured publishing source, so a nonpublishing push must avoid accidentally
triggering publication. No site may be published without the user's explicit
instruction.
