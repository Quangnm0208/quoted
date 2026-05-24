# Quoted — Feature Plan & Biweekly Roadmap (Sprint 1–8)

**Tài liệu:** Kế hoạch sản phẩm sau audit & nghiên cứu thị trường
**Ngày:** 2026-05-23
**Tác giả:** Product Research + CTO/Architect review
**Phiên bản hiện tại:** v0.2.0 (Free-only, standalone, đã rip backend)
**Scope:** 16 tuần (8 sprint × 2 tuần) — từ hôm nay tới ~Q3 2026

---

## 1. Trạng thái sản phẩm (audit ngắn)

### 1.1 Đã ship và chạy được (Free tier v0.2.0)

| Tính năng | File chính | Ghi chú |
|---|---|---|
| `llms.txt` auto-generator | `wp-plugin/includes/class-quoted-llms-txt.php` | Cap 50 posts, transient 5 phút, edge `s-maxage=86400` |
| Markdown endpoint per post | `wp-plugin/includes/class-quoted-markdown.php` | DOMDocument, cache 1h, invalidate on `save_post` |
| Bot detector (14 bots) | `wp-plugin/includes/class-quoted-bot-detector.php` | Substring match ≤2ms, SHA-256 IP hash |
| Allowlist/blocklist + HTTP 403 + robots.txt | `bot-detector.php`, `public/class-quoted-public.php` | Per-bot toggle, blocked = 403 + `Disallow:` |
| Schema JSON-LD (Article + FAQPage) | `wp-plugin/includes/class-quoted-schema.php` | Conflict-aware với 15 SEO plugin |
| Dashboard local (AI Distribution Score + feed) | `wp-plugin/admin/partials/dashboard.php` | Chart.js 4.4.0 bundled, AJAX async |
| 8-click onboarding | `wp-plugin/admin/partials/onboarding.php` | 32 niche, AJAX |
| License Lemon Squeezy direct | `wp-plugin/includes/class-quoted-license.php` | Daily revalidate cron, no backend |

### 1.2 Stub (chưa hoạt động — cần biết)

- **Live AI Test** — backend module trả 501, onboarding step 4 in "coming soon"
- **Citation tracking** — schema có (migration 024), không có poller, dashboard tab paywall teaser
- **Niche benchmark** — field "niche" thu từ onboarding nhưng chưa dùng

### 1.3 Tech debt cần xử lý trước khi build mới

1. **`quoted.php:49-52`** — `PLACEHOLDER-SOLO-VARIANT`, `YOUR-LS-STORE-SLUG` còn nguyên → Upgrade page bị hide. **Block launch Pro.**
2. **`README.md:74`** — note "Chart.js must be manually downloaded" lỗi thời (đã bundle).
3. **DOMDocument hard dependency** — `activator.php:32-39` chỉ in fatal nếu thiếu libxml. Một số shared host (Docker minimal images) sẽ vỡ.
4. **Niche field unused** — debt UI, nợ kỹ thuật cho Phase 3.
5. **Citations schema drift risk** — bảng tồn tại nhưng poller chưa code, dễ lệch khi build sau.

---

## 2. Phân tích cạnh tranh (tóm tắt)

### 2.1 Đối thủ sát nhất

| Đối thủ | Loại | Giá | Bot count | Citation tracking | Vị thế |
|---|---|---|---|---|---|
| **citelayer®** | WP plugin | Free + €79/yr | **62** | Referral only | **Đối thủ #1**, gần Quoted nhất về stack |
| **VigIA** | WP plugin | Free | **55+** | Không | Có "100-point Analyzer" cạnh tranh với Distribution Score |
| **AIOSEO LLMs** | WP plugin | $49+/yr | 0 | Không | Distribution mạnh (~3M sites Yoast/RankMath/AIOSEO) |
| **DarkVisitors** | SaaS + WP | Free → paid | Toàn bộ | Không | Bot detection commodify hoá |
| **Cloudflare AI Crawl Control** | Infra | **Free** | Toàn bộ | Không | 1-click block — đe doạ "free tier" của Quoted |
| **Otterly.AI** | SaaS | $29/mo | N/A | **Có (6 platforms)** | Tier rẻ nhất segment citation |
| **Profound** | SaaS | $399+/mo | N/A | Có (5 LLMs) | Enterprise leader ($96M Series C @ $1B, 2/2026) |

