# Quoted — PM Summary (Q2–Q3 2026)

**For:** Dev team + Sales team
**From:** PM
**Date:** 2026-05-24
**Source docs:** `docs/FEATURE-PLAN-2026-Q2-Q3.md`, `docs/UPGRADE-PROMPT.md`
**Status:** v0.2.0 đã ship Free tier wp.org, Pro chưa launch
**TL;DR:** 16 tuần tới ship Pro tier với hero là **zero-click onboarding** (< 30s) và **citation tracking BYO API key** ($19/mo vs Profound $399/mo).

---

# PART 1 — FOR DEV TEAM

## 1.1 North star

**Time-to-first-value (p50) < 30 giây** từ click Activate đến `/llms.txt` được serve.
Mọi sprint phải báo metric này. Nếu regress → block release.

## 1.2 Backlog 16 tuần (8 sprint + Sprint 0)

| Sprint | Tuần | Version | Theme | Status |
|---|---|---|---|---|
| **0** | Pre-S1 (1 session ~5h) | 0.3.0-alpha | 🥇 Zero-click onboarding + reframe positioning | **NEXT** |
| 1 | 1–2 | 0.3.0 | Bot parity 14→55+ + tech debt cleanup | Backlog |
| 2 | 3–4 | 0.4.0 | Verified bot (reverse DNS) + content negotiation | Backlog |
| 3 | 5–6 | 0.5.0 | Schema v2 (Product/Recipe/HowTo) + llms-full.txt | Backlog |
| **4** | **7–8** | **1.0.0** | **Pro launch + Live AI Test (Perplexity thật)** | **Backlog — critical** |
| 5 | 9–10 | 1.1.0 | Citation tracking v1 (manual run) | Backlog |
| 6 | 11–12 | 1.2.0 | Citation tracking v2 (auto cron + email) | Backlog |
| 7 | 13–14 | 1.3.0 | Niche benchmark + Cloudflare Insights Service | Backlog |
| 8 | 15–16 | 1.4.0 | Agency tier + 100-point Audit + wp.org update | Backlog |

## 1.3 Sprint 0 — checklist deliverables (chạy NGAY)

Driver: paste `docs/UPGRADE-PROMPT.md` vào session Claude/Codex mới.

- [ ] **F1 Activator zero-config**: mọi default ON sensible, schedule niche detect 5s sau activate
- [ ] **F2 Niche auto-detector**: pure-PHP, 32 niche × 30–50 keyword EN+VI, < 50ms, no LLM
- [ ] **F3 Env-aware defaults**: WooCommerce → Product schema; Recipe → Recipe; WPML → llms.txt per language
- [ ] **F4 Dashboard "What's working" panel**: 5 green check + setup-time badge "1 click vs Claude 47 min"
- [ ] **F5 Wizard cũ → Optional**: "Customize" link, không auto-redirect
- [ ] **A Positioning rewrite**: readme.txt + dashboard hero + onboarding subtitle
- [ ] **B Hero demo**: Live AI Test mock với 8 niche × 3 query/response hardcoded
- [ ] **C Maintenance moat card**: parse CHANGELOG.md → dashboard
- [ ] **D Comparison page** `why-quoted.php`: row "Setup time" highlight đỏ "30 phút" Claude
- [ ] **E Pro path wire-up**: `QUOTED_LS_TEST_MODE` + `has_feature()` gating

**Acceptance gate Sprint 0** (bấm đồng hồ thật):
1. Activate plugin → 0 click → mở `/llms.txt` → có content thật ≤ 30s
2. Dashboard hero number = "AI citations this month" (không phải Distribution Score)
3. Marketer 60s test: đọc onboarding → trả lời được "vì sao trả $19/mo" trong 1 câu
4. Comparison page có row Setup time
5. `readme.txt` 50 từ đầu có "30 seconds" hoặc "1 click"

## 1.4 Definition of Done (mọi sprint)

