# Upgrade Prompt — Trả lời câu hỏi "vì sao mua thay vì AI 2-click?"

**Cách dùng:** Mở session Claude Code (hoặc Codex) mới có access tới repo Quoted, paste **toàn bộ** phần `## PROMPT` bên dưới vào turn đầu tiên. Prompt tự chứa context, không cần giải thích thêm.

**Mục tiêu của lần chạy này:** biến **câu trả lời** cho "tại sao trả $19/tháng khi Claude/Codex sinh được trong 2 click?" thành **bằng chứng vật lý** trong code + UI + copy, không phải khẩu hiệu.

**Kỳ vọng ship:** 1 commit lớn (~8-15 file thay đổi) trên branch hiện tại, push lên PR #1 hoặc tạo PR mới.

---

## PROMPT

Bạn là Senior Product Engineer kiêm Go-to-Market lead, đang làm việc trên **Quoted** — WordPress plugin tại `/home/user/quoted` (hiện tại v0.2.0).

### Đọc trước (theo thứ tự, không bỏ qua)

1. `docs/FEATURE-PLAN-2026-Q2-Q3.md` ← **quan trọng nhất**, chứa roadmap 16 tuần + 5 gap thị trường + tech debt
2. `wp-plugin/readme.txt` — positioning hiện tại (commodity)
3. `wp-plugin/admin/partials/dashboard.php`, `onboarding.php`, `settings.php` — UI hiện tại
4. `CHANGELOG.md` — track record bug fixes (sẽ dùng làm "maintenance proof")
5. Chạy `git log --oneline -30` để hiểu lịch sử

### Bài toán chiến lược bạn phải giải

Một marketer + business owner hỏi: *"Với Claude/Codex tôi sinh được WordPress plugin trong 2 click. Vì sao tôi trả $19/tháng cho ông?"*

Câu hỏi đó **đúng**. Free tier của Quoted (llms.txt + bot detector + markdown endpoint) đang bị commodify — citelayer/VigIA/AIOSEO ship free, Claude viết được trong 2 prompt.

**Việc của bạn**: làm sao product *tự* trả lời câu hỏi đó — qua code, UI, copy. Không phải slogan, mà bằng chứng.

### Reframe (không thương lượng)

Quoted reposition từ "**Make WordPress AI-readable**" (commodity) sang:

> **"AI-ready WordPress trong 30 giây — track citations với 1/20 giá Profound, không tự maintain"**

Thứ tự ưu tiên mới của value prop:
1. **🥇 Hero**: **Zero-click onboarding** (< 30s, 0 setup click) — cạnh tranh với *thời gian* của user, không phải feature của đối thủ. Claude/Codex tốn 30 phút prompt; Yoast tốn 20 phút wizard; Quoted = 0 click sau activate.
2. **Pro hook**: Citation tracking với BYO API key ($19/mo vs Profound $399/mo)
3. **Moat thầm lặng**: Hợp đồng maintenance (bot list curated, WP compat, schema conflict matrix 15 plugin, security patch) — thứ AI 2-click không ship
4. **Table stakes**: llms.txt + markdown + schema (vẫn có, nhắc sau cùng)

### Deliverables — ship hết trong session này

#### A. Rewrite positioning (ưu tiên cao nhất, ~30% effort)

- **`wp-plugin/readme.txt`**: viết lại đoạn mở + section "What you get free". Citation tracking lên vị trí 1. llms.txt rớt xuống vị trí 4. Lead paragraph phải có câu trả lời 1 dòng cho câu hỏi DIY.
- **`wp-plugin/admin/partials/dashboard.php`**: con số TO NHẤT trên dashboard phải là **"AI citations this month: X"**, không phải Distribution Score. Distribution Score thành card phụ.
- **`wp-plugin/admin/partials/onboarding.php` step 1**: subtitle phải trả lời "vì sao trả tiền" trong 1 câu. Gợi ý: *"The only WordPress plugin that tracks which AI engines cite your content — at 1/20 the price of enterprise tools (Profound, AthenaHQ)."*

#### B. Hero demo — value visible trong 60 giây đầu (ưu tiên cao, ~30% effort)

- Onboarding step 4 hiện đang là stub "coming soon". Thay bằng **"Live AI Test — preview"**:
  - User nhập 1 câu hỏi liên quan niche.
  - Trả về kết quả mock realistic cho 8 niche cố định (outdoor-gear, finance, ai-tools, recipe, health, fashion, tech, travel) — 3 query/response pair hardcoded per niche, đủ chân thực.
  - Highlight nếu domain user **có thể** xuất hiện (mock logic). Banner rõ: *"Sample preview — Connect your Perplexity API key in Pro for real-time testing on your actual content."*
  - CTA "Upgrade to test live" → dẫn tới billing page.
- Đây là "aha moment" — user thấy giá trị trước khi mở ví.

#### C. Maintenance moat — biến cái nhàm chán thành visible (ưu tiên TB, ~15% effort)

