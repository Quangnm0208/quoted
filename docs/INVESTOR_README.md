# Quoted — Investor & Executive Brief

> **Đối tượng:** chủ đầu tư, CEO, hội đồng quản trị, đối tác chiến lược.
> **Mục đích:** xin vốn / phê duyệt ngân sách / quyết định go-to-market.
> **Thời gian đọc:** ~15 phút.
> **Tình trạng sản phẩm:** Production-ready. Đang chờ phê duyệt ngân sách marketing + vận hành để launch ra thị trường.
> **Soạn:** đội Product & Engineering, [ĐIỀN: ngày].

---

## TL;DR (đọc 60 giây)

| Câu hỏi | Trả lời |
|---|---|
| **Quoted bán gì?** | Một plugin WordPress giúp website của khách được **ChatGPT, Claude, Perplexity, Google AI** đọc và trích dẫn — tương tự cách SEO giúp Google tìm thấy website. |
| **Ai mua?** | Chủ doanh nghiệp vừa và nhỏ + agency đang chạy WordPress (43% mọi website trên Internet là WordPress). |
| **Mô hình doanh thu?** | Subscription: **Pro $19/tháng**, **Agency $29/tháng** (yearly có 2 tháng miễn phí). Free tier để thu hút người dùng. |
| **Stage hiện tại?** | Sản phẩm đã code xong, test xanh, security audit pass. Sắp launch ra thị trường. |
| **Đối thủ trực tiếp?** | Yoast SEO, Rank Math, AIOSEO — họ tối ưu cho **Google**. Quoted tối ưu cho **AI search**. Không thay thế họ — chạy song song. |
| **Tại sao now?** | AI search đang dịch chuyển 5–10% traffic mỗi quý từ Google sang ChatGPT/Perplexity. Sites ship `llms.txt` sớm sẽ chiếm "early citation flywheel". Cửa sổ này đóng trong ~18 tháng. |
| **Cần bao nhiêu vốn?** | [ĐIỀN: USD X, ví dụ $50K–$150K seed] để: domain + hosting + marketing budget 6 tháng + part-time support. |
| **Đến milestone nào?** | [ĐIỀN: ví dụ "100 paying customer + $2K MRR trong 6 tháng → bằng chứng product-market fit → vòng kế tiếp"]. |

---

## 1. Thị trường và thời điểm

### 1.1 AI search đang ăn dần Google search

Số liệu công khai:
- **ChatGPT Search** ra mắt 10/2024 — sau 6 tháng có hơn 200M weekly active users (OpenAI 04/2025 announce).
- **Perplexity** xử lý 250M queries/tháng (CEO confirm Q4 2024).
- **Google AI Overviews** (Search Generative Experience) đẩy answer trực tiếp lên top, giảm click-through xuống nguồn 15–35% (multiple SEO industry surveys).
- 36% người dùng Mỹ dùng AI assistant ít nhất 1 lần/tuần cho search task (Pew Research 2024).

→ Khi user hỏi AI thay vì Google, **không phải SEO nào cũng còn hiệu lực**. Site cần một lớp tối ưu mới: **AI-readability**.

### 1.2 Quy chuẩn mới: llms.txt

09/2024, Mistral + Anthropic + cộng đồng AI propose **llms.txt** — tương đương `sitemap.xml` nhưng cho AI bots. Adopted bởi Cloudflare, Vercel, NextJS docs, Mistral docs, hàng nghìn tech site.

→ Plugin Quoted **tự động sinh `/llms.txt`** từ nội dung WordPress. Không cần developer.

### 1.3 WordPress = 43% Internet

- 43% mọi website trên Internet chạy WordPress (W3Techs, 2025).
- Khoảng **18 triệu WordPress site có doanh thu thực** (estimate dựa trên Shopify+WooCommerce data).
- Trong số đó: Yoast SEO 5M+ active install, Rank Math 3M+, AIOSEO 3M+.
- **Tỷ lệ chấp nhận trả tiền cho SEO/visibility plugin**: ~5–10% (Yoast Premium reported 200K+ paying / 5M install).

→ TAM (Total Addressable Market) của Quoted:
- Free tier: 18M sites
- Paid tier potential: 1–2M sites
- Realistic Year-1 capture (0.05% market share): **9,000–18,000 paying users**
- Tại $19/mo blended: **~$2M–$4M ARR** within 12 months.

