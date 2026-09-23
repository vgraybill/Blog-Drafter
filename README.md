# Local WordPress Blog Publisher

A dependency-free Node.js + vanilla browser prototype. Node's built-in HTTP server, fetch, FormData, crypto and test runner keep setup small. No build step, database, custom WordPress plugin, AI service or cloud account.

## Run locally

Install Node.js 24 or newer. From this folder in PowerShell:

```powershell
Copy-Item config/sites.example.json config/sites.json
Copy-Item .env.example .env
```

Edit both copied files before connecting. Replace the example URLs and author/category IDs with TWO authorized test installations. Each site requires HTTPS and the normal `/wp-json/wp/v2` REST route. Subdirectory installations are supported by including the subdirectory in `url`.

In each WordPress user's Profile screen create a dedicated Application Password. Configure it only in `.env`, for example `WP_TEST_A_USERNAME` and `WP_TEST_A_APP_PASSWORD`. The prefix is `WP_` followed by the uppercase site ID with hyphens replaced by underscores. Spaces in an Application Password can be preserved. Never enter the user's main WordPress password. Restart after changing environment variables.

```powershell
node --use-system-ca --env-file-if-exists=.env src/server.js
```

Open **http://127.0.0.1:3210** (use this exact host, not localhost). No npm install is needed. `npm start` is equivalent if npm is available. Stop with Ctrl+C.

Without config/sites.json the UI opens in setup mode. It never contacts the example sites automatically. PORT defaults to 3210. The app binds only to loopback, validates Host/Origin, and requires a server-generated CSRF token on mutations. Credentials stay on the backend. Do not proxy or expose this app to a network.

## Placeholder documentation

Read the [{{placeholders}} guide](docs/PLACEHOLDERS.md) for text fields, inline images, links, custom fields, naming rules and troubleshooting. The article editor also includes an expandable guide beside the placeholder hint.

## Draft workflow

1. Select a group checkbox or individual sites.
2. Keep a stable article ID. Enter a title, ordinary HTML, and optional excerpt.
3. Use personalization tokens matching keys under each site's `personalization`, such as `{{practice_name}}`, `{{doctor_name}}`, `{{city}}`, `{{phone}}`, and `{{appointment_url}}`.
4. Put `{{image:practice-photo}}` between HTML tags. Its file/alt-text controls appear automatically. Choose the featured image separately or reuse an inline asset. JPEG, PNG and WebP are accepted, at most 10 MB each.
5. Run preflight. It checks local assets, unresolved tokens, authenticated user/capabilities, configured author, and categories separately for every site. Custom permission filters can still reject writes. A differently assigned author may require user-listing permissions for verification; authenticating as the configured author keeps permissions smaller.
6. Preview every ready site, check the confirmation, then create drafts. Backend status is always `draft`. Preflight snapshots expire after 15 minutes; changes invalidate review. The backend rechecks sites before writing.
7. Review the results and open each draft in WordPress. Confirm final rendering, author, category, featured image, inline image and alt text.

The app stores the latest article when preflight runs and restores it on reload. Export JSON before leaving if you need to preserve unvalidated edits. Exported JSON references local asset IDs; it does not embed images. Moving to another computer requires copying the relevant data/assets files too. Keep content IDs stable for retries.

## Search and LAUNCH ALL

Search the selected sites by exact slug, publication date, last-modified date, or their combination. Both date boundaries include the selected day in each site's local timezone. Searches include accessible published, future, draft, pending and private posts. Results paginate up to 1,000 posts per site; narrow the range if the app reports truncation. Plugins and account permissions can restrict what is visible.

LAUNCH ALL selected sites opens their WordPress admin posts screens. LAUNCH ALL matching posts opens the edit screen for every displayed match. Allow pop-ups for this app if needed; individual links remain available. Your normal browser sessions handle WordPress login; Application Passwords are never passed to browser tabs.

**In-app editing/overwriting is deliberately deferred until the two-site draft workflow is proven.** Search and direct WordPress editing are available now. Planned update support will target existing post IDs, retain original snapshots, detect remote modifications and require explicit overwrite confirmation. Publishing and scheduling are also deferred.

## Retry and recovery

`data/state/` journals each site + URL + article ID. An exclusive process lock and in-process batch lock prevent concurrent runs sharing the data directory. Writes use temporary files plus rename. Do not run independent copies against the same article/sites.