### 2.2 Sáu khoảng trống Quoted có thể chiếm

1. **🥇 Zero-click onboarding** — đây là moat **mạnh nhất** vì cạnh tranh với *thời gian* của user. Bảng setup time:

   | Giải pháp | Setup time | Click required |
   |---|---|---|
   | Claude/Codex DIY | 30 phút – 4h | ~30 prompt + deploy |
   | Yoast wizard | 15–20 phút | 12 tab settings |
   | citelayer | ~5 phút | 5–8 click |
   | VigIA | ~5 phút | 5 click |
   | **Quoted target** | **< 30 giây** | **0 click** (auto-detect niche, auto-enable theo môi trường, default sensible mọi setting) |

   Đây không chỉ là tiện lợi — đây là **lý do mua** đối với marketer/business owner không muốn tốn 30 phút prompt Claude.

2. **Per-bot HTTP 403 + robots.txt sync ở Free tier** — chỉ Quoted có (citelayer/VigIA không có HTTP 403; Cloudflare có nhưng yêu cầu dùng Cloudflare).
3. **Schema JSON-LD conflict-aware với 15 SEO plugin** — switching-cost killer, không đối thủ nào nhấn mạnh.
4. **Citation tracking BYO API key, giá $9–19/mo** — toàn bộ SaaS bundle API cost (Otterly $29 rẻ nhất). BYO key = $0 marginal cost cho Quoted, lời ngay từ user đầu tiên.
5. **GDPR-friendly + local-only + SHA-256 IP hash** — segment EU/healthcare/legal underserved bởi SaaS Mỹ.
6. **Niche benchmark theo industry** (Pro) — Profound/AthenaHQ chỉ phục vụ enterprise. SMB hoàn toàn trống.

### 2.3 Ba mối đe doạ chiến lược cần phản ứng nhanh

- **Bot count gap**: Quoted 14 vs VigIA 55+ vs citelayer 62. **"14 bots" sẽ trở thành điểm trừ** trong review wp.org cuối 2026.
- **citelayer/VigIA đều Free** + đầy đủ stack. Phải ship Pro tier **trong 3–6 tháng** trước khi họ launch Pro.
- **Cloudflare 1-click block + Free** đe doạ value prop của allowlist. Phải khác biệt hoá: **verified bot (reverse DNS) + per-bot 403 vs sweep block**.

---

## 3. Chiến lược 4 tháng tới (CTO + Architect view)

### 3.1 Product strategy

**North star metric:** số WordPress site có ≥1 citation Pro trong 30 ngày sau khi upgrade.

**P0 — nguyên tắc nền tảng (áp dụng mọi sprint, không thương lượng):**

> **Time-to-value < 30 giây. Required clicks sau khi activate = 0.**

Đối thủ thực sự không phải citelayer/VigIA — là **thời gian** của user. Marketer cân nhắc:
- Claude/Codex DIY: 30 phút – 4 tiếng (prompt + debug + deploy)
- Yoast wizard: 20 phút (12 tab settings)
- citelayer/VigIA: 5–8 click setup
- **Quoted target: 0 click sau khi activate** — mọi tính năng tự bật, niche tự detect, schema tự enable

Mọi feature mới phải đáp ứng test: "*Marketer có dùng được mà không đọc doc, không click setting nào không?*" Nếu không → auto-detect, hoặc default sensible, hoặc bỏ.