- [ ] phpcs WordPress standard clean
- [ ] Matrix test pass: PHP 7.4×WP 6.0 / PHP 8.2×WP 6.5 / PHP 8.3×WP 6.8
- [ ] Performance budget: ≤50ms TTFB overhead, ≤200ms cached llms.txt, ≤2ms bot detect
- [ ] Conflict test với 5 SEO plugin (Yoast / RankMath / AIOSEO / SEOPress / Slim SEO) — no duplicate JSON-LD
- [ ] Time-to-first-value p50 < 30s (metric `quoted_first_value_at`)
- [ ] CHANGELOG.md update + version bump
- [ ] PR description đủ để sales đọc và update talk track

## 1.5 Tech decisions đã chốt

| # | Decision | Lý do |
|---|---|---|
| 1 | KHÔNG quay lại OmniPlug backend | Standalone giữ tốc độ ship, GDPR-clean |
| 2 | Niche benchmark (Sprint 7) chạy trên **Cloudflare Workers + D1**, không phải Fly.io | Free tier đủ 1k–10k tenant, không phải maintain server |
| 3 | Citation tracking = **BYO API key** (Perplexity/Tavily) | $0 marginal cost cho Quoted, lời ngay user đầu, undercut Profound 20× |
| 4 | Bot list move sang JSON CDN (Sprint 1) | Update không cần release plugin (wp.org review 1–7 ngày) |
| 5 | Schema engine refactor strategy pattern (Sprint 3) | Class hiện tại 270 LOC, sẽ vỡ khi thêm Product/Recipe/HowTo |
| 6 | Zero-click onboarding là P0 (Sprint 0 priority) | Cạnh tranh với thời gian user, không phải feature đối thủ |

## 1.6 Open questions blocking — founder decide

| # | Câu hỏi | Block sprint nào | Recommend |
|---|---|---|---|
| Q1 | Pricing Pro: monthly ($9/$19) vs lifetime ($99/$249)? | Sprint 4 | $9 Solo / $19 Pro+ / $49 Agency monthly |
| Q2 | Lemon Squeezy store tạo lúc nào? | Sprint 4 | Tạo ngay sau Sprint 0, để Sprint 4 wire kịp |
| Q3 | Vendor lock Cloudflare Workers cho Insights? | Sprint 7 | Yes, free tier đủ |
| Q4 | Bot list crowdsource qua JSON CDN OK? | Sprint 1 | Yes, GitHub raw + bundled fallback |
| Q5 | Giữ tên "Quoted Pro" hay rebrand? | Sprint 4 | Giữ |

## 1.7 Risk register

| Risk | Impact | Mitigation |
|---|---|---|
| Pro launch trễ → mất cửa sổ vs citelayer/VigIA | Cao | Sprint 4 không cho trượt. Live AI Test trước, citation sau nếu cần |
| WP-Cron không reliable trên site low-traffic | Trung | Manual "Run now" fallback button |
| Perplexity API thay schema | Trung | Adapter pattern, dễ swap |
| Lemon Squeezy License API outage | Thấp | 7-day grace cache |
| wp.org review reject Sprint 8 update | Trung | Pre-review qua plugin-check tool |

---

# PART 2 — FOR SALES TEAM

## 2.1 One-line pitch

> **Quoted là plugin WordPress giúp AI (ChatGPT, Claude, Perplexity, Gemini) đọc và trích dẫn website của bạn — setup 30 giây, không cần code, giá $19/tháng so với $399/tháng của Profound.**

## 2.2 Tier & pricing (đề xuất, chờ founder chốt)

| Tier | Giá | Đối tượng | Hero feature |
|---|---|---|---|
| **Free** | $0 | Blogger / site nhỏ | llms.txt + bot detector + schema + GDPR local-only |
| **Pro Solo** | $9/mo | 1 site, marketer | Live AI Test + Citation tracking (BYO Perplexity/Tavily key) |
| **Pro+** | $19/mo | 5 site, niche owner | + niche benchmark, 12-month bot history, unlimited posts |
| **Agency** | $49/mo | Agency, 30 site | + multi-site dashboard, white-label badge, priority support |

## 2.3 Top 5 objection + cách trả lời

