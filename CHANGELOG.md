# Changelog

All notable changes to QuotedEasy AI Readiness are documented here. The format
follows [Keep a Changelog](https://keepachangelog.com/), and the project
adheres to [Semantic Versioning](https://semver.org/).

## [0.5.1] — 2026-05-27

### Renamed for WP.org compliance

- Renamed from `Quoted` to `QuotedEasy AI Readiness`. Slug changed to
  `quotedeasy-ai-readiness`. Text domain updated to match.
- All internal class names, constants, option names, REST namespace, AJAX
  actions, CSS/JS handles, and the bot log database table have been renamed to
  the new prefix.
- No behavior changes. Functionality equivalent to 0.5.0.

## [0.5.0] — 2026-05-25

### Free-only WordPress.org build

- **Fully functional with no caps, no license check, no upgrade prompts.**
  Every feature is available to every install.
- **No external services.** All previously planned commercial integrations
  have been removed from this directory release. Nothing leaves your server.
- **Credit in footer is opt-in.** The "AI-ready via QuotedEasy" footer link is
  off by default; enable it under **Settings → Display**.

### Hardened

- `$_SERVER` inputs (User-Agent, REQUEST_URI, forwarded IPs) are sanitized at
  the boundary.
- JSON-LD output is hex-escaped against `<`, `>`, `&`, `'`, `"` so user
  content cannot break out of the inline `<script>` tag.
- `wp_is_xmlrpc_request()` guarded with `function_exists()` for older WP
  bootstraps.
- JS XSS guard, proxy trust opt-in, AJAX returns audited.
- PHP 8.3 verified.

### Improved

- `llms.txt` default cap raised to **1,000** most-recently-modified posts and
  pages. Filterable via `quotedeasy_ai_readiness_llms_txt_post_limit` (pass `-1` for unlimited).
- Per-post Markdown URLs now use `rest_url()` instead of a hard-coded
  `/wp-json/` path, so they survive `rest_url_prefix` filters.
- `/llms.txt` served at `template_redirect` priority 1 to beat
  `redirect_canonical`.
- `/llms.txt` matches with or without a trailing slash.
- Rewrite rule registered before flush in the activator.

### Removed

- Backend coupling (sync module, cron jobs, OmniPlug remnants).
- Pro UI gates, license activation UI, BYO API keys.
- Lemon Squeezy billing integration (rolled back, replaced with a no-account
  open-source workflow).

### Cleaner uninstall

- Deleting the plugin removes the bot log table, all plugin options, and all
  transients in one pass.

### Requirements

- WordPress 6.0+
- PHP 7.4+

## [0.4.1]

- Onboarding fix: completing the wizard now reaches the dashboard.
- JSON-LD escaping hardened.
- Bot log pruning at the 10,000-row cap.
- Various small fixes around plugin packaging.

## [0.3.0]

- Bot catalog expanded from 14 to 60+ signatures.
- Bot detector refactored to a single source of truth.
- FAQ extraction cached per-post.

## [0.2.0]

- First public release.
- AI Crawler Allowlist, Schema engine, dashboard.

## [0.1.0]

- Initial development release.