**Three pillars (đặt trên nền P0):**
- **P1 (Defense)**: Parity bot count + verified-bot detection (đáp Cloudflare/DarkVisitors)
- **P2 (Pro launch)**: Live AI Test + Citation tracking BYO key — đẩy LTV
- **P3 (Moat)**: Niche benchmark opt-in (network effect tăng theo user count)

### 3.2 Architect view — quyết định kiến trúc lớn

**Quyết định 1: Có quay lại backend không?**
- v0.2.0 đã rip backend (standalone) — đẩy được tốc độ ship, không phải lo Fly.io cost cho user dưới 100.
- **Niche benchmark** (Sprint 7) **bắt buộc** cần aggregation backend (anonymous opt-in stats).
- → **Quyết định**: build "**Quoted Insights Service**" mini ở Sprint 7 — không phải full OmniPlug, chỉ 1 endpoint Cloudflare Worker + D1 (free tier đủ ~1k tenants). Tránh quay lại Fly.io/Node.
- Trade-off: thêm 1 surface ops, nhưng vendor lock vào CF chấp nhận được vì stack publisher cũng thường dùng CF.

**Quyết định 2: Mô hình data citation tracking**
- BYO API key → query chạy **trên WP server** (PHP `wp_remote_post`), kết quả lưu **local** trong `wp_quoted_citations` table.
- Lợi: zero infra cost, GDPR-clean (data không rời site).
- Hại: phụ thuộc WP-Cron reliability. Mitigation: fallback một action button "Run now" trong dashboard.

**Quyết định 3: Schema engine v2**
- Tách `Quoted_Schema` thành strategy pattern (`Article_Strategy`, `Product_Strategy`, `HowTo_Strategy`, `BreadcrumbList_Strategy`) — tránh class 500+ dòng.
- Auto-detect post type (`product` → Product, `recipe` → Recipe…) — tăng coverage WooCommerce/recipe blog.

**Quyết định 4: Bot detection v2**
- Giữ substring match cho fast path (≤2ms).
- Thêm **verified bot tier**: reverse DNS lookup chạy **async** (sau khi response gửi đi), cache kết quả 30 ngày. Đánh dấu `verified=true` trong `wp_quoted_bot_log` để dashboard phân biệt thật/giả.
- Bot list move sang `bot-signatures.json` để update không cần release plugin (load từ CDN, fallback bundled).

**Quyết định 5: Zero-click onboarding (P0 enforcement)**
- Activate → mọi default ON, mọi tính năng chạy ngay. Wizard cũ chuyển thành "Customize" link tùy chọn ở sidebar.
- **Niche auto-detect** chạy async trong 5s sau activate: pull 50 post gần nhất, match keyword dictionary 32 niche (bundled `niche-keywords.json`, không cần LLM, ~10ms tổng). Lưu kết quả + confidence; fallback "general".
- **Auto-enable theo môi trường**: WooCommerce active → Product schema ON; recipe post type → Recipe ON; WPML/Polylang → llms.txt per language ON; multisite → per-site activate notice rõ.
- First admin page sau activate = Dashboard "What's working" panel (5 green check), KHÔNG phải wizard. Mỗi check kèm link "Customize" cho user muốn tweak.
- Đo lường: thêm event `quoted_first_value_at` (timestamp khi /llms.txt được serve lần đầu sau activate). Target p50 < 30s.

### 3.3 CTO view — vận hành & rủi ro

