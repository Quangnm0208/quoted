# Quoted WordPress plugin v1.0.0 — wp.org submission package

> Đối tượng: chính anh, người upload + duy trì plugin trên wp.org và bán thông qua quotedeasy.com.
> File ZIP đính kèm: `quoted.zip` (144 KB, 35 files).
> Plugin chính: `quoted.php` v1.0.0 (commercial launch).

---

## 1. Plugin là gì (1 dòng)

**Một plugin WordPress nhỏ làm cho website của khách dễ đọc bởi ChatGPT / Claude / Perplexity / Google AI** — tự sinh `/llms.txt`, serve Markdown sạch per-post, detect 60+ AI bot, allow/block từng con bot, tự nhận diện và defer cho SEO plugin đã active (Yoast/Rank Math/AIOSEO/SEOPress) để không trùng schema.

---

## 2. Plugin hoạt động ở 2 chế độ

| Tier | Khách phải làm gì | Cần backend không | Tính năng giới hạn |
|---|---|---|---|
| **Free** | Cài + activate. **Hết.** | ❌ Không gọi gì ra ngoài | 50 post trong `llms.txt`, 7 ngày bot history |
| **Pro / Agency** | Sau khi cài: paste license key trong Settings → Activate | ✅ Gọi `api.quotedeasy.com` | Unlimited posts, 12 tháng history, citation tracking, Live AI Test, multi-site (Agency) |

**Quy tắc vàng cho wp.org:** Free phải dùng được hoàn toàn không có lock paid feature behind a button. Plugin này tuân thủ — toàn bộ Free flow chạy local, không cần network call.

---

## 3. Cấu trúc plugin (35 files trong ZIP)

```
quoted/
├── quoted.php                      ← main plugin file, headers + bootstrap
├── readme.txt                      ← wp.org markup (description, FAQ, changelog)
├── LICENSE                         ← GPL-2.0-or-later (wp.org bắt buộc)
├── uninstall.php                   ← cleanup khi delete plugin
├── includes/
│   ├── class-quoted-core.php       ← orchestrator
│   ├── class-quoted-activator.php  ← activation hook (create wp_quoted_bot_log table)
│   ├── class-quoted-deactivator.php
│   ├── class-quoted-loader.php     ← WP hook helper
│   ├── class-quoted-llms-txt.php   ← /llms.txt generator
│   ├── class-quoted-markdown.php   ← per-post .md endpoint renderer
│   ├── class-quoted-schema.php     ← JSON-LD (Article, FAQPage)
│   ├── class-quoted-bot-detector.php ← UA scan, 60+ bot catalog
│   ├── class-quoted-license.php    ← LS license activation (Pro only)
│   ├── class-quoted-billing.php    ← upgrade page logic (Pro only)
│   └── class-quoted-backend-client.php ← thin HTTP client to api.quotedeasy.com
├── admin/
│   ├── class-quoted-admin.php      ← admin menu + hooks
│   ├── partials/
│   │   ├── dashboard.php           ← AI Distribution Score gauge + recent crawls
│   │   ├── settings.php            ← allowlist + privacy + license input
│   │   ├── onboarding.php          ← first-activation wizard
│   │   └── billing-page.php        ← Pro upgrade CTA
│   ├── css/quoted-admin.css
│   ├── css/billing.css
│   └── js/
│       ├── quoted-admin.js
│       └── chart.umd.min.js        ← Chart.js (BSD-licensed, vendored)
├── public/
│   ├── class-quoted-public.php     ← footer badge + frontend hooks
│   └── class-quoted-rest.php       ← REST routes /wp-json/quoted/v1/*
└── languages/
    └── quoted.pot                  ← i18n template
```

---

## 4. Trước khi upload lên wp.org — checklist tuân thủ