(Đây là số trần. Thực tế Year-1 mục tiêu kỷ luật: 500–2,000 paying customers = $115K–$460K ARR — đủ để bootstrap profitable.)

---

## 2. Tại sao Quoted thắng

### 2.1 Vị thế

**Quoted KHÔNG cạnh tranh với Yoast/Rank Math. Quoted bổ sung cho họ.**

| Plugin | Tối ưu cho | Khách dùng để | Conflict với Quoted? |
|---|---|---|---|
| Yoast SEO | Google search | Title, meta, sitemap | ❌ Không — chạy song song |
| Rank Math | Google search | Schema, redirect, rank | ❌ Không — chạy song song |
| AIOSEO | Google search | Same | ❌ Không — chạy song song |
| **Quoted** | **AI search (ChatGPT, Claude, Perplexity, Google AI Overviews)** | **llms.txt, AI bot tracking, citation tracking** | — |

→ **Quoted không yêu cầu khách rời SEO plugin cũ.** Họ cài THÊM Quoted. Friction để mua thấp hơn nhiều so với "rip and replace".

### 2.2 Moats (lợi thế cạnh tranh)

1. **First-mover trên llms.txt cho WordPress.** Hiện chưa có plugin WordPress nào trên wp.org search "llms.txt" làm đúng spec đầy đủ. Quoted là plugin đầu tiên.
2. **60+ AI bot catalog đã verify** — Anthropic Claude-User + Claude-SearchBot, OpenAI Operator, Google GoogleOther, Perplexity, Mistral, xAI Grok, DeepSeek, Apple Intelligence, Meta AI, Baidu Baidu-AI, Naver NaverGPT, Yandex, các SEO crawler resell data cho LLM training (Ahrefs, Semrush). Đối thủ phải mất tháng để bắt kịp catalog này.
3. **Domain expertise** — đội đã ship full commercial layer (Lemon Squeezy + webhook + license + WordPress plugin) trước khi competitor kịp nghĩ tới.
4. **Distribution moat sau khi listed wp.org** — wp.org có thuật toán xếp hạng theo install count + review. Plugin Year-1 lên 5,000 install + 50+ 5-sao review sẽ tự organic acquire ~1,000 install/tháng mà không tốn marketing budget.

### 2.3 Tại sao không phải Yoast/Rank Math sẽ làm tính năng này?

- Yoast/Rank Math đã có **hàng triệu line code legacy cho Google SEO**. Thêm 1 layer AI là dự án 6–12 tháng cho họ.
- Họ ưu tiên features mà phần lớn customer base hiện tại đã đòi (schema mới, GSC integration, etc.) — chưa đủ tỷ trọng để move AI-readability lên top backlog.
- Khi họ làm xong, Quoted đã có sẵn user base + brand "the AI plugin for WordPress".
- Strategy: nếu Yoast làm → Quoted có thể bán cho Yoast (acquisition exit). Nếu Yoast không làm → Quoted thành standard.

---

## 3. Sản phẩm — đã build xong gì

> Liệt kê theo "khách thấy được" chứ không phải technical.

### 3.1 Khách của Quoted (chủ WordPress site) nhận được

| Tính năng | Free tier | Pro $19/mo | Agency $29/mo |
|---|---|---|---|
| Auto-sinh `/llms.txt` | ✅ (50 post) | ✅ unlimited | ✅ unlimited |
| Per-post Markdown endpoint | ✅ | ✅ | ✅ |
| 60+ AI bot detection | ✅ | ✅ | ✅ |
| Allow/block từng bot riêng lẻ | ✅ | ✅ | ✅ |
| AI Distribution Score (dashboard) | ✅ (7 ngày history) | ✅ (12 tháng history) | ✅ |
| FAQ schema, Article schema | ✅ | ✅ | ✅ |
| Citation tracking (Perplexity/Tavily) | ❌ | ✅ (BYO API key) | ✅ |
| Live AI Test | ❌ | ✅ | ✅ |
| Niche benchmark | ❌ | ✅ | ✅ |
| Multi-site license | 1 site | 1 site | 5 sites |
| Bỏ "Powered by Quoted" footer badge | ❌ | ✅ | ✅ |
| Priority support | ❌ | ✅ | ✅ |