- **Release cadence**: 2 tuần/lần, mỗi sprint là 1 minor version (`0.3.0`, `0.4.0`…). wp.org review 2–4 tuần → cần overlap (ship 0.3 trong khi 0.4 đang dev).
- **Quality gate**: phpcs WordPress standard + manual test trên matrix `PHP 7.4×WP 6.0 / PHP 8.2×WP 6.5 / PHP 8.3×WP 6.8`. **KHÔNG ship nếu fail matrix.**
- **Performance budget không đổi**: ≤50ms TTFB overhead, ≤200ms cached llms.txt, ≤2ms bot detect. Mỗi sprint chạy Query Monitor benchmark.
- **Risk register**:
  - Pro launch trễ → mất cửa sổ vs citelayer/VigIA. **Mitigation**: Sprint 4 phải ship Pro thậm chí nếu citation tracking chưa xong (Live AI Test trước, citation sau).
  - WordPress.org reviewer reject schema/auto-defer logic → conservative test trên 5 plugin SEO trước submission.
  - Lemon Squeezy License API outage → 7-day grace period cache, không lock user out.

---

## 4. Roadmap 16 tuần — 8 sprint × 2 tuần

Mỗi sprint có: **Mục tiêu sprint**, **Deliverables**, **Tech notes (Architect)**, **Risk (CTO)**, **Acceptance gate**.

---

### Sprint 0 (1 session ~3–5h, trước Sprint 1) — Reframe + Zero-click onboarding
**Version target:** 0.3.0-alpha
**Theme:** Trả lời câu hỏi "vì sao mua thay vì AI 2-click?" bằng product, không slogan.
**Driver:** prompt `docs/UPGRADE-PROMPT.md` (paste vào session Claude/Codex mới).
**Deliverables tóm tắt:** zero-click onboarding (niche auto-detect + dashboard "What's working" panel), positioning rewrite (citation-first), hero demo (Live AI Test mock), comparison page (`why-quoted.php`), Pro path wire-up test mode.
**Acceptance:** time-to-first-llms.txt ≤ 30s, 0 click sau activate, marketer 60s test pass.

---

### Sprint 1 (Tuần 1–2) — Foundation Cleanup + Bot Parity
**Version target:** 0.3.0
**Theme:** Đóng tech debt, đạt parity bot count trước khi push feature mới.

**Deliverables**
- [ ] Bot signatures mở rộng **14 → 55+** (parity citelayer/VigIA). Source: DarkVisitors public list + provider docs.
- [ ] Tách bot list ra `wp-plugin/includes/data/bot-signatures.json`, loader đọc JSON với schema validate.
- [ ] Fix `quoted.php:49-52` placeholder Lemon Squeezy — đưa thành option settings, không hardcode (operator tự nhập store slug + variant ID, hoặc env constant override).
- [ ] Fix `README.md:74` Chart.js note + dọn note lỗi thời trong CHANGELOG.
- [ ] DOMDocument fallback: nếu thiếu libxml, markdown serializer dùng regex-based fallback (giảm chất lượng nhưng không fatal).
- [ ] Multisite network-activate: thay vì exit, in admin notice giải thích + cho phép per-site activate.

**Tech notes (Architect)**
- JSON loader cache trong static property (load 1 lần/request), schema versioning để tương lai load từ CDN.
- DOMDocument fallback: 1 file `class-quoted-markdown-regex-fallback.php`, behind feature flag.

**Risk (CTO)**
- Risk: thêm 41 bot signatures → tăng substring scan tối thiểu (substring đầu tiên match thì short-circuit). Benchmark trên 100 page load: phải < 3ms.
- Risk: regex fallback markdown chất lượng kém → đánh dấu output header `X-Quoted-Markdown-Fallback: 1` cho debug.

**Acceptance gate**
- [ ] phpcs clean, matrix test 3 combo PHP/WP pass.
- [ ] Bot detect benchmark ≤3ms với 55 bots.
- [ ] Upgrade settings page hiện đúng kể cả khi Lemon Squeezy chưa cấu hình (graceful empty state).

---

### Sprint 2 (Tuần 3–4) — Verified Bot Detection + Markdown Content Negotiation
**Version target:** 0.4.0
**Theme:** Khác biệt hoá bot tracking (thật vs giả) + chuẩn hoá markdown serve.