- Card mới trong dashboard: **"What Quoted maintains for you"** (collapsible, default expanded lần đầu).
  - Parse `CHANGELOG.md` qua PHP (không lib ngoài) → 3 dòng gần nhất với badge category:
    - 🛡️ Last security patch: v0.2.0 — P1 hardening (XSS guard, serializer safety)
    - 🤖 Last bot list update: 3 days ago (added Meta-ExternalAgent variant)
    - ✅ Last WP compat: tested on WP 6.8 + PHP 8.3
  - Footer card: "*This is the work you don't have to do.*"
- File mới: `wp-plugin/includes/class-quoted-changelog-parser.php` (~80 LOC).

#### D. So sánh thẳng thắn (ưu tiên TB, ~15% effort)

- File mới: `wp-plugin/admin/partials/why-quoted.php`, link từ sidebar Settings.
- Bảng 3 cột: **DIY (Claude/Codex)** | **Free competitors (citelayer, VigIA)** | **Quoted Pro**.
- Rows: citation tracking, bot list maintenance, WP compat patches, schema conflict matrix (15 SEO plugin), GDPR/DPA docs, BYO API key model, time-to-first-citation, 12-month TCO ước tính.
- **Phải honest**: concede DIY thắng ở "tự chủ code"; concede competitors thắng ở "miễn phí"; Quoted chỉ thắng ở "maintenance + citation tracking".
- Đây là pitch deck slide 1 của founder — đặt trong product luôn.

#### E. Wire-up Pro path (ưu tiên thấp, ~10% effort)

- Thêm constant `QUOTED_LS_TEST_MODE` (default `true` trong v0.3.0): Upgrade button hoạt động end-to-end ngay cả khi store Lemon Squeezy chưa live (redirect tới mock checkout page in-plugin).
- Wire `Quoted_License::has_feature($feature)` cho 3 feature: `live_ai_test`, `citation_tracking`, `unlimited_posts`.
- Tất cả paywall teaser hiện tại trỏ về `why-quoted.php` thay vì link external.

#### F. 🥇 Zero-click onboarding — hero feature (ưu tiên CAO NHẤT, ~40% effort, tăng tổng budget)

**Nguyên tắc P0**: required click sau khi activate = **0**. Mọi tính năng tự bật, niche tự detect. Wizard cũ 8-click chuyển thành "Customize" link tùy chọn.

**Sub-deliverables:**

- **F1. Activator zero-config**:
  - Sửa `wp-plugin/includes/class-quoted-activator.php`: set tất cả default sensible (allow all 14 bot, schema Auto, IP hash ON, badge OFF, logging ON).
  - Schedule async niche auto-detect chạy 5s sau activate (`wp_schedule_single_event`).
  - Set option `quoted_first_value_at = current_time('timestamp')` lần đầu /llms.txt được serve (theo dõi metric < 30s).

- **F2. Niche auto-detector** (không LLM, pure PHP):
  - File mới: `wp-plugin/includes/class-quoted-niche-detector.php` (~150 LOC).
  - Bundle: `wp-plugin/includes/data/niche-keywords.json` — 32 niche × 30–50 keyword/niche (EN + Vietnamese). Ví dụ outdoor-gear: `["hiking", "boots", "trail", "running", "shoes", "leo núi", "giày", ...]`.
  - Algorithm: pull 50 published post (title + categories + tags), tokenize (strip stopword EN+VI), match keyword dictionary với TF-IDF đơn giản, pick top niche + confidence (0–1). Fallback "general" nếu confidence < 0.3.
  - Performance: < 50ms tổng, chạy 1 lần sau activate, cache trong option `quoted_detected_niche`.

- **F3. Default ON cho mọi tính năng theo môi trường**:
  - WooCommerce active → `quoted_schema_product = 1` (Sprint 3 sẽ build engine; tạm set flag).
  - Recipe post type tồn tại → `quoted_schema_recipe = 1` (flag).
  - WPML/Polylang active → `quoted_llms_per_language = 1` (flag).
  - Yoast/RankMath/AIOSEO/SEOPress active → đã có logic Auto-defer, OK.

- **F4. Dashboard "What's working" panel** (thay wizard):
  - First admin visit sau activate → redirect tới Dashboard (KHÔNG tới Onboarding).
  - Top of dashboard: panel **5 green check** + link "Customize" mỗi dòng:
    - ✅ `/llms.txt` is live at `<your-site>/llms.txt` → [Preview]
    - ✅ Markdown endpoints active for **47 posts** → [Test sample]
    - ✅ Bot detection running for **14 AI bots** (0 crawls yet — check back in 24h) → [Allowlist]
    - ✅ Schema JSON-LD active (deferring to **Yoast SEO**) → [Override]
    - ✅ Niche detected: **Outdoor gear** (confidence 87%) → [Change]
  - Footer of panel: badge **"Setup time: 1 click. Industry avg: 23 min (Yoast), 47 min (Claude DIY)."**
  - Trên panel này mới tới "What Quoted maintains for you" (deliverable C).