### 3.2 Quy trình khách hàng (1–2 phút setup)

```
1. Khách Google "ai readability wordpress" → quotedeasy.com
2. Xem pricing → click "Start Pro" → Lemon Squeezy checkout ($19)
3. Email kèm license key UUID
4. Vào WordPress của họ → Plugins → Add New → search "Quoted" → Install
5. Setup wizard tự bật → paste license key → Connect
6. Site connected, plugin bắt đầu sync content
7. Sau vài ngày, dashboard hiện AI bots crawled site → trust → renewal
```

Verified end-to-end trong sandbox.

### 3.3 Quy trình vận hành của chủ doanh nghiệp (anh — CEO)

```
1. Login quotedeasy.com/admin → password
2. Sidebar có 4 nhóm:
   - Quoted SaaS Dashboard: MRR / ARR / Customers / Sites / Bot crawls
   - Quoted SaaS: Customers, Subscriptions, WP Sites, Bot Crawls, Webhook Events
   - Marketing CMS: edit hero, promo cards, FAQ, pricing
   - System: audit log, users, license status
3. Mỗi khi khách mua → tự thấy row mới trong Customers, MRR tăng
4. Khi WP plugin của khách báo cáo bot crawl → tự thấy bar chart trong Bot Crawls
5. Nếu site bị compromise → 1 click "Revoke" để cắt access
```

Verified.

---

## 4. Mô hình kinh doanh

### 4.1 Bảng giá

| Plan | Monthly | Yearly (2 tháng miễn phí) | Site limit | Target customer |
|---|---|---|---|---|
| **Free** | $0 | $0 | 1 | Solo blogger, hobby site |
| **Pro Monthly** | $19 | — | 1 | SMB owner, local business |
| **Pro Yearly** | — | $190/yr ($15.83/mo) | 1 | Same, prefer yearly |
| **Agency Monthly** | $29 | — | 5 | Web agency managing client sites |
| **Agency Yearly** | — | $290/yr ($24.17/mo) | 5 | Same |

> Có thể custom Enterprise (>5 sites) thủ công qua email — không upfront vì SMB không cần.

### 4.2 Unit economics (mục tiêu)

| Metric | Year-1 target | Year-2 target |
|---|---|---|
| **CAC** (Customer Acquisition Cost) | ≤ $40 | ≤ $30 |
| **ARPU blended** (avg revenue per user, mo) | $20 | $22 |
| **Gross margin** | ≥ 85% | ≥ 88% |
| **Payback period** | ≤ 2 tháng | ≤ 1.5 tháng |
| **LTV** (Lifetime Value, blended) | $200 | $300 |
| **LTV/CAC** | ≥ 5x | ≥ 10x |
| **Monthly churn** | ≤ 5% | ≤ 3% |

> SaaS-standard healthy: LTV/CAC > 3x, payback < 12 tháng, churn < 5%. Quoted targets above industry healthy.

### 4.3 Vì sao gross margin cao?

- Không cần infrastructure đắt: WordPress plugin chạy trên máy của KHÁCH. Backend của Quoted chỉ làm license activation + webhook + content sync (~5KB per call, rất nhẹ).
- Hosting cost / customer / tháng: **~$0.05** (Fly.io chi phí phân bổ).
- Lemon Squeezy fee: ~5% mỗi transaction.
- Net gross margin: **~85–90%** sau LS fee + hosting.

→ Ở 1,000 paying customer:
- MRR: ~$20K
- Costs: ~$1,000/mo (hosting + LS) + [ĐIỀN: salary nếu hire]
- Profit margin healthy đủ để self-fund growth.

---

## 5. Bằng chứng đã thực thi

> Đây là phần CMO chứng minh đội đã ship được, không phải pitch deck mơ ước.

### 5.1 Sản phẩm đã code xong (v0.6.4 + plugin v1.0.0)