**Deliverables**
- [ ] **Verified bot tier**: reverse DNS lookup async (sau response). Cache 30 ngày trong `wp_quoted_bot_verified_cache`. Thêm cột `verified` (0/1/null) vào `wp_quoted_bot_log`.
- [ ] Dashboard "Bot Activity Feed" hiển thị badge `Verified` vs `Unverified UA only`.
- [ ] Markdown content negotiation: header `Accept: text/markdown` trên route gốc post → trả markdown thay vì HTML. (Cạnh tranh với "Markdown Content Negotiator" plugin.)
- [ ] Markdown endpoint thêm YAML frontmatter optional: `title`, `date`, `author`, `categories`, `tags` (toggle setting).
- [ ] Onboarding step 4 polish: chuyển "Test it live" stub thành "Send a real ClaudeBot test ping" — simulate locally, hiện kết quả ngay (không cần backend).

**Tech notes (Architect)**
- Reverse DNS: dùng `gethostbyaddr()` của PHP, timeout 1s. Nếu timeout → mark `verified=null` (unknown), retry sau 24h.
- Content negotiation hook: `template_redirect` priority 2 (sau llms.txt priority 1). Check `wp_get_current_user()` không phải bot user → respect human Accept header trước.
- YAML frontmatter: tạo helper `Quoted_Markdown::frontmatter()`, không phụ thuộc thư viện ngoài.

**Risk (CTO)**
- Reverse DNS có thể bị shared host disable → graceful fallback "verification disabled" trong settings.
- Content negotiation có thể conflict với caching plugin (W3 Total Cache, WP Rocket) → test ma trận 3 plugin, document trong FAQ.

**Acceptance gate**
- [ ] Dashboard hiển thị ≥1 verified ClaudeBot trong 7 ngày sau install trên test site.
- [ ] `curl -H "Accept: text/markdown" /sample-post/` trả markdown.

---

### Sprint 3 (Tuần 5–6) — Schema Engine v2 + llms-full.txt
**Version target:** 0.5.0
**Theme:** Mở rộng coverage schema (đặc biệt WooCommerce/recipe) + cạnh tranh AIOSEO/citelayer.

**Deliverables**
- [ ] Refactor `Quoted_Schema` thành strategy pattern.
- [ ] Thêm strategies: `Product` (WooCommerce auto-detect), `Recipe` (recipe post type), `HowTo` (post có ordered list lớn), `BreadcrumbList` (mọi single).
- [ ] llms-full.txt variant: `/llms-full.txt` trả nội dung markdown đầy đủ inline (cạnh tranh AIOSEO LLMs-full). Cap 200KB total, gracefull truncate.
- [ ] Settings: toggle bật/tắt từng strategy + Auto/Always/Never mode mở rộng.
- [ ] Test ma trận: Yoast / RankMath / AIOSEO / SEOPress / Slim SEO / Schema Pro (6 plugin) không duplicate.

**Tech notes (Architect)**
- Strategy interface: `Quoted_Schema_Strategy { public function applies( $post ): bool; public function build( $post ): array; }`.
- llms-full.txt: stream output (không build full string trong memory) để không OOM trên shared host.
- WooCommerce Product strategy: chỉ load khi `class_exists('WooCommerce')`, autoload safe.

**Risk (CTO)**
- WooCommerce site có >5000 products → llms-full.txt vượt cap. Mitigation: pagination `/llms-full.txt?page=2`.
- Recipe schema phức tạp (ingredients, instructions) → ship v1 với basic fields, nâng cấp Sprint 5+.

**Acceptance gate**
- [ ] Google Rich Results Test pass cho Product + Recipe + HowTo + BreadcrumbList trên test post.
- [ ] Không duplicate JSON-LD với 6 SEO plugin.

---

### Sprint 4 (Tuần 7–8) — Pro Tier Launch + Live AI Test
**Version target:** 1.0.0 ← **major version, Pro tier launch**
**Theme:** Mở doanh thu. Đây là sprint quan trọng nhất giai đoạn này.

