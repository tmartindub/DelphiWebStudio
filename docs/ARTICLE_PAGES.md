# Article pages (experimental)

Last changed: 2026-10-30. This is an initial article-authoring increment, not a complete blog or CMS.

Create a non-Home page, select it, and open the **Articles** tab. Choose **Make this page an article**. The existing page content stays editable using the normal components. Add an author and summary in the Articles tab. The page name and path are its title and address.

New articles start as **Draft**. Draft pages remain in the project and its project ZIP but are omitted from the website ZIP, generated page navigation, search index and sitemap. Assets referenced only by draft pages are also omitted from the website ZIP. A link from an exported page to a draft article stops export and identifies the link rather than creating a knowingly broken site. This is not access control: do not share a project ZIP containing private drafts, and changing a page to Draft does not remove copies from any website or earlier export.

Choose **Ready** to include the page in the next website ZIP. Author and summary appear above the page content. Ready does not publish or upload anything. Changes to article metadata participate in editor undo/redo. Created and modified timestamps are stored with the page metadata.

This increment does not provide article archives, tags, categories, scheduled publication, RSS, reusable article templates, or a rich-text article editor. Use existing content components to edit page content. Those features and full collection support remain future work.