### ❓ "Tôi dùng Claude/Codex 2 click ra plugin tương tự, sao phải mua?"

**Trả lời thẳng**:
> "Đúng. Code dễ. Sản phẩm khác. Anh có thể dành 30 phút prompt Claude + debug + deploy mỗi lần OpenAI thêm bot mới, hoặc trả $19/tháng để có người làm hộ — và còn được **citation tracking** mà Claude không build được trong 2 click vì cần prompt library 32 niche + dedup multi-provider + domain matcher. Cái đó Profound bán $399/tháng. Em bán $19 vì anh tự trả Perplexity API."

### ❓ "Tôi đã có Yoast / RankMath / AIOSEO rồi"

**Trả lời**:
> "Quoted **chạy song song** Yoast, không thay thế. Yoast tối ưu Google bot, Quoted tối ưu AI bot — 2 con khác nhau. Plugin tự detect Yoast đang chạy và **né duplicate JSON-LD**, anh không phải config gì. Đây là tính năng duy nhất trong thị trường có."

### ❓ "Cloudflare free 1-click block AI bot rồi"

**Trả lời**:
> "Cloudflare *block* hết. Quoted cho anh **chọn từng bot** — chặn Bytespider (ByteDance scrape không xin phép) nhưng cho phép ClaudeBot/PerplexityBot (để AI cite anh). Cloudflare không có per-bot allowlist. Và Cloudflare không sinh ra `/llms.txt` hay track citation."

### ❓ "citelayer / VigIA cũng free, có gì hơn?"

**Trả lời**:
> "Free tier ngang nhau. Cái khác là **citation tracking BYO key** ở Pro — citelayer/VigIA chưa có. Và **setup 30 giây vs họ 5 phút** — anh không phải chọn niche, không phải tick bot, plugin tự detect."

### ❓ "$19/tháng đắt vì tôi không biết bao giờ AI cite tôi"

**Trả lời**:
> "Free trial 14 ngày + Live AI Test miễn phí 3 lần ngay onboarding để anh **thấy trước** xem AI có nhắc niche của anh không. Nếu không citation nào trong 30 ngày → refund 100%. Em mất 0 đồng vì anh dùng Perplexity API của anh, không phải của em."

## 2.4 Comparison cheatsheet (in ra 1 trang A4)

| | DIY Claude/Codex | Yoast Premium | citelayer Free | **Quoted Pro $19** |
|---|---|---|---|---|
| Setup time | 30 phút – 4h | 20 phút (12 tab) | 5 phút (5 click) | **30 giây (0 click)** |
| llms.txt auto-gen | ❌ tự code | ✅ Premium $99/yr | ✅ Free | ✅ Free |
| Bot detection | ❌ tự code | ❌ không có | ✅ 62 bot | ✅ 55+ bot (đang scale) |
| Per-bot HTTP 403 block | ❌ | ❌ | ❌ | **✅ duy nhất** |
| Schema không conflict 15 SEO plugin | ❌ tự build | N/A (chính nó) | Partial | **✅ duy nhất** |
| Citation tracking | ❌ | ❌ | Referral only | **✅ 6+ engine** |
| GDPR local-only | Tự lo | Tự lo | ✅ | ✅ |
| Maintenance khi WP/PHP update | Tự lo 2h/quarter | Yoast lo (cho SEO bot) | citelayer lo | **Quoted lo** |
| Giá 12 tháng | $0 + 8h labor ($400+) | $99 | $0 | **$228** ($19×12) |

## 2.5 Demo flow 60 giây

1. **0:00** — Show WordPress admin trống → Plugins → Add New → Search "Quoted" → Install → Activate. *(15s)*
2. **0:15** — Dashboard tự load với **5 green check**: llms.txt live, 47 markdown endpoints, bot detection ON, schema deferring to Yoast, niche detected = "Outdoor gear". *(10s)*
3. **0:25** — Click "Preview /llms.txt" → mở tab mới → thấy file thật với 47 post của họ. *(10s)*
4. **0:35** — Quay lại → click "Try Live AI Test" → gõ câu hỏi niche → 3 giây sau hiện response Perplexity (mock cho demo) với domain họ được highlight. *(15s)*
5. **0:50** — Show "What Quoted maintains for you" card → "Last bot update 3 days ago, Last WP compat WP 6.8, Last security patch v0.2.0". *(10s)*
6. **0:60** — Click Upgrade → landing comparison page. "Anh thấy chưa? 30 giây xong. Claude DIY 30 phút. Đó là $19 anh trả."