- **F5. Onboarding wizard cũ → optional**:
  - Giữ `admin/partials/onboarding.php` nhưng đổi route: chỉ access qua link "Customize" trong dashboard panel, không auto-redirect.
  - Header onboarding đổi: *"Optional setup — Quoted đã chạy. Customize nếu muốn."*
  - Bỏ progress bar (vì đã không phải required flow).

- **F6. Comparison page row mới** (cập nhật deliverable D):
  - Thêm row đầu tiên trong bảng `why-quoted.php`: **"Setup time"** với 4 cột: DIY Claude (30 phút – 4h), citelayer (5 min, 5 click), Yoast (20 min, 12 settings), **Quoted (< 30s, 0 click)**.
  - Highlight đỏ chữ "30 phút" của Claude — để marketer thấy ngay cost-of-time.

### KHÔNG được làm (chống scope creep)

- ❌ Polish UI llms.txt — đã là commodity.
- ❌ Thêm bot signatures mới — đó là việc của Sprint 1 trong roadmap, session khác.
- ❌ Viết blog post / external marketing.
- ❌ Quay lại OmniPlug backend.
- ❌ Refactor schema engine sang strategy pattern (Sprint 3).
- ❌ Gọi Perplexity API thật trong session này (rủi ro cost + key management).
- ❌ Thêm dependencies npm/composer mới.
- ❌ Bất kỳ feature nào KHÔNG trực tiếp giúp trả lời "vì sao mua".

### Acceptance gate — kiểm thử trước khi commit

Tự diễn vai 5 lần:

1. **🥇 Zero-click test (quan trọng nhất)**: Activate plugin → KHÔNG click bất kỳ Continue/Next/Save nào → vào `<site>/llms.txt` → file có content thật từ 50 post của site. Niche option đã có giá trị auto-detect, không phải "Select…". Nếu fail → F1/F2 chưa đúng.
2. **Time-to-value < 30s**: dùng đồng hồ bấm giờ. Từ click "Activate" → /llms.txt serve content đầu tiên ≤ 30s trên test site có 50 post.
3. **Marketer 60s test**: marketer mới install, trong 60s từ activate, có trả lời được "vì sao trả $19/mo thay vì để Claude build" không? Dashboard "What's working" panel phải hiển thị ngay setup time badge "1 click vs Claude 47 min".
4. **Hierarchy test**: con số TO NHẤT trên dashboard = "AI citations this month". "What's working" panel ngay trên đó. Maintenance card above-the-fold. Distribution Score chỉ là card phụ.
5. **Comparison page test**: click Upgrade → landing trang `why-quoted.php` → row đầu tiên trong bảng là "Setup time" với Quoted = 0 click highlighted.
6. **Readme test**: `readme.txt` 50 từ đầu phải có "30 seconds" hoặc "1 click" hoặc "zero-config". "llms.txt generator" bị đẩy xuống dưới fold.

Nếu bất kỳ câu nào "no" → quay lại fix, không commit vội.

### Process

1. Đọc 5 file đầu danh sách trên.
2. Viết plan ngắn (≤200 từ) liệt kê các file sẽ chạm.
3. Edit. Giữ structure hiện tại, không tạo top-level dir mới.
4. `phpcs --standard=WordPress` clean (nếu có).
5. Commit message bắt đầu bằng `feat(positioning):` hoặc `feat(pro-path):` (1 commit lớn ok, miễn message mô tả rõ).
6. Push lên branch hiện tại (đã có PR #1 — sẽ tự update PR).

### Ràng buộc kỹ thuật

- WordPress conventions: `__('text', 'quoted')` mọi UI string, capability check `manage_options`, nonce mọi POST, prepared SQL.
- Vietnamese-facing strings giữ dấu; UI English-first.
- Không dependency JS/PHP mới. Chart.js 4.4.0 đã bundle, dùng lại.
- Backward compatible với option v0.2.0.
- Mọi CSS thêm vào `admin/css/quoted-admin.css` existing, không tạo file mới.
- Mock data Live AI Test: bundle trong `wp-plugin/includes/data/sample-citations.json`, schema rõ ràng.

### Final artifact

Sau khi commit, viết PR description 5-bullet **mà một marketer/business owner đọc xong nói được "OK, câu này trả lời câu hỏi của tôi"**. Nếu không tự tin câu nào trong 5 bullet đó pass test marketer → có nghĩa bạn chưa ship đúng.

---

## Notes for founder (không phải phần prompt)

- Prompt này thiết kế cho **1 work session ~3-5 tiếng** của Claude/Codex. Không boil ocean.
- Sau khi merge PR này, Sprint 1 (bot parity 14→55+) chạy như roadmap đã định.
- Lần chạy kế tiếp dùng prompt riêng cho Sprint 1 — tách session để không nhiễm scope.
- Nếu Live AI Test mock thấy hiệu quả (alpha user feedback OK), Sprint 4 chỉ cần swap mock → Perplexity API thật, không phải redesign UX.
- Comparison page `why-quoted.php` chính là **landing page nháp** — copy từ đó dùng được cho quotedeasy.com homepage hero.
