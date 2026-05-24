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

> **"Track AI citations cho WordPress — 1/20 giá Profound, không phải tự maintain"**

Thứ tự ưu tiên mới của value prop:
1. **Hero**: Citation tracking với BYO API key ($19/mo vs Profound $399/mo)
2. **Moat thầm lặng**: Hợp đồng maintenance (bot list curated, WP compat, schema conflict matrix 15 plugin, security patch) — thứ AI 2-click không ship
3. **Table stakes**: llms.txt + markdown + schema (vẫn có, nhưng nhắc sau cùng)

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

Tự diễn vai 3 lần:

1. **Marketer mới install plugin**: trong 60 giây từ activate, họ có trả lời được "vì sao trả $19/mo thay vì để Claude build" không? Nếu chưa → iterate copy.
2. **Mở dashboard mới**: "AI citations" có phải con số TO NHẤT? Card maintenance có above-the-fold không?
3. **Click Upgrade**: có landing trên trang so sánh thẳng thắn với DIY (không né tránh) không?
4. **Mở `readme.txt`**: "Track AI citations" có nằm trong 50 từ đầu không? "llms.txt generator" có bị đẩy xuống dưới fold không?

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