## 2.6 ICP — ai mua, ai không

✅ **Mua**:
- Marketer 1–5 site WP, không tự code
- Niche site owner (outdoor / finance / health / recipe) cần AI cite
- SEO agency 10–50 client (Agency tier)
- B2B site Vietnamese cần GDPR-clean (không gửi data ra Mỹ)

❌ **KHÔNG mua (đừng tốn effort)**:
- Dev tech-savvy có 1 site, dư thời gian — sẽ tự build
- Enterprise > $1M traffic — sẽ mua Profound/AthenaHQ
- Site < 10 post — không có content để AI cite

## 2.7 Email template cold outreach

```
Subject: 30 giây để ChatGPT đọc được [site họ]

Chào [name],

Em thấy [site] có ~[X] post về [niche họ]. Hiện tại khi ChatGPT/Claude/Perplexity
crawl, họ bỏ ~90% content vì HTML có ads/nav/JS.

Quoted plugin sinh /llms.txt + markdown sạch tự động → AI parse 10× nhanh
hơn → cite anh nhiều hơn. Setup 30 giây, không cần code.

Free tier đủ dùng forever. Pro $19/mo có Live AI Test xem AI cite anh
khi nào — rẻ hơn Profound 20 lần ($399).

Anh thử Free trên [site]? Link cài đặt: wordpress.org/plugins/quoted

[your name]
```

## 2.8 KPI sales theo dõi

| Metric | Q2 target | Q3 target |
|---|---|---|
| Free install (wp.org) | 500 | 2,000 |
| Pro paid conversion | 2% | 4% |
| Pro MRR | $200 | $1,600 |
| Churn monthly | <5% | <3% |
| NPS (Pro) | >40 | >50 |
| Setup time p50 (tự đo) | < 30s | < 20s |

---

# PART 3 — TIMELINE & MILESTONES (cả 2 team)

```
M1 (June)        M2 (July)       M3 (August)       M4 (September)
│                │               │                  │
S0 ─ S1 ─ S2 ── S3 ── S4 ════ S5 ── S6 ──── S7 ──── S8
              │               ▲                              ▲
              │               │                              │
       Sales start            Pro launch                wp.org major
       outreach Free          $19/mo live               update + Agency
       installers             (KPI start)               tier launch
```

**Hard deadlines:**
- **2026-06-07**: Sprint 0 ship (zero-click + reframe live trên wp.org v0.3.0)
- **2026-07-19**: Sprint 4 Pro launch — $19/mo có người mua thật
- **2026-09-13**: Sprint 8 wp.org major update + Agency tier

**Communication cadence:**
- **Weekly**: dev standup thứ 2, sales review thứ 6
- **Biweekly**: PM update gửi founder cuối mỗi sprint với metric + risk
- **Monthly**: full team retro

---

# PART 4 — DEFINITION OF SUCCESS (đo cuối Q3)

✅ Pro tier ship đúng hạn (1.0.0 vào tuần 8)
✅ Setup time p50 < 30s (đo qua telemetry `quoted_first_value_at`)
✅ 50+ Pro paid customers (MRR ~$1.6k)
✅ Churn < 3%/tháng (citation tracking giữ chân thật)
✅ 2k+ Free install wp.org
✅ Comparison page `why-quoted.php` thành landing nháp cho quotedeasy.com
✅ Insights Service (Cloudflare) chạy với ≥100 opt-in benchmark contributor

---

**Câu hỏi/feedback gửi PM trước thứ 6 tuần này.**
**Founder cần trả lời 5 open questions ở section 1.6 trước Sprint 0 kick-off.**