**Deliverables**
- [ ] **Wire Lemon Squeezy thật**: tạo store, 2 variant (Solo $9/mo, Pro+ $19/mo, hoặc lifetime $99/$249). Update constants/option.
- [ ] **Live AI Test (Pro)**: form trong dashboard, nhập query, plugin POST trực tiếp `api.perplexity.ai` (BYO Perplexity key). Hiển thị câu trả lời + highlight nếu domain user có trong citations.
- [ ] Pro entitlement gate: helper `Quoted_License::has_feature('live_ai_test')` check tier.
- [ ] Pro UI: tab "Live AI Test" + tab "Citations" (lock với teaser nếu chưa upgrade).
- [ ] Upgrade page polish: pricing table, FAQ, badge "BYO API key, $0 marginal cost".
- [ ] Email transactional: welcome khi activate Pro (qua LS webhook → site action hook).

**Tech notes (Architect)**
- Perplexity call qua `wp_remote_post()` với 30s timeout. Catch 401 (invalid key) → graceful error.
- Citation highlight: regex tìm domain trong response markdown, wrap `<mark>`.
- LS webhook: WP REST endpoint `/wp-json/quoted/v1/ls-webhook` verify signature HMAC.

**Risk (CTO)**
- **Pro launch trễ = mất cửa sổ**. Đây là sprint không cho phép trượt.
- Perplexity API thay schema → wrap trong adapter, dễ swap.
- BYO key UX khó (user phải tự đăng ký Perplexity). Mitigation: video 60s hướng dẫn + link affiliate (nếu Perplexity có).

**Acceptance gate**
- [ ] 1 user real (alpha tester) mua Pro thành công, dùng Live AI Test ra kết quả đúng.
- [ ] 0 P0 bug trong 48h sau release.

---

### Sprint 5 (Tuần 9–10) — Citation Tracking v1 (Manual)
**Version target:** 1.1.0
**Theme:** Ship core Pro feature — citation tracking manual mode.

**Deliverables**
- [ ] Schema migration WP-side: tạo `wp_quoted_citations` table (id, query, provider, cited_url, confidence, found_at).
- [ ] Prompt library v1: 40 prompt theo 8 niche cố định (outdoor-gear, finance, ai-tools, recipe, health, fashion, tech, travel). JSON file bundled.
- [ ] Manual run UI: dashboard "Citations" tab, nút "Run citation check now" → fan-out 10 prompt qua Perplexity, parse response, match domain, lưu DB.
- [ ] Domain matcher: exact + www + subdomain + AMP variant + protocol-relative. Confidence 0–1 dựa số match.
- [ ] Citation feed: list 30 ngày gần nhất, filter theo provider/confidence.

**Tech notes (Architect)**
- Domain matcher: helper `Quoted_Domain_Matcher::score($cited_url, $site_url)` — testable unit.
- Prompt library: load JSON với schema validation, niche → prompt template Cartesian product.
- WP-Cron không reliable cho manual run nên dùng AJAX với progress bar (10 prompt × ~3s = 30s acceptable).

**Risk (CTO)**
- User chạy 10 prompt liên tục → tốn $0.20 Perplexity credit của họ. Phải hiển thị **cost estimate trước khi run**.
- False positive nếu domain match quá loose. Conservative: confidence < 0.7 hide, > 0.85 verified.

**Acceptance gate**
- [ ] Trên test site (1 niche outdoor-gear), chạy 10 prompt → match ≥1 citation đúng (manual verify).
- [ ] Cost estimate hiển thị chính xác trước run.

---

### Sprint 6 (Tuần 11–12) — Citation Tracking v2 (Auto + Dedup + Notifications)
**Version target:** 1.2.0
**Theme:** Citation tracking tự động hoá → biến thành moat thực sự.