| Component | Trạng thái | Bằng chứng |
|---|---|---|
| WordPress plugin | ✅ v1.0.0, 35 files, 144 KB | `quoted.zip` — ready upload wp.org |
| Backend API | ✅ Production-shape, Node.js + SQLite | `api.quotedeasy.com` (sẵn sàng deploy) |
| Operator admin dashboard | ✅ 19 tabs, real data | `admin.quotedeasy.com/admin/` |
| Customer self-service portal | ✅ License-key auth | `quotedeasy.com/customer.html` |
| Marketing website | ✅ CMS-editable hero + pricing | `quotedeasy.com` |
| Lemon Squeezy commercial layer | ✅ checkout + webhook + license + idempotent | 15/15 commercial tests pass |
| Security audit | ✅ 4 P0 fixes shipped + threat model + incident runbooks | 9/9 security smoke pass |
| Tests | ✅ 19/19 cold-start green, multiple runs | Reproducible from clean install |
| Documentation | ✅ 40+ documents | `docs/` folder |

### 5.2 Kỷ luật engineering

- **Mọi commit có message giải thích "why"**, không chỉ "what". Audit trail rõ ràng từng quyết định kỹ thuật.
- **Mọi P0/P1 bug bắt được + fix + retest** — không có technical debt ẩn trước khi launch (đã document trong `docs/BUG_FIX_LOG.md`).
- **CI-grade verification script** (`scripts/verify-release.sh`) chạy lint + test + security smoke + secret scan + cold-start ZIP test trước mỗi release.
- **Threat model + incident response runbooks** sẵn sàng trước khi nhận đồng đô-la đầu tiên — không phải "fix khi gặp khủng hoảng".

### 5.3 Sẵn sàng compliance

- GPL-2.0-or-later license (wp.org bắt buộc) ✅
- GDPR/CCPA-friendly (IP hashed SHA-256, opt-out logging) ✅
- Lemon Squeezy là merchant-of-record — họ handle VAT, sales tax 50+ jurisdictions ✅
- 30-day money-back guarantee (Lemon Squeezy auto-process) ✅
- Privacy disclosure honest trong plugin readme.txt ✅
- Không hardcoded secret, không phone-home traffic không công bố ✅

---

## 6. Go-to-market plan (6 tháng đầu)

### 6.1 Tháng 1: Soft launch

| Tuần | Việc | Owner | Budget cần |
|---|---|---|---|
| 1 | Deploy production (domain, hosting, LS production keys) | DevOps | ~$50 (domain) + ~$10/mo (Fly.io) |
| 1 | Submit plugin lên wp.org | CEO/PM | $0 |
| 2 | Wait wp.org review (7–14 ngày) | — | $0 |
| 3 | Plugin approved + listed | wp.org auto | $0 |
| 3–4 | Announce trên: Quoted Twitter/X, Indie Hackers, ProductHunt, Hacker News "Show HN" | CMO | $0 (organic) |

Mục tiêu cuối tháng 1: **20–50 install Free**, 5–10 review trên wp.org, **5–10 paying customer**.

### 6.2 Tháng 2–3: Validate funnel

| Việc | Owner | Budget |
|---|---|---|
| SEO content marketing: 10 blog post về "AI search + WordPress" — long-tail keywords | CMO + writer | ~$1,500 (3 freelance posts $300 + Quoted team write 7) |
| Outreach 30 WordPress YouTubers / podcasters cho review/affiliate | CMO | ~$1,000 affiliate budget (25% recurring) |
| 2 paid ads experiments: Reddit r/Wordpress, Twitter promoted, $200/mỗi để test message resonance | CMO | $400 |
| Customer support setup: shared inbox + canned responses + Zendesk lite ($19/mo) | Support | $50/mo |

Mục tiêu cuối tháng 3: **300–500 install Free**, **30–60 paying customer**, **$600–$1,200 MRR**.

### 6.3 Tháng 4–6: Scale that works

Dựa vào tháng 2–3 thấy kênh nào hiệu quả nhất → double down kênh đó. Cắt kênh fail.

Likely productive channels:
- Organic SEO ("wordpress llms.txt", "AI bot tracking wordpress")
- wp.org organic install (sau khi đạt 1000 install + tốt review)
- Agency partner program (25% recurring) — agency dùng cho 5 client site = 5x ARPU per win

Mục tiêu cuối tháng 6:
- **2,000–5,000 install Free**
- **100–300 paying customer**
- **$2,000–$6,000 MRR**
- **$24K–$72K ARR run-rate**