| Yêu cầu wp.org | Trạng thái |
|---|---|
| `quoted.php` có header chuẩn (Plugin Name, Version, License, Text Domain, ...) | ✅ verified |
| `readme.txt` có Stable tag = Version | ✅ cả 2 = 1.0.0 |
| GPL-2.0-or-later license + `LICENSE` file | ✅ |
| Mọi file PHP có guard `defined('ABSPATH') || exit;` (trừ `uninstall.php` dùng `WP_UNINSTALL_PLUGIN`) | ✅ verified |
| Không `eval()` / `base64_decode()` / remote `curl_init()` / `file_get_contents($url)` | ✅ scan clean |
| Không hardcoded API key / secret | ✅ scan clean (`scripts/check-no-secrets.sh`) |
| Không trademark violation (không dùng "WordPress" theo cách độc quyền, không ghép tên với WP) | ✅ plugin tên là "Quoted", description không mạo danh |
| Không phụ thuộc service bên thứ 3 mặc định (Free phải dùng được offline) | ✅ Free tier zero external calls |
| External services declared honestly trong `readme.txt == External services` | ✅ 4 services listed (Quoted backend, LS License API, LS checkout, Perplexity/Tavily BYO) |
| `Tested up to` ≥ WP 6.x hiện tại | ✅ 6.8 |
| `Requires PHP` chính xác | ✅ 7.4 (PHP 8.0–8.3 tested via lint) |
| Translation-ready: text domain + `.pot` file | ✅ `quoted.pot` ở `/languages/` |
| Settings không expose secret / dev URL | ✅ backend URL có default cố định (`api.quotedeasy.com`), có thể override qua `wp option set quoted_backend_url ...` cho self-hosted |
| Uninstall xoá sạch DB option + table | ✅ `uninstall.php` removes `wp_quoted_bot_log` + 25+ options |

---

## 5. Upload lên wp.org — quy trình

### 5.1 Tạo account wp.org (nếu chưa có)
1. <https://login.wordpress.org/register> → username + email
2. Verify email
3. Username sẽ là "contributor" trong `readme.txt` (hiện đang là `nguyenmanhquang`)