**Deliverables**
- [ ] Auto-run: WP-Cron weekly, sample 10 prompt từ library theo niche user chọn.
- [ ] Dedup window 7 ngày: hash `(provider + query + cited_url)`, skip nếu đã thấy.
- [ ] Multi-provider fanout: Perplexity primary + Tavily fallback (nếu Perplexity 429/down).
- [ ] Notification: in-admin notice + email (qua WP `wp_mail`) khi có citation mới confidence ≥ 0.85.
- [ ] Citation history view: 12 tháng (Pro), 7 ngày (Free fallback nếu user downgrade).
- [ ] Export CSV citations.

**Tech notes (Architect)**
- Cron event `quoted_cron_citation_poll` tách riêng để debug. Lock với `wp_options` transient để tránh chạy double trên multisite.
- Tavily client adapter — cùng interface với Perplexity (`CitationProvider` contract).
- Email template trong `wp-plugin/admin/partials/emails/` cho dễ override theme.

**Risk (CTO)**
- WP-Cron có thể không fire (site low traffic). Mitigation: thêm "Last run" status + manual trigger fallback.
- Email throttling shared host → batch + 1 email/ngày max.

**Acceptance gate**
- [ ] Trên test site, sau 7 ngày auto-run thấy ≥2 citation, không duplicate.
- [ ] Email notification gửi thành công với template clean.

---

### Sprint 7 (Tuần 13–14) — Niche Benchmark (Quoted Insights Service)
**Version target:** 1.3.0
**Theme:** Network effect moat — opt-in anonymous benchmark theo niche.

**Deliverables**
- [ ] **Quoted Insights Service** (Cloudflare Worker + D1):
  - Endpoint `POST /v1/insights/contribute` — accept anonymous metric (`niche, distribution_score, citation_count_7d, bot_diversity`), không có domain/PII.
  - Endpoint `GET /v1/insights/benchmark?niche=X` — trả percentile 25/50/75/90 cho niche.
- [ ] WP plugin: settings opt-in "Share anonymous stats để xem benchmark" (default OFF).
- [ ] Dashboard: badge "Bạn ở percentile 67 của niche outdoor-gear" (nếu đã opt-in, ngược lại CTA).
- [ ] D1 schema + simple aggregation cron (Worker scheduled trigger).

**Tech notes (Architect)**
- **Tại sao Cloudflare Worker + D1 thay vì quay lại Fly.io/OmniPlug**: free tier đủ cho 100k req/ngày + 5GB DB → đủ cho ~1k–10k tenants. Triển khai 1 file `worker.ts`. Vendor lock chấp nhận được.
- Payload minimal: SHA-256 hash của `site_url + salt` làm `tenant_id` (anonymous, không revert được).
- Rate limit: 1 contribute/site/day, dùng KV store.

**Risk (CTO)**
- Privacy concern → cần legal review trước launch. Mitigation: opt-in default OFF, FAQ rõ ràng, GDPR-clean.
- Cloudflare Worker scale: free tier có thể hit limit nếu viral. Mitigation: monitor, sẵn sàng upgrade ($5/mo Workers Paid).

**Acceptance gate**
- [ ] 5 alpha sites opt-in → backend hiển thị aggregate 5 data points cho niche tương ứng.
- [ ] Privacy policy mới publish, no PII gửi.

---

### Sprint 8 (Tuần 15–16) — Agency/Multi-site License + WP.org Pro Listing
**Version target:** 1.4.0 + submit wp.org major update
**Theme:** Mở rộng segment agency + đẩy distribution.