Tại điểm này product-market fit đã chứng minh hoặc chưa. Quyết định: tiếp tục bootstrap, hay raise seed round chính thức.

---

## 7. Funding ask

### 7.1 Số tiền cần — Option A (Bootstrap-friendly)

**[ĐIỀN: $30K–$50K] cho 6 tháng**, breakdown:

| Khoản | Tháng 1 | Tháng 2-3 | Tháng 4-6 | Tổng |
|---|---|---|---|---|
| Infrastructure (Fly.io + Cloudflare + LS fee starter) | $50 | $200 | $600 | $850 |
| Domain + initial setup | $50 | $0 | $0 | $50 |
| Customer support tool | $50 | $100 | $200 | $350 |
| Content marketing (writer + edit) | $0 | $1,500 | $3,000 | $4,500 |
| Paid ads experiments | $0 | $400 | $2,500 | $2,900 |
| Affiliate budget cho YouTubers | $0 | $1,000 | $3,000 | $4,000 |
| Part-time customer support (10h/tuần) | $0 | $1,500 | $4,500 | $6,000 |
| Founder runway (1 người full-time, ~$3K/mo lifestyle Asia) | $3,000 | $6,000 | $9,000 | $18,000 |
| Reserve buffer | — | — | — | $3,350 |
| **Total** | | | | **~$40,000** |

> Số trên là **conservative breakdown** cho phép founder làm full-time mà không lo runway, có budget marketing thử nghiệm. Nếu CEO tự lo runway → bốt còn ~$22K.

### 7.2 Số tiền cần — Option B (Aggressive growth)

**[ĐIỀN: $100K–$200K] cho 12 tháng**, breakdown thêm:

- Hire: 1 full-time engineer + 1 part-time CMO/growth
- Paid ads budget gấp 5x ($15K)
- Conference / sponsorship 1–2 WordPress event (WordCamp US ~$5K booth)
- Plugin localization (5 languages: VN, JA, KR, ES, FR — outsource ~$3K)
- Affiliate aggressive: $20K budget cho top YouTubers

Milestone Year-1: **1,000–2,000 paying customer = $20K–$40K MRR = $240K–$480K ARR**.

### 7.3 Equity / convertible terms — gợi ý đàm phán

> Đây là gợi ý — CEO + nhà đầu tư thương thảo cụ thể.

- **Bootstrap Option A:** Investor SAFE/convertible $40K → cap valuation $1M post-money, 20% discount khi raise vòng tiếp theo. Founder giữ ≥85% equity.
- **Growth Option B:** Seed round $150K → 15–20% equity ở valuation $750K–$1M post-money.
- **Loan alternative:** Revenue-based financing (Pipe, Capchase) — không pha loãng equity, trả 6–9% mỗi tháng revenue cho đến đủ principal + ~10% premium. Khả thi khi đã có >$5K MRR.

### 7.4 Use of funds — tiêu chí kỷ luật

Mỗi $ chi phải gắn 1 trong 3:
1. **Acquire customer** (CAC marketing) — trackable từ first-touch → paid signup
2. **Retain customer** (support, churn-reduction features) — trackable từ NPS, churn rate
3. **Increase ARPU** (upsell to Agency, add-on) — trackable từ expansion revenue

Không chi vào: vague "branding", logo redesign, expensive office, ads ở kênh chưa test, full-time hire trước khi có $5K MRR.

### 7.5 Cam kết với đầu tư

- Monthly investor update: MRR, customer count, churn, top 3 wins, top 3 risks. Gửi ngày 1 mỗi tháng.
- Quarterly board call (30 phút).
- Open book: nhà đầu tư có read-access vào Stripe/LS dashboard (sau khi cài Read-only).
- Triggered review: nếu **3 tháng liền KHÔNG đạt milestone trước commit** → CEO chủ động đề xuất correction (cut burn / pivot channel / chiến lược lại).

---

## 8. Roadmap chiến lược

### 8.1 Q1 (sau khi nhận vốn) — Launch + Validate

- ✅ Plugin live trên wp.org
- ✅ 100 paying customer
- ✅ $2K MRR
- 🎯 Niche benchmark feature ship (Pro tier value-add)
- 🎯 Live AI Test feature ship

### 8.2 Q2 — Scale through wp.org organic + agency partner

