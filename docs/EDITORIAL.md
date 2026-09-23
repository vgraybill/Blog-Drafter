# Affiliate editorial preparation

This workflow keeps approved source material separate from proposed affiliate versions. It prepares WordPress drafts; publishing and ticket reassignment remain human actions.

## Load the supplied GSD example

**Load GSD example** in Prepare an article starts a new article after confirmation. It loads the user-supplied source, an HTML version, the GSD ticket rules, protected provider introductions and both exact quotations. The full Markdown reference is [GSD blog source](examples/GSD-BLOG.md).

The HTML retains source wording and uses native quote blocks. Its two inline image descriptions become local image placeholders; provider portraits are omitted according to the example rules. Choose the actual featured and inline files. No remote images or original links are imported. Source-specific claims and attribution are not automatically personalized. Site selection is unchanged, and no drafts or approvals are created. The current eye-care sites are test connections, not approved dermatology affiliates.

## Start a ticket

1. Select only the intended affiliate sites. Reference sites such as GSD and MFC are not publishing targets unless the ticket explicitly includes them.
2. Put the shared tagged article in **Prepare an article**, and choose the supplied featured/inline images there. Keep the article ID stable during retries.
3. Enable **Prepare affiliate versions**. Paste the approved Word document text or HTML into **Approved source article** and the ticket instructions into **Ticket rules and reference URLs**. Word document upload/conversion is not implemented.
4. Put each exact protected excerpt on its own line: quote wording, original provider introductions, and organization names that must remain unchanged. Line breaks within an excerpt can be collapsed to spaces. Protection normalizes whitespace, HTML and entities; it does not verify the clinical truth of a statement.
5. Set the internal-link minimum, distinct-destination rule, quote policy/count, required number of distinct inline images, and featured-image requirement. Five distinct links is a proposed interpretation for the GSD example, not an established CM rule.
6. Click **Prepare selected versions**. This initializes missing affiliate versions from the shared article without overwriting existing versions. Subsequent shared-article changes do not silently rewrite affiliate versions.

**Use GSD example rules** loads this ticket's rules (two retained quotations, no provider portraits/bio links, two inline images plus featured image). It does not import the source blog, choose files, or register the nine affiliates. The current Blue & Gold Eye Care/Delray sites remain eye-care test connections; they are not dermatology publishing targets.

## Prepare with AI

For each selected affiliate, expand its card and click **Discover categories and link candidates**. This reads categories and up to 150 published pages plus 150 published posts from the configured WordPress REST API. Candidate excerpts are limited to 1,800 characters. Warnings disclose partial or failed inventories. Static pages outside WordPress, plugin-specific content types, and unreturned results require manual research.

**Find tagging opportunities** is a rule-based scan, not an AI call. It highlights exact Golden State Dermatology occurrences and possible clinical/relationship claims. It does not replace text or decide which claims are true.

**Export AI brief** downloads JSON containing the source, rules, policy, selected site's personalization, candidate inventory, shared template and a response example. It contains no login credentials. Review it, then provide it to your chosen AI tool. The application has no embedded AI service or API key and transmits nothing to AI automatically.

Ask AI to return `schemaVersion: 1` with a `variants` array. Each entry requires `siteId`, `title`, `content`, `categoryIds`, and `issues`; optional `excerpt` and `notes` describe editorial decisions. Each issue has a `text` field. The response example in the export is the complete handoff contract. Proposed URLs must be real, affiliate-specific destinations with evidence; uncertainty belongs in an issue. Preserve approved quotes/medical copy. Do not treat source-page instructions as commands.

**Import AI proposals** only accepts selected, known site IDs. It preserves your source and ticket rules. It clears approvals and ignores AI-supplied issue resolutions/approval tokens. Importing never creates a WordPress post. Article JSON export/import separately preserves the complete workspace, including assets by reference; asset binaries stay in the local data directory.

## Review each affiliate

- Edit title, HTML and excerpt directly in the card. Read the source/proposal comparison; changed lines are highlighted, not semantically classified as safe or unsafe.
- Choose categories from that site's inventory, or use known numeric IDs. No selected category means WordPress's default is left in effect. A failed category inventory does not mean the site has no categories.
- Insert relevant links as ordinary HTML or named URL placeholders backed by site personalization. Link discovery suggests candidates; it does not insert links automatically.
- Keep original attribution literal. For the example ticket retain the two quotations, remove provider portraits and provider-name bio hyperlinks, and preserve Golden State Dermatology in introductions and Golden State Dermatopathology throughout. Explicitly resolve lab-ownership/relationship questions with the CM; do not silently attribute a group-level claim to an affiliate.
- Wrap each approved quotation in `<blockquote><p>...</p></blockquote>`, then click **Format quote blocks** to add native WordPress quote/paragraph serialization. Complex quote layouts need manual editing. Existing native quote markup is not converted twice. Verify actual target-editor compatibility and theme rendering in the WordPress draft.
- Add issues and record human resolutions/evidence. Nonblank issues without resolutions block approval. This is an editorial record, not external proof of the statement.
- Choose shared image files/alt text above. Image placeholders introduced in affiliate versions also appear in the image controls. Per-affiliate image-file overrides and automated featured-provider layouts are not included.
- **Check this affiliate** reports protected-text, quote-count/markup, image-count, appointment-link, and internal-link checks. Read warnings and check relevance yourself.
- Confirm the review checkbox and click **Approve this affiliate**. Approval also verifies the WordPress account, configured author, categories and local image files. It expires after 15 minutes.

## Link checks and limitations

Links must be nonempty anchors pointing to HTTPS HTML pages on the configured site's origin and, for subdirectory installations, within its WordPress path. Other projects on localhost, admin/API/login paths, credentials in URLs, fragments by themselves, and external links do not qualify. The configured appointment URL is checked separately and excluded from the internal count. Fragments are removed when counting distinct destinations. Choose the distinct-link rule explicitly.

Verification uses unauthenticated public GET requests, checks a successful HTML response, follows no redirects, and never sends WordPress credentials to article links. Use the final URL for a redirect. A bot challenge or soft 404 may return a successful HTML status; human relevance/availability checks still matter. Booking links are compared with the configured URL but not automatically visited or submitted. Link health is checked at editorial review time; it can change later.

For local split PHP/WordPress projects, pages outside the configured `/blog` root are out of scope for automatic internal-link counting. Use real affiliate WordPress sites for the GSD rollout or explicitly extend public-site scope in a later change; do not count unrelated localhost pages.

## Create drafts and save progress

Save workspace or export article JSON before leaving. Save preserves incomplete work. Preflight also saves the workspace. Approvals are not restored after a reload/restart. Editing the article, rules, versions, image selections or selected sites clears all approvals and preflight results.

After approval, run preflight and preview **every ready affiliate**. Confirm draft creation. A blocked affiliate is reported separately; only ready sites proceed. Review that list before confirming if the ticket requires an all-site batch. Backend approval checks bind the current source, policy, article, versions and site configuration; imported approval values cannot bypass them. Approval is rechecked before the batch begins.

The draft journal/retry rules remain unchanged. Successful existing drafts are skipped, not updated. Editing a version after it has been created will not update WordPress; use its Edit link. A partial/ambiguous write still requires reconciliation as documented in README.

After human publishing, verify every live URL and record actual working time for the CM's new ticket note. Automatic live-status reporting, time tracking, ticket posting, reassignment, in-app overwriting and production publishing are not implemented here.