**Deliverables**
- [ ] Agency tier license: 1 license activate được 30 site (Pro+ existing đã có concept này). Wire UI quản lý "My sites" trong dashboard chính của 1 site.
- [ ] Multi-site report: roll-up dashboard cho agency — list 30 site, distribution score mỗi site, tổng citations.
- [ ] AI-readability Audit (100-point) — competitor parity với VigIA. Scan post hiện tại: headings depth, FAQ presence, schema coverage, llms.txt entry, alt text, internal link density. Trả score + checklist.
- [ ] WP.org listing update: 5 screenshot mới, banner v2, tagline cập nhật "AI-readable WordPress, Free + Pro".
- [ ] Documentation site v1 (Cloudflare Pages + Markdown): quotedeasy.com/docs.

**Tech notes (Architect)**
- Audit engine: tách thành `Quoted_Audit_Checks` array of callable, dễ thêm rule. Mỗi rule trả `{score, weight, message, fix_url}`.
- Agency multi-site: license check key call API `validate_multi` LS endpoint với `instance_id` per site.

**Risk (CTO)**
- wp.org review reject (đã ship lần đầu ok, nhưng major update có thể bị soi lại). Mitigation: pre-review qua plugin-check tool.
- Audit feature trùng concept VigIA 100-point — phải khác biệt rõ (Quoted audit có **fix-it CTA** dẫn tới action cụ thể, VigIA chỉ score).

**Acceptance gate**
- [ ] wp.org update approved.
- [ ] 1 agency alpha customer mua Agency tier, quản lý ≥3 site qua dashboard.
- [ ] Audit chạy được trên test site, trả score và 5 fix CTAs.

---

## 5. Tổng hợp roadmap

| Sprint | Tuần | Version | Theme | Outcome chính |
|---|---|---|---|---|
| **0** | **trước S1** | **0.3.0-alpha** | **🥇 Zero-click onboarding + reframe positioning** | **Time-to-value < 30s, 0 click sau activate** |
| 1 | 1–2 | 0.3.0 | Foundation cleanup + bot parity | 55+ bots, dọn tech debt |
| 2 | 3–4 | 0.4.0 | Verified bot + content negotiation | Khác biệt hoá bot tracking |
| 3 | 5–6 | 0.5.0 | Schema v2 + llms-full.txt | Coverage WooCommerce/recipe |
| 4 | 7–8 | **1.0.0** | **Pro launch + Live AI Test** | **Mở doanh thu** |
| 5 | 9–10 | 1.1.0 | Citation tracking v1 (manual) | Core Pro feature |
| 6 | 11–12 | 1.2.0 | Citation tracking v2 (auto) | Moat retention |
| 7 | 13–14 | 1.3.0 | Niche benchmark + Insights Service | Network effect |
| 8 | 15–16 | 1.4.0 | Agency tier + Audit + wp.org update | Mở segment + distribution |

---

## 6. Việc cần user (founder) quyết trước Sprint 1

1. **Pricing Pro**: $9/$19/mo hay $99/$249 lifetime? (Khuyến nghị: $9 Solo / $19 Pro+ / $49 Agency monthly. Lifetime drop sau.)
2. **Lemon Squeezy store**: tạo bây giờ để Sprint 4 kịp wire thật.
3. **Quoted Insights Service** (Sprint 7): chấp nhận vendor lock Cloudflare Workers không? Nếu không → drop niche benchmark khỏi roadmap.
4. **Bot list source**: chấp nhận crowdsource update qua JSON CDN không? Nếu không → mỗi lần thêm bot phải release plugin (chậm 1–7 ngày wp.org).
5. **Branding "Quoted Pro"**: giữ tên hay rebrand? (Khuyến nghị giữ — đã có brand recognition trong v0.2.0.)

---

## 7. Ngoài scope 16 tuần (để cho roadmap Q4)

- Phase 4: Year-in-Review email tự động (cuối năm)
- Vector DB semantic citation matching (giảm false negative)
- Multi-language UI (vi_VN, ja_JP, de_DE)
- Headless WP / Next.js plugin equivalent
- Shopify app port (nếu Pro WP traction tốt)
- Browser push notifications (Phase 1 cũ — drop hoặc defer)

---

**END OF PLAN.**