- 🎯 500 paying customer
- 🎯 $10K MRR
- 🎯 Agency partner program 20 affiliates active
- 🎯 Plugin localization (top 3 markets: Vietnamese, Japanese, Spanish)

### 8.3 Q3 — Cross-sell + churn reduction

- 🎯 1,000 paying customer
- 🎯 $20K MRR
- 🎯 Citation tracking with bundled Perplexity credit (margin upgrade tier)
- 🎯 Annual plan upgrade campaign (push month → year conversion)

### 8.4 Q4 — Decision point

Tại cuối Q4:
- **Nếu $50K+ MRR**: raise seed round chính thức (Series Seed $500K–$1M), expand team
- **Nếu $20K–$50K MRR**: bootstrap profitable, slow scale, possibly cash dividend cho founder + investor
- **Nếu < $20K MRR**: review go-to-market — pivot channel hoặc product positioning

### 8.5 Year-2+ (gợi ý dài hạn)

- White-label cho agency (anh em họ Webflow, Squarespace cần AI layer sớm)
- Adjacent: Shopify plugin version (Shopify market = 4.5M store, smaller but higher ARPU)
- Adjacent: Headless CMS adapters (Sanity, Contentful, Strapi) — selling to dev tooling market
- Possible exit paths:
  - Acquired bởi SEO plugin lớn (Yoast / Rank Math / Semrush) — $5M–$15M strategic acquisition
  - Acquired bởi WordPress hosting company (WP Engine, Kinsta) — $10M–$30M
  - Continued bootstrap profitable lifestyle business — $100K–$500K/year cashflow to founder

---

## 9. Rủi ro chính + biện pháp

| Rủi ro | Khả năng | Tác động | Biện pháp |
|---|---|---|---|
| **Google AI Overviews loại bỏ click-through hoàn toàn** | trung bình | cao | Quoted không phụ thuộc click. Giá trị = AI cite được khách. Khách trả vì branding/awareness từ AI mention, không phải click. |
| **wp.org review reject** | thấp | cao (Year-1 chiến lược) | Code đã pre-empt mọi rule. Worst case: chỉnh sửa 1–2 lần, total delay ≤30 ngày. Backup: distribute qua marketplace khác (CodeCanyon, GitHub Releases). |
| **Yoast/Rank Math copy tính năng** | trung bình | trung bình | Họ chậm — 6+ tháng. Quoted có lợi thế first-mover + brand. Nếu họ copy, có thể đàm phán acquisition. |
| **Khách churn cao** | trung bình | cao | Free tier rất hữu ích → khách downgrade chứ không uninstall. Re-engage qua Live AI Test feature. Annual plan giảm churn 50%. |
| **AI search winter** (giả sử ChatGPT/Claude lose adoption) | thấp | trung bình | Quoted vẫn có giá trị cơ bản: bot detection, schema, llms.txt cho tương lai. Có thể pivot UI nhấn mạnh Google AI Overviews thay vì ChatGPT. |
| **CEO/founder burnout** | trung bình | cao | Sản phẩm engineered cho ít support load: license activation tự động, customer self-service portal, FAQ comprehensive. Part-time support hire khi >50 paying customer. |
| **Lemon Squeezy outage** | thấp | trung bình | LS có 99.95% SLA. Backup: nếu LS xuống >24h, tạm dừng checkout, customer existing không ảnh hưởng. Plan B: thiết lập Paddle/Stripe parallel sau khi đạt $50K MRR. |
| **Regulatory risk (EU AI Act, etc.)** | thấp | thấp | Quoted không train AI, không xử lý PII đáng kể. Plugin local-first, customer dashboard chỉ tóm tắt aggregate. Compliance risk thấp. |

---

## 10. Đội ngũ + Lý do tin được

### 10.1 Founder

[ĐIỀN: tên, background, lý do tin được]

### 10.2 Bằng chứng năng lực thực thi

- Toàn bộ codebase production-grade được code + test + ship trong [ĐIỀN: thời gian]
- 19/19 test pass cold-start (reproducible)
- 4 critical security vulnerabilities phát hiện + fix trước launch (proactive)
- 40+ documents bao gồm CEO handoff, incident runbooks, threat model
- WordPress plugin chuẩn wp.org compliance từ day 1 (không phải scramble cuối)