### 5.2 Submit plugin lần đầu
1. <https://wordpress.org/plugins/developers/add/> → upload `quoted.zip` (file đính kèm message này)
2. Form điền:
   - **Plugin name:** Quoted — Make your WordPress site AI-readable
   - **Plugin description (≤150 ký tự):** copy từ `readme.txt` line 1 of "== Description =="
   - **Plugin slug:** sẽ thành `quoted` (đảm bảo chưa có ai lấy — check <https://wordpress.org/plugins/quoted/> trước, nếu đã có phải chọn slug khác)
3. Submit → đợi review (thường 7–14 ngày). wp.org team sẽ review code + reply email.

### 5.3 Review feedback (nếu có)
Khả năng cao họ sẽ comment 1 trong các điểm sau (đã pre-empt nhưng vẫn có thể gặp):
- "Pro features behind license — must be opt-in" → đã design vậy, point họ tới readme section "Pro features (available now)"
- "External calls in Free tier" → Free hoàn toàn local, point họ tới "External services" section nói rõ Pro-only
- "Trademark" — "Quoted" generic, không vấn đề

Reply trong vòng 1–2 ngày, polite + factual. Đừng tranh cãi — chỉnh sửa theo yêu cầu.

### 5.4 Sau khi approved
1. wp.org cấp svn repo: `https://plugins.svn.wordpress.org/quoted/`
2. Push code vào `trunk/`:
   ```bash
   svn co https://plugins.svn.wordpress.org/quoted/ ~/quoted-svn
   cp -r wp-plugin/* ~/quoted-svn/trunk/
   cd ~/quoted-svn && svn add trunk/* --force && svn ci -m "v1.0.0 commercial launch"
   ```
3. Tag the release:
   ```bash
   svn cp trunk tags/1.0.0 && svn ci -m "Tag 1.0.0"
   ```
4. Trong khoảng 15 phút, plugin xuất hiện tại `https://wordpress.org/plugins/quoted/`

### 5.5 Mỗi lần update version
1. Bump `Version:` trong `quoted.php` + `QUOTED_VERSION` constant + `Stable tag:` trong `readme.txt` (cả 3 phải MATCH)
2. Thêm `== Changelog ==` entry
3. Thêm `== Upgrade Notice ==` entry (≤300 ký tự, hiện trong WP admin update list)
4. svn checkout, copy files mới vào `trunk/`, `svn ci`, tag `tags/X.Y.Z`

---

## 6. Cấu hình production trước khi public

Trước khi push code lên wp.org, đảm bảo:

| Item | Cần làm |
|---|---|
| `https://api.quotedeasy.com` đang live + green | Bước 3 của `GO_LIVE_GUIDE.md` |
| `https://quotedeasy.com/pricing` live với 4 plan + LS checkout URL hoạt động | Bước 5 + 7 của `GO_LIVE_GUIDE.md` |
| Lemon Squeezy webhook trỏ về `api.quotedeasy.com/api/payments/webhook/lemon-squeezy` | Bước 7 của `GO_LIVE_GUIDE.md` |
| Đã chạy smoke test 11/11 bước từ `GO_LIVE_GUIDE.md` | Bắt buộc trước khi ship plugin |
| `quotedeasy.com/customer.html` live (customer self-service dashboard) | Tự động từ Cloudflare Pages khi anh push frontend |

---

## 7. Customer onboarding flow sau khi cài plugin

Anh hứa "setup 1–2 phút" trong marketing copy. Plugin design support flow này:

```
1. Khách mua tại quotedeasy.com/pricing                       (~30s checkout LS)
   ↓
2. Email từ LS kèm license key (UUID 36 ký tự)               (~10s)
   ↓
3. Khách download plugin từ wordpress.org/plugins/quoted/    (~10s)
   ↓ HOẶC tải từ /customer.html sau khi login
   ↓
4. WP admin → Plugins → Add New → Upload → Activate          (~20s)
   ↓
5. Plugin tự redirect sang wizard `onboarding.php`           (auto)
   ↓
6. Wizard screen 1: Welcome + Skip-or-Connect                (~5s)
   ↓
7. Wizard screen 2: paste license key → Activate              (~15s)
   ↓ Plugin gọi POST api.quotedeasy.com/api/v1/licenses/activate
   ↓ Backend xác minh với LS → trả về activation_token (JWT)
   ↓ Plugin tự gọi POST /api/v1/wp-sites/register → nhận plugin JWT
   ↓
8. Wizard screen 3: Success — license active, site connected,
   first sync running, dashboard link                         (~5s)
   ↓
9. Sau ~1h, hourly cron tự sync posts lên backend            (background)
   ↓
10. Khách thấy bot crawls trong dashboard sau vài ngày (khi
    GPTBot/ClaudeBot/PerplexityBot crawl site)
```

Tổng cố gắng từ click "Pay" → "Connected": **~1.5 phút.**

---

## 8. Customer support — câu hỏi thường gặp

| Câu hỏi từ khách | Trả lời chuẩn |
|---|---|
| "License key sai" | Tìm trong email LS (Subject "Your Quoted license key"). Hoặc login `quotedeasy.com/customer.html` paste key cũ → thấy license short ID. Hoặc liên hệ support. |
| "Đã activate site A, giờ muốn move sang site B" | Plugin Settings → Disconnect → install plugin trên site B → paste cùng license key. Activation limit (Pro = 1, Agency = 5) enforce theo plan. |
| "AI bot không thấy crawl trong dashboard" | Bình thường: AI bot crawl ngẫu nhiên, có thể vài tuần. Verify `/llms.txt` accessible. Verify hosting không block bot UA (một số shared host có WAF rules). |
| "Muốn hủy" | Lemon Squeezy hosted billing portal (link trong `quotedeasy.com/customer.html`). 30-day money-back guarantee. |
| "Schema đã được Yoast emit rồi" | Đúng — Auto mode tự detect, skip Article schema, vẫn emit FAQ schema (Yoast không pick FAQ từ shortcode). Anh có thể "Always" để force, "Never" để skip hoàn toàn. |
| "PHP 8.3 lỗi" | Plugin tested PHP 7.4 / 8.0 / 8.1 / 8.2 / 8.3. Nếu thấy lỗi, gửi screenshot + WP version + PHP version. |
| "Site multibyte (Việt/Nhật/Trung) bị mất ký tự" | Plugin UTF-8 throughout. Test: visit `/llms.txt` — title + excerpt phải có dấu/ký tự đúng. Nếu sai → có thể conflict với 1 plugin khác đang clean charset. |

---

## 9. Marketing copy đề xuất (cho landing page + email khi khách mua)

### 9.1 wp.org plugin description (đã có sẵn trong readme.txt)
Sẵn rồi. wp.org auto-render từ readme.txt.

### 9.2 Email gửi khách sau khi mua Pro
```
Subject: Welcome to Quoted Pro — your license key + 90-second setup

Hi [name],

Your Quoted Pro license is ready:

   License key: XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX

Three steps, about 90 seconds total:

  1. Download the plugin: https://wordpress.org/plugins/quoted/
     (or open WordPress → Plugins → Add New → search "Quoted")
  2. Activate the plugin in your WordPress admin
  3. Paste your license key in the setup wizard → Connect

That's it. Pro features unlock automatically.

See your sites, sync activity, and bot crawls anytime at:
https://quotedeasy.com/customer.html (paste your license key — no separate password)

Manage billing, change plan, or cancel:
[Lemon Squeezy update_payment_url here]

Reply to this email anytime — we typically respond in under 24h.

— The Quoted team
quotedeasy.com
```

---

## 10. Roadmap sau v1.0.0

Các tính năng đã có trong code SaaS backend (v0.6.4) chờ ship qua plugin update:

| Plugin version | Tính năng mới |
|---|---|
| **v1.0.0** (ship now) | License activation, customer dashboard, 1.0 production-ready |
| **v1.1.0** (1-2 tháng sau) | Onboarding wizard refresh (đồng bộ với customer-portal flow). Magic-link "one-click connect" từ success page → plugin auto-activate (giảm setup time xuống <30s) |
| **v1.2.0** | Niche benchmark UI inside plugin. Live AI Test inside plugin (hiện chỉ backend có endpoint). |
| **v1.3.0** | Per-bot allowlist receives new bots auto-pulled from backend (operator add bots remotely without plugin update). |

Bug fix/security: ship anytime với patch version bump.

---

## 11. File đính kèm

- **`quoted.zip`** (144 KB, 35 files) — đây là file anh upload lên wp.org submission form.

Anh KHÔNG cần extract, KHÔNG cần edit. wp.org sẽ accept đúng format này.

---

## 12. Liên kết tài liệu nội bộ liên quan

| Doc | Phần liên quan đến plugin |
|---|---|
| [`docs/LAUNCH-HANDOFF.md`](LAUNCH-HANDOFF.md) | Section 2.5–2.7 customer journey với plugin |
| [`docs/GO_LIVE_GUIDE.md`](GO_LIVE_GUIDE.md) | Step 10 — smoke test thực tế bao gồm cài plugin lần đầu |
| [`docs/SECURITY_THREAT_MODEL.md`](SECURITY_THREAT_MODEL.md) | T10 — plugin compromise + revoke procedure |
| [`docs/INCIDENT_RESPONSE.md`](INCIDENT_RESPONSE.md) | Runbook 7 — broken plugin activation |
| [`scripts/build-plugin-zip.sh`](../scripts/build-plugin-zip.sh) | Tự build lại `quoted.zip` sau khi sửa plugin (PHP lint + secret scan + structural check) |

---

## 13. Tóm tắt 5 dòng

1. **`quoted.zip` 144KB** — upload lên `wordpress.org/plugins/developers/add/`.
2. Plugin v1.0.0 = commercial launch (Free + Pro/Agency activation).
3. Free hoàn toàn local, không gọi network. Pro chỉ active khi khách paste license key.
4. wp.org review thường 7–14 ngày → khi approved, push code vào svn, tag `1.0.0`.
5. Update sau: dùng `scripts/build-plugin-zip.sh` để rebuild, bump 3 chỗ version (`quoted.php` header + constant, `readme.txt` Stable tag), push svn `trunk/` + tag.
