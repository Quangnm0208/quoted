# WordPress Plugin — Manual Test Plan

For Phase 0 acceptance gates. Each test must pass before plugin ships.

---

## Environment matrix

| Env | PHP | WP | Required |
|---|---|---|---|
| A | 7.4 | 6.0 | Min supported — must pass |
| B | 8.1 | 6.2 | Common |
| C | 8.2 | 6.5 | Latest |

Run full plan on each env.

---

## T1 — Fresh install

1. Upload `quoted.zip` via WP Admin → Plugins → Add New → Upload
2. Activate
3. ✓ No PHP errors in `wp-content/debug.log`
4. ✓ "Quoted" menu appears in left sidebar
5. ✓ Auto-redirect to onboarding page

## T2 — Onboarding 8-click flow

Start a stopwatch. Click count must be exactly 8 from upload to dashboard.

1. Click "Activate Plugin" (after upload) — **click 1+2**
2. Paste license + URL → click "Connect" — **click 3**
3. Select niche → click "Continue" — **click 4**
4. Click "Auto-scan now" — **click 5**
5. Click "Test it live" — **click 6**
6. (Auto-advance after placeholder) — **click 7 passive**
7. Click "Go to dashboard" — **click 8**

Total: ≤ 8 active clicks ✓

## T3 — License activation errors

| Input | Expected |
|---|---|
| Empty key | Inline error: "License key is required" |
| `bad_format` | Inline error: "License key format looks wrong" |
| Valid format, wrong domain | Backend returns 403; UI shows "License domain doesn't match" |
| Expired license | Backend returns 410; UI shows "This license has expired" |
| Backend URL invalid | Inline error: "Backend URL is not a valid URL" |

## T4 — Bot detection logging

```bash
# Hit your local site as each bot
for ua in "ClaudeBot/1.0" "GPTBot/1.0" "PerplexityBot/1.0" "Google-Extended" "Bytespider"; do
  curl -A "$ua" http://your-wp-site.local/sample-post/ > /dev/null
done

# Check local table
wp eval "global \$wpdb; \$rows = \$wpdb->get_results('SELECT bot_name, url_path, crawled_at FROM ' . \$wpdb->prefix . 'quoted_bot_log ORDER BY id DESC LIMIT 10'); var_dump(\$rows);"
```

✓ 5 rows in `wp_quoted_bot_log` table.

## T5 — Cron sync

```bash
# Force-run sync cron
wp cron event run quoted_cron_sync_crawls

# Verify backend received
curl -H "Authorization: Bearer $JWT" $BACKEND/api/v1/dashboard/summary
```

✓ `bot_activity.total_crawls_7d >= 5`

## T6 — llms.txt + markdown endpoints

```bash
# llms.txt at root
curl -i http://your-wp-site.local/llms.txt
```
✓ Status 200, Content-Type `text/markdown`, body starts with `# <site name>`

```bash
# REST path also works
curl -i http://your-wp-site.local/wp-json/quoted/v1/llms.txt
```
✓ Status 200

```bash
# Markdown for specific post
curl -i http://your-wp-site.local/wp-json/quoted/v1/llm/sample-post
```
✓ Status 200, body is clean markdown (no `<p>` tags)

```bash
# Non-existent slug
curl -i http://your-wp-site.local/wp-json/quoted/v1/llm/does-not-exist
```
✓ Status 404

## T7 — Plugin conflict checks

Test with each active simultaneously:
- [ ] Yoast SEO — ✓ no duplicate llms.txt
- [ ] RankMath — ✓ no duplicate llms.txt
- [ ] WooCommerce — ✓ no fatal errors
- [ ] Elementor — ✓ no admin clash
- [ ] WP Super Cache — ✓ llms.txt still serves dynamic
- [ ] Wordfence — ✓ bot detection still works

## T8 — Performance budget

```bash
# Without plugin active: measure 10x homepage TTFB
ab -n 50 -c 1 http://your-wp-site.local/ | grep "Time per request"
# Note the value: T_baseline

# With plugin active: measure same
ab -n 50 -c 1 http://your-wp-site.local/ | grep "Time per request"
# Note the value: T_with_plugin

# Delta must be ≤ 50ms
```

## T9 — phpcs (WordPress standard)

```bash
phpcs --standard=WordPress wp-plugin/
```
✓ 0 errors. Warnings acceptable if documented.

## T10 — Security checks

- [ ] All AJAX handlers verify nonce
- [ ] All AJAX handlers check `current_user_can('manage_options')`
- [ ] No `eval()`, `extract()`, `unserialize()` of untrusted data
- [ ] All `$wpdb` calls use `prepare()`
- [ ] Markdown serializer escapes user content properly
- [ ] REST callbacks have proper `permission_callback`

## T11 — Multibyte content

Create a post with title "Hướng dẫn chạy bộ ⚡" and body containing
Vietnamese diacritics, emojis, and CJK characters.

```bash
curl http://your-wp-site.local/wp-json/quoted/v1/llm/huong-dan-chay-bo
```
✓ UTF-8 preserved, no `?` or `???` corruption.

## T12 — Uninstall cleanup

1. Deactivate plugin
2. Click "Delete"
3. ✓ `wp_quoted_bot_log` table dropped
4. ✓ All `quoted_*` options removed from `wp_options`
5. ✓ No `quoted_cron_*` scheduled
6. ✓ All `_transient_quoted_*` removed

## T13 — Disconnect flow

1. Settings → "Disconnect from Quoted"
2. Confirm dialog
3. ✓ JWT cleared
4. ✓ License key cleared
5. ✓ Reload dashboard → onboarding shown again
6. ✓ Backend still has tenant data (not deleted)

---

## Sign-off

| Tester | Env | Date | Pass/Fail |
|---|---|---|---|
| | A | | |
| | B | | |
| | C | | |