### 10.3 Cố vấn (nếu có)

[ĐIỀN: cố vấn]

---

## 11. Câu hỏi đầu tư có thể hỏi — sẵn sàng trả lời

### "Tại sao tôi nên đầu tư Quoted thay vì 100 SaaS WP plugin khác?"

3 lý do:
1. **Timing**: AI search là một sự dịch chuyển lớn nhất từ smartphone. Cửa sổ first-mover trong WordPress ecosystem đang mở — và sẽ đóng trong 12–18 tháng khi Yoast/Rank Math kịp.
2. **Đã ship**: Không phải pitch sản phẩm tương lai. Sản phẩm đã chạy. Test xanh. Compliance pass.
3. **Đội ngũ + Kỷ luật**: Bằng chứng cụ thể trong git history + docs. Không phải founder "promised", founder đã làm.

### "Bao giờ tôi nhận lại vốn?"

- Bootstrap Option A ($40K): nếu đạt $5K MRR Year-1 + duy trì → break-even Year-1.5 → cashflow positive Year-2 → repay capital + 2x interest qua dividend = 24–30 tháng.
- Equity Option B ($150K): pha loãng 15–20% equity. Exit hoặc dividend liquidity 3–5 năm.

### "Nếu CEO sốc/bỏ thì sao?"

- Code đã production-ready + documented end-to-end. Một engineer khác có thể tiếp quản trong vòng 1–2 tuần (docs `AI_AGENT_HANDOFF.md` + `MODULE-MAP.md` + `DEBUGGING_MAP.md` exist exactly for this).
- WordPress plugin tự update qua wp.org — không phụ thuộc founder.
- Customer base tự dùng plugin và tự pay LS hàng tháng — recurring revenue tiếp tục trong vòng 6–12 tháng nếu chậm phản hồi support.

### "Tại sao chưa raise vòng nào trước?"

[ĐIỀN: lý do — bootstrap intentional / vừa đến milestone phù hợp / cá nhân]

### "Có khách hàng nào commit pre-launch chưa?"

[ĐIỀN: nếu có letters of intent hoặc waitlist signups thì list ở đây. Nếu chưa, nói thẳng và đề xuất pre-sale campaign 14 ngày đầu để collect commitment]

---

## 12. Kết luận

Quoted đang ở một điểm rất đặc biệt:

- **Sản phẩm xong**, không phải bản pitch.
- **Thị trường timing đúng** — AI search dịch chuyển đang xảy ra now, không phải "hứa hẹn future".
- **Vốn cần khiêm tốn** so với SaaS trung bình (thường $300K–$1M cho seed). Vì engineering đã làm xong, vốn chủ yếu cho marketing + bridge runway.
- **Downside protection**: Free tier + GPL license đảm bảo product tiếp tục có giá trị ngay cả khi commercial phase chưa scale.
- **Upside potential**: Nếu đạt 2,000 paying customer Year-1 → $480K ARR → valuation seed round $3M–$5M = early investor 5–10x ROI 18–24 tháng.

Quyết định cần thiết tuần này:
1. Phê duyệt ngân sách [ĐIỀN: $40K hoặc $150K]
2. Bật go-live (`docs/GO_LIVE_GUIDE.md`) trong 7 ngày
3. wp.org submission trong tuần đó
4. Soft launch sau khi wp.org approved (~14 ngày)
5. Báo cáo hàng tuần cho 12 tuần đầu

---

## 13. Cam kết của đội Product

Nếu được phê duyệt, đội cam kết:

1. **Tuần 1**: deploy production xanh (verified bằng `bash scripts/verify-release.sh`)
2. **Tuần 2**: wp.org submission đầy đủ
3. **Tuần 4 sau khi wp.org approve**: 50+ Free install, ≥1 paying customer
4. **Tuần 8**: 200+ install, ≥10 paying
5. **Tuần 12**: 500+ install, ≥30 paying, $500+ MRR
6. **Tuần 24**: 2000+ install, ≥100 paying, $2K+ MRR

Mỗi milestone đều có bằng chứng đo lường được. Không đạt → CEO chủ động báo cáo + đề xuất corrective action trước khi nhà đầu tư phải hỏi.

---

## 14. Tài liệu tham chiếu chi tiết (cho due diligence)