- Successful posts are skipped on repeat execution, even if the article text changed. The POC never overwrites them.
- Known media is verified and reused after a definite post rejection. Deduplication is scoped to an article/site and file hash plus alt text; matching featured/inline references share an upload.
- A network timeout, malformed success response, server error or interrupted write can leave `pending` or `unknown` state. Another create is blocked for that site. A deterministic slug/filename is a reconciliation aid, not an exactly-once guarantee.
- If a partial run's article or site configuration changes, the app blocks continuation. Restore the saved article/configuration before retrying, or reconcile the partial run manually. Other sites still proceed independently.
- Logs are at `data/logs/events.jsonl`. They record preflight, media/post IDs and URLs, operation and timestamp, article/site and run IDs for writes. Error logs retain safe HTTP status and WordPress error code, not raw plugin response text (which can echo credentials).

For an ambiguous write: stop the app; back up data; inspect the target WordPress Media Library/posts and the matching state JSON. Identify the operation using article slug `publisher-<article-id>`, media filename/hash and time. If the object exists, reconcile its ID/URL into that state record (media status `uploaded`, post status `done` with id/url/editUrl). Only clear a failed/pending record after confirming no object was created. If unsure, leave it blocked. Do not delete the data directory or change the article ID to bypass a block. There is no automatic rollback or automatic orphan-media deletion.

A crash leaves `data/server.lock`. Confirm the previous process has stopped before removing just that lock file and restarting. A normal Ctrl+C removes it.

## Security and limitations

- `.env`, config/sites.json and all data are ignored by Git. These are plaintext local files; restrict access, backups and sync. The example env contains no secrets. Revoke Application Passwords when finished testing.
- Application Passwords inherit WordPress account permissions. Draft-only is enforced by this app, not by the credential itself. Use the least privileged practical account.
- Only configured HTTPS targets receive credentials; redirects are rejected. Fix registry URLs instead of bypassing TLS validation. REST APIs behind alternate routing or restrictive authentication middleware may need configuration outside this POC.
- Preview runs in a sandboxed iframe with a restrictive CSP. Active HTML is rejected, personalization is escaped, URL tokens require HTTPS, and attribute values must be quoted. This is an ordinary trusted editorial HTML tool, not a general HTML sanitizer or rich-text editor. Do not use placeholders in tag or attribute names. WordPress may sanitize HTML further.
- Uploaded media may be publicly accessible even while a post is a draft. Test with non-sensitive images. Image signature checks do not replace WordPress's actual image decoder/validation.
- This app does not fetch remote article images. Use local image placeholders for images that need independent uploads; any literal remote image URLs remain external references.
- No scheduling, production publishing, automatic updates, auto-reconciliation, remote asset cleanup, SEO/plugin fields, native Gutenberg image generation, cross-article deduplication or multi-user operation.
- Read-only preflight cannot prove write success. A site plugin could change status or trigger notifications on draft creation; inspect test results before production use.

## Tests and acceptance

```powershell
node --test
```

Automated tests cover personalized escaping, per-site media, draft-only payloads, restart/repeat behavior, partial failure isolation, ambiguous writes, definite-failure retries, concurrency, credential-safe errors and search filters.

Real-site acceptance requires supplied test URLs, account credentials and author/category IDs. Verify: both sites receive exactly one personalized draft; both images belong to the corresponding site; alt text is preserved; rerunning creates no duplicates; a failed site does not stop a ready site; date/slug search finds the new drafts; launch links reach the intended admin screens. Live overwriting remains a later phase.

WordPress references: [Application Passwords](https://developer.wordpress.org/advanced-administration/security/application-passwords/), [Posts](https://developer.wordpress.org/rest-api/reference/posts/), [Media](https://developer.wordpress.org/rest-api/reference/media/).

For an interactive simulation with two fake WordPress sites, run `node test-support/preview-fixture.mjs` and open http://127.0.0.1:3211. This uses a temporary workspace and intercepts all requests to its fake site hosts; it never contacts real WordPress. Stop with Ctrl+C.

## Affiliate editorial preparation

See [Editorial workflow](docs/EDITORIAL.md). Enable **Prepare affiliate versions** to preserve a source article and ticket rules, export a credential-free AI brief, import unapproved proposals, discover published link candidates/categories, and review each site's title, HTML, category and issues. AI runs in your chosen external tool; nothing is sent to an AI service automatically. The local tagging scan is deterministic.

In editorial mode each selected version needs a current server-side approval before preflight, and every ready version needs a preview before draft creation. Changes invalidate all editorial approvals; approvals and preflight plans expire after 15 minutes. Save workspace or export article JSON before reloading. Approvals are cleared on reload/restart and are never accepted from imported JSON.

The launch button beside Create drafts opens successful or already-created drafts after a run. Existing browser sessions handle sign-in. For Laragon's locally trusted HTTPS certificates, start Node with `--use-system-ca`; TLS verification remains enabled.