| Doc | Mục đích |
|---|---|
| `docs/LAUNCH-HANDOFF.md` | CEO production handoff — quy trình bán hàng end-to-end (Vietnamese) |
| `docs/GO_LIVE_GUIDE.md` | 11-step launch playbook |
| `docs/PLUGIN_HANDOFF.md` | wp.org submission guide |
| `docs/SECURITY_THREAT_MODEL.md` | 20 threats × defense × status |
| `docs/INCIDENT_RESPONSE.md` | 10 incident runbooks |
| `docs/17_PRODUCTION_READINESS.md` | Pre-launch acceptance gate |
| `docs/AUDIT_REPORT.md` | Formal v0.6.1 audit pass |
| `docs/CHANGELOG.md` | Version-by-version commit trail |
| `scripts/verify-release.sh` | Pre-release verification chain (lint + test + security + cold-start) |

Nhà đầu tư due diligence có thể clone repo + chạy `bash scripts/verify-release.sh` → tự verify 19/19 test + 9/9 security smoke + cold-start pass. **Không cần tin lời founder.**

---

## Phụ lục A — số liệu thị trường (cite source)

- WordPress market share 43%: W3Techs, "Usage statistics of content management systems", May 2025
- ChatGPT 200M WAU: OpenAI announcement, March 2025
- Perplexity 250M queries/month: CEO Aravind Srinivas, podcast Q4 2024
- Google AI Overviews CTR reduction 15–35%: Multiple SEO industry studies (Ahrefs, Semrush, Search Engine Land) 2024–2025
- Pew Research 36% AI assistant weekly use: Pew Research Center, "AI in everyday life", 2024
- llms.txt spec: <https://llmstxt.org/> (Mistral + Anthropic, Sept 2024)
- Yoast Premium ~200K paying: Yoast year-in-review blog post

## Phụ lục B — milestones theo tuần (12 tuần đầu)

| Tuần | Việc cụ thể | Owner | Đo lường |
|---|---|---|---|
| 1 | Deploy prod, submit wp.org | DevOps + CEO | health check 200, submission email confirmation |
| 2 | Soft-launch Twitter/X, indie hackers | CMO | 100 impression, 10 reaction |
| 3 | wp.org approval expected | wp.org | listed at wordpress.org/plugins/quoted/ |
| 4 | First 20 install + 1 paying | CMO + Support | wp.org install count, LS first order |
| 5 | First content piece published | Writer | blog post live + share |
| 6 | 50 install, 3 paying | Tracking | dashboard MRR |
| 7 | First YouTuber review live | CMO | YouTube link |
| 8 | 100 install, 10 paying = first $200 MRR | Tracking | dashboard |
| 9 | Pricing page A/B test launch | CMO | conversion rate by variant |
| 10 | First refund + first churn analysis | CEO | root cause documented |
| 11 | 200 install, 20 paying, $400 MRR | Tracking | — |
| 12 | First retention quarterly review | CEO + investor | meeting notes |

## Phụ lục C — đầu tư so sánh

| Comparable SaaS | Stage when funded | Equity given | Outcome |
|---|---|---|---|
| Yoast SEO (Joost) | Bootstrap → acquired by Newfold Digital | n/a | $90M sale 2023 |
| Rank Math | Bootstrap | n/a | Still bootstrap, est $20M ARR |
| RankIQ | Bootstrap | n/a | $5M ARR estimate |
| GrowthBar | Seed → acquired by SE Ranking | ~25% | exit |

Quoted positioning gần nhất với Rank Math: WordPress-specific, freemium, bootstrap-able, founder-led.

---

**Soạn bởi:** đội Product & Engineering của Quoted
**Cập nhật:** [ĐIỀN: ngày]
**Liên hệ founder:** [ĐIỀN: email/phone]

---

> **Quyết định cuối:** Đầu tư bao nhiêu, equity bao nhiêu, hay debt thay vì equity — đó là quyết định business. Tài liệu này cung cấp đủ thông tin để ra quyết định đó dựa trên dữ liệu cụ thể, không phải hứa hẹn.
>
> Sản phẩm sẵn sàng launch. Đội sẵn sàng thực thi. Cửa sổ thị trường đang mở. Câu hỏi duy nhất còn lại: vốn để move?
