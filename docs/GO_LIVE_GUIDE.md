# Go-live guide — mua domain, deploy, kết nối hệ thống

> **Đối tượng:** CEO làm theo, có 1-2 lần phải đưa DevOps chạy CLI.
> **Stack:** Cloudflare Registrar (domain) + Cloudflare Pages (frontend) + Fly.io (backend).
> **Domain mục tiêu:** `quotedeasy.com` (đổi nếu domain đó đã bị mua — phần cuối có hướng dẫn check).
> **Thời gian dự kiến:** 2-3 giờ làm liền tay nếu mọi credit card / account đã sẵn.
> **Chi phí tháng đầu:** ~$10 domain (1 năm) + ~$0 Cloudflare Pages + ~$5-10 Fly.io = **~$15-20 setup, ~$5-10/tháng vận hành**.

Doc này LINEAR — anh đọc theo thứ tự, làm xong bước trước mới sang bước sau. Không nhảy bước.

---

## Bước 0 — Check tên domain còn không (2 phút)

1. Mở <https://www.cloudflare.com/products/registrar/>
2. Bấm **"Try Cloudflare Registrar"** → search box → gõ `quotedeasy.com`
3. Một trong 3 kết quả:
   - ✅ **Available, $9.77/yr** → tiến sang Bước 1
   - ❌ **Already registered** → đổi tên (gợi ý: `quoted.app`, `getquoted.com`, `quoted.io`, `quotedapp.com`, `quotedplugin.com`). Lưu tên đã chọn — tôi gọi là `YOURDOMAIN.com` từ giờ.
   - ⚠️ **Cloudflare Registrar không bán TLD này** (hiếm, chỉ với `.vn`, `.io` mới có lúc) → quay lại câu hỏi và chọn Namecheap thay vì Cloudflare Registrar. Doc này giả định Cloudflare.

> **Không nên:** mua TLD lạ `.xyz`, `.online`, `.click` — AI assistants/Google đánh giá thấp; khách cũng ngại click.

---

## Bước 1 — Mua domain ở Cloudflare Registrar (10 phút)

### 1.1 Tạo Cloudflare account

1. <https://dash.cloudflare.com/sign-up>
2. Email + password mạnh → verify email
3. Login

### 1.2 Mua domain

1. Sidebar trái → **Domain Registration** → **Register Domains**
2. Search lại `quotedeasy.com` → bấm **+ Purchase**
3. **Auto-renew: ON** (đừng tắt — domain hết hạn = mất website)
4. **WHOIS privacy: ON** (mặc định bật, miễn phí — che thông tin cá nhân anh khỏi public)
5. Thanh toán bằng credit card / PayPal — Cloudflare không markup, ~$9.77 cho `.com`

> **Sau khi mua:** domain xuất hiện trong **Websites** tab của dashboard. DNS đã tự động dùng Cloudflare nameservers — bước này tự xong, không cần đổi nameserver thủ công.

### 1.3 Verify DNS pane

1. Dashboard → click vào `quotedeasy.com`
2. Sidebar trái → **DNS** → **Records**
3. Đảm bảo trang này có thể thêm record. Bây giờ trống — sẽ thêm sau Bước 3, 5.

---

## Bước 2 — Tạo Fly.io account + cài flyctl (5 phút)

Đây là backend hosting. Cần làm trên máy laptop của anh (hoặc nhờ DevOps).

### 2.1 Cài flyctl

```bash
# macOS
brew install flyctl

# Linux / WSL
curl -L https://fly.io/install.sh | sh

# Windows (PowerShell)
iwr https://fly.io/install.ps1 -useb | iex
```

Verify:
```bash
flyctl version
```

### 2.2 Tạo account + login

```bash
flyctl auth signup     # mở browser, signup
# hoặc nếu đã có:
flyctl auth login
```

Add credit card (Fly bắt buộc cho dù dùng free tier): dashboard → Billing → Add Payment Method. Free tier ($5 credit/tháng) đủ cho tải nhẹ ban đầu.

---

## Bước 3 — Deploy backend Quoted lên Fly.io (15 phút)

### 3.1 Clone repo + chuyển vào backend folder

```bash
git clone https://github.com/muahangngayvn/quoted.git
cd quoted/backend/omniplug
```

### 3.2 Lần đầu launch app

```bash
flyctl launch --no-deploy
```

Khi nó hỏi:
- **App name:** `quoted-api` (hoặc tên anh muốn — sẽ thành `quoted-api.fly.dev`)
- **Region:** chọn `sin` (Singapore) nếu khách chính ở SEA, `iad` (Virginia) nếu Mỹ/EU
- **Postgres? Redis?** → **No** (Quoted dùng SQLite + Litestream, không cần)
- **Deploy now?** → **No** (chưa, cần set secrets trước)

### 3.3 Set production secrets

⚠️ **Đây là bước quan trọng nhất.** Sai 1 trong những giá trị này = vận hành sai.

Trước hết lấy các giá trị Lemon Squeezy (sẽ tạo trong Bước 7 — quay lại đây sau). Bây giờ dùng placeholder, set sau:

```bash
flyctl secrets set \
  NODE_ENV=production \
  JWT_SECRET="$(openssl rand -hex 32)" \
  ADMIN_EMAIL="admin@quotedeasy.com" \
  ADMIN_INITIAL_PASSWORD="$(openssl rand -base64 24 | tr -d '=+/')" \
  ADMIN_DISPLAY_NAME="Admin" \
  CORS_ORIGIN="https://quotedeasy.com,https://www.quotedeasy.com" \
  TENANT_DEFAULT_DOMAIN="api.quotedeasy.com" \
  TENANT_DEFAULT_SLUG="quoted" \
  TENANT_DEFAULT_NAME="Quoted" \
  TRUST_PROXY=true \
  LEMONSQUEEZY_TEST_MODE=false \
  LICENSE_ENFORCEMENT=warn
```

**Lưu lại 2 giá trị này ở chỗ AN TOÀN (1Password / Bitwarden) — không có cách nào lấy lại:**
- `JWT_SECRET`
- `ADMIN_INITIAL_PASSWORD` (cần để login lần đầu)

In ra terminal để copy:
```bash
flyctl secrets list      # chỉ hiện tên, không hiện value (an toàn)
```

### 3.4 Deploy lần đầu

```bash
flyctl deploy
```

Đợi ~3-5 phút. Khi thấy `deployed app! Visit https://quoted-api.fly.dev`:

```bash
curl https://quoted-api.fly.dev/api/health
```

Kỳ vọng: `{"status":"ok","version":"1.4.4",...}`

### 3.5 Lấy IP của Fly app

```bash
flyctl ips list -a quoted-api
```

Output kiểu:
```
TYPE   ADDRESS                      REGION   CREATED AT
v4     66.241.124.207               global   2026-05-25T...
v6     2a09:8280:1::abc:def         global   2026-05-25T...
```

Lưu lại 2 IP này — sẽ dán vào DNS Bước 4.

---

## Bước 4 — Trỏ `api.quotedeasy.com` → Fly.io (5 phút)

### 4.1 Thêm DNS records ở Cloudflare

1. Cloudflare dashboard → click `quotedeasy.com`
2. **DNS** → **Records** → **Add record** (làm 2 lần)

**Record 1 — IPv4:**
| Type | Name | IPv4 address | Proxy status | TTL |
|---|---|---|---|---|
| A | `api` | (paste v4 từ Fly) | **DNS only** (xám) ← QUAN TRỌNG | Auto |

**Record 2 — IPv6:**
| Type | Name | IPv6 address | Proxy status | TTL |
|---|---|---|---|---|
| AAAA | `api` | (paste v6 từ Fly) | **DNS only** (xám) | Auto |

> **Vì sao "DNS only" (xám) chứ không proxy (cam)?** Cloudflare proxy can thiệp SSL handshake — Fly.io tự lo SSL nên cần Cloudflare đứng ngoài. Sau khi mọi thứ chạy có thể bật proxy nếu cần CDN, nhưng phải config SSL mode = "Full (strict)" trong Cloudflare SSL settings.

### 4.2 Add custom domain ở Fly

```bash
flyctl certs add api.quotedeasy.com -a quoted-api
```

Output sẽ hỏi xác minh DNS — nếu Bước 4.1 đã đúng, sau 1-2 phút sẽ thấy `Certificate provisioned`.

Verify:
```bash
curl https://api.quotedeasy.com/api/health
```

Nếu vẫn lỗi SSL sau 5 phút, chạy:
```bash
flyctl certs check api.quotedeasy.com -a quoted-api
```

### 4.3 Update CORS_ORIGIN (nếu cần subdomain extra)

Nếu anh muốn cả `www.api.quotedeasy.com` hoặc các subdomain khác, thêm vào CORS:
```bash
flyctl secrets set CORS_ORIGIN="https://quotedeasy.com,https://www.quotedeasy.com" -a quoted-api
# Fly tự restart sau khi secret update
```

---

## Bước 5 — Deploy frontend lên Cloudflare Pages (10 phút)

### 5.1 Push code lên GitHub (nếu chưa)

Frontend Quoted nằm trong cùng repo `muahangngayvn/quoted` ở thư mục `frontend/`. Cloudflare Pages connect thẳng từ GitHub.

### 5.2 Tạo Pages project

1. Cloudflare dashboard sidebar → **Workers & Pages** → **Create application** → **Pages** tab → **Connect to Git**
2. Authorize Cloudflare đọc GitHub → chọn repo `muahangngayvn/quoted`
3. **Set up builds and deployments:**
   - **Project name:** `quoted-marketing`
   - **Production branch:** `main` (hoặc `claude/awesome-ptolemy-8phkw` nếu chưa merge — đổi sau khi merge)
   - **Framework preset:** **None**
   - **Build command:** *(để trống — site là HTML tĩnh không cần build)*
   - **Build output directory:** `frontend`
   - **Root directory:** *(để trống)*
4. **Save and Deploy**

Đợi ~2 phút. Cloudflare cấp URL tạm: `https://quoted-marketing.pages.dev` → mở → thấy hero Quoted hiện đúng.

### 5.3 Set environment variable cho frontend biết backend URL

Frontend cần biết gọi API ở đâu. File `frontend/assets/cms.js` đã đọc từ `<meta name="quoted-cms-api">` hoặc `window.QUOTED_CMS_API_BASE`. Anh chọn 1 trong 2 cách:

**Cách A (đơn giản):** thêm tag meta vào mỗi HTML file ở `<head>`:

```html
<meta name="quoted-cms-api" content="https://api.quotedeasy.com">
```

Commit thay đổi này → Pages tự deploy lại.

**Cách B (env-based):** trong Pages settings → **Settings** → **Environment variables** → Production → Add:
- Name: `QUOTED_CMS_API_BASE`
- Value: `https://api.quotedeasy.com`

Rồi sửa `frontend/index.html` để inject env:
```html
<script>window.QUOTED_CMS_API_BASE = "https://api.quotedeasy.com";</script>
<script src="/assets/cms.js" defer></script>
```

**Khuyên Cách A** — đơn giản hơn, không phụ thuộc Cloudflare-specific.

---

## Bước 6 — Trỏ `quotedeasy.com` → Cloudflare Pages (5 phút)

### 6.1 Bind custom domain trong Pages

1. `quoted-marketing` project → **Custom domains** tab → **Set up a custom domain**
2. Nhập `quotedeasy.com` → **Continue** → **Activate domain**
3. Lặp lại cho `www.quotedeasy.com` → Pages sẽ auto-redirect `www` về apex

> Vì domain mua ở Cloudflare nên DNS records tự thêm — không cần làm gì thêm. Nếu mua ở registrar khác, anh phải tự thêm CNAME `quoted-marketing.pages.dev` cho `quotedeasy.com`.

### 6.2 Verify

Sau 2-3 phút:
```bash
curl -I https://quotedeasy.com/
curl -I https://www.quotedeasy.com/
```

Cả 2 trả 200 OK + cert hợp lệ → done.

Mở `https://quotedeasy.com/` trong browser → thấy hero Quoted, sidebar nếu console DevTools mở Network sẽ thấy 1 request `https://api.quotedeasy.com/api/public/pages/quoted_home` trả 200.

---

## Bước 7 — Cấu hình Lemon Squeezy (15 phút)

### 7.1 Tạo store + products

1. <https://app.lemonsqueezy.com/signup> → tạo seller account
2. Verify email + complete onboarding (chọn loại business)
3. **Products** → **+ New product**
   - Name: **Quoted Pro**
   - Description: bất kỳ
   - Add variant: **Pro Monthly** $19/month → bật **License keys** → activation limit **1**
   - Add variant: **Pro Yearly** $190/year → bật **License keys** → activation limit **1**
4. Lặp lại tạo **Quoted Agency** với 2 variants $29/mo + $290/yr → activation limit **5**
5. Mỗi variant: bấm **"..."** → **Share** → **Copy hosted checkout URL** (lưu lại 4 URL)

### 7.2 Lấy API key + Store ID

1. **Settings** → **API** → **+ Create API key** → name "Quoted Production" → copy token (chỉ hiện 1 lần — lưu ngay)
2. Store ID: settings URL có dạng `https://app.lemonsqueezy.com/stores/12345/...` — số `12345` là Store ID

### 7.3 Lấy 4 Variant IDs

Mỗi variant page URL có dạng `https://app.lemonsqueezy.com/products/{prod_id}/variants/{variant_id}` → copy 4 variant_id.

### 7.4 Tạo Webhook

1. **Settings** → **Webhooks** → **+ Create webhook**
2. **Name:** `Quoted Production`
3. **Callback URL:** `https://api.quotedeasy.com/api/payments/webhook/lemon-squeezy`
4. **Signing Secret:** LS auto-generate → **Reveal** → copy
5. **Events** — tick đủ 6 cái:
   - ☑ `order_created`
   - ☑ `subscription_created`
   - ☑ `subscription_cancelled`
   - ☑ `subscription_resumed`
   - ☑ `subscription_expired`
   - ☑ `license_key_created`
6. **Save webhook**

### 7.5 Update Fly secrets với LS credentials

```bash
flyctl secrets set \
  LEMONSQUEEZY_API_KEY="eyJ0eXAi..." \
  LEMONSQUEEZY_STORE_ID=12345 \
  LEMONSQUEEZY_WEBHOOK_SECRET="whsec_..." \
  LEMONSQUEEZY_VARIANT_PRO_MONTHLY=11111 \
  LEMONSQUEEZY_VARIANT_PRO_YEARLY=11112 \
  LEMONSQUEEZY_VARIANT_AGENCY_MONTHLY=11113 \
  LEMONSQUEEZY_VARIANT_AGENCY_YEARLY=11114 \
  LEMONSQUEEZY_CHECKOUT_PRO_MONTHLY="https://quotedeasy.lemonsqueezy.com/checkout/buy/xxxx" \
  LEMONSQUEEZY_CHECKOUT_PRO_YEARLY="https://quotedeasy.lemonsqueezy.com/checkout/buy/xxxx" \
  LEMONSQUEEZY_CHECKOUT_AGENCY_MONTHLY="https://quotedeasy.lemonsqueezy.com/checkout/buy/xxxx" \
  LEMONSQUEEZY_CHECKOUT_AGENCY_YEARLY="https://quotedeasy.lemonsqueezy.com/checkout/buy/xxxx" \
  -a quoted-api
```

Fly tự restart. Verify:
```bash
curl https://api.quotedeasy.com/api/products/plans
```

Trả về 4 plan với hosted_url đúng → OK.

---

## Bước 8 — Update tenant 1 trong DB production (5 phút)

Default tenant 1 có `domain = api.quotedeasy.com` (từ `TENANT_DEFAULT_DOMAIN`). Marketing site gọi từ `quotedeasy.com` cần resolve về tenant này → Host header sẽ là `api.quotedeasy.com` (do API ở subdomain đó). Đã đúng.

Nhưng nếu anh muốn frontend `quotedeasy.com` cũng được nhận diện làm tenant (ví dụ form contact submit qua `/api/public/leads`), thêm domain alias:

```bash
flyctl ssh console -a quoted-api
# trong shell của container:
cd /app && node --env-file=.env -e "
import('./src/core/db/connection.js').then(({default: db}) => {
  const r = db.prepare('UPDATE tenants SET domain = ? WHERE id = 1').run('quotedeasy.com');
  console.log('updated:', r.changes);
  process.exit(0);
});
"
```

(Hoặc bỏ qua bước này nếu frontend không POST gì lên `/api/public/*` — chỉ GET sections thì Host header sẽ là `api.quotedeasy.com` không phải `quotedeasy.com`.)

---

## Bước 9 — Login admin lần đầu + đổi password (3 phút)

1. Mở <https://api.quotedeasy.com/admin/>
2. Login bằng:
   - Email: `admin@quotedeasy.com` (giá trị anh set ở Bước 3.3)
   - Password: `ADMIN_INITIAL_PASSWORD` đã lưu
3. Click avatar (góc trái dưới sidebar) → User Settings → Change password
4. Đặt password mới mạnh → lưu vào password manager
5. Footer sidebar phải hiện `v1.4.4 · admin build M2.1` → confirm đang chạy đúng version

---

## Bước 10 — Smoke test mua hàng thật (15 phút)

Bước này verify CẢ HỆ THỐNG: domain → frontend → API → Lemon Squeezy → webhook → backend → license.

### 10.1 Test purchase

1. Mở <https://quotedeasy.com/pricing>
2. Bấm **Start Pro** (gói Pro Monthly $19)
3. Bị redirect sang `https://quotedeasy.lemonsqueezy.com/checkout/...`
4. Dùng **test card** (LS test mode card): `4242 4242 4242 4242`, exp `12/29`, cvv `123`
5. Complete checkout

### 10.2 Verify chain reaction

1. **Email** — sau 30s nhận email từ LS kèm license key (UUID dài ~36 ký tự)
2. **LS dashboard** → Webhooks → click webhook "Quoted Production" → **History** tab → có dòng mới status **200 OK** cho `order_created` + `subscription_created` + `license_key_created`. Nếu status 401/403 → webhook secret sai, làm lại Bước 7.4.
3. **Quoted admin** → Audit log → có entry `webhook.lemon-squeezy.received`
4. **Quoted admin** → click thêm Users → có user mới với email anh dùng mua
5. **Quoted admin** → click License (nếu có tab) → thấy license vừa tạo

### 10.3 Verify plugin activation

1. Có 1 WordPress staging site (tự host hoặc dùng local-wp / instawp.com để test nhanh)
2. Cài plugin Quoted: upload file `quoted.zip` từ `wp-plugin/` folder (zip lại bằng `cd wp-plugin && zip -r ../quoted.zip .`)
3. wp-admin → Plugins → activate → Settings → Quoted
4. Backend URL: `https://api.quotedeasy.com`
5. License key: paste UUID từ email
6. **Activate** → kỳ vọng: hiện "Active" + plan name "Pro" + danh sách features

### 10.4 Refund đơn test

LS dashboard → Orders → đơn vừa rồi → **Refund**. Webhook `subscription_expired` về → backend tự khoá entitlement.

Refresh Quoted admin → user/license status đổi sang inactive → smoke test pass.

---

## Bước 11 — Lock down + monitoring (10 phút)

### 11.1 Bật strict license enforcement

Sau khi mọi thứ chạy:
```bash
flyctl secrets set LICENSE_ENFORCEMENT=strict -a quoted-api
```

Lúc này `/api/v1/*` requires API key + valid license — bảo vệ SDK consumer.

### 11.2 Setup uptime monitor

<https://uptimerobot.com> (free 50 monitors):
- Monitor 1: `https://quotedeasy.com/` → keyword `Quoted` → 5 min interval
- Monitor 2: `https://api.quotedeasy.com/api/health` → keyword `"status":"ok"` → 5 min interval
- Alert via email + Slack/Telegram

### 11.3 Setup error monitoring (optional)

Sentry free tier: `https://sentry.io` → tạo project Node.js → add `SENTRY_DSN` env var + thêm `@sentry/node` integration nếu cần. Bước này không bắt buộc cho launch.

### 11.4 Backup verification

Fly + Litestream: kiểm tra mỗi tuần `flyctl ssh console` → `ls -la /app/data/` → DB file < 100MB và Litestream đang replicate.

---

## Cheat sheet — copy paste khi cần

### Restart backend
```bash
flyctl deploy -a quoted-api
```

### Xem log live
```bash
flyctl logs -a quoted-api
```

### Ssh vào container
```bash
flyctl ssh console -a quoted-api
```

### Cập nhật env mới mà không deploy code mới
```bash
flyctl secrets set KEY=value -a quoted-api
# Fly tự restart sau khi secret update
```

### Rollback nếu deploy mới fail
```bash
flyctl releases -a quoted-api          # list 10 deploy gần nhất
flyctl deploy --image registry.fly.io/quoted-api:deployment-OLDID -a quoted-api
```

### Cloudflare Pages rollback
Pages dashboard → Deployments → click deploy cũ → **Rollback to this deployment**.

---

## Tổng kết — bảng tick-box

| Bước | Done? | Verify |
|---|---|---|
| 1. Mua domain quotedeasy.com ở Cloudflare | ☐ | Hiện trong Websites tab |
| 2. Tạo Fly account + cài flyctl | ☐ | `flyctl version` chạy |
| 3. Deploy backend Fly | ☐ | `curl quoted-api.fly.dev/api/health` 200 |
| 4. DNS api.quotedeasy.com → Fly + SSL | ☐ | `curl api.quotedeasy.com/api/health` 200 |
| 5. Deploy frontend Cloudflare Pages | ☐ | `https://quoted-marketing.pages.dev` load |
| 6. DNS quotedeasy.com → Pages + SSL | ☐ | `curl quotedeasy.com/` 200 |
| 7. Tạo LS store + 4 variants + webhook + cập nhật Fly secrets | ☐ | `curl api.quotedeasy.com/api/products/plans` trả 4 plan đúng |
| 8. (Optional) Update tenant 1 domain trong DB | ☐ | — |
| 9. Login admin + đổi password | ☐ | Login OK, password mới, build stamp đúng |
| 10. Smoke test purchase + plugin activation + refund | ☐ | LS webhook 200, license active, refund khoá entitlement |
| 11. Strict mode + uptime monitor | ☐ | Uptime ping OK 24h |

**Pass cả 11 bước = production live, có thể public marketing.**

---

## Nếu fail bước nào

| Triệu chứng | Likely cause | Fix |
|---|---|---|
| `flyctl deploy` fail "no Dockerfile" | Backend dir thiếu Dockerfile | Repo đã có sẵn ở `backend/omniplug/Dockerfile`. Check `cd backend/omniplug` trước khi deploy. |
| SSL cert không cấp sau 5 phút | DNS chưa propagate hoặc record sai type | `dig api.quotedeasy.com` xem IP đúng chưa. Bỏ proxy Cloudflare (xám không cam). |
| Webhook trả 401 | `LEMONSQUEEZY_WEBHOOK_SECRET` ở Fly khác với LS | Reveal lại secret ở LS → `flyctl secrets set` lại |
| Webhook trả 200 nhưng license không tạo | `LEMONSQUEEZY_TEST_MODE=true` còn sót | `flyctl secrets set LEMONSQUEEZY_TEST_MODE=false -a quoted-api` |
| Mua thành công nhưng pricing page 404 | Tenant 1 domain chưa khớp | Xem Bước 8 |
| Frontend load nhưng hero không hydrate | `<meta name="quoted-cms-api">` thiếu hoặc URL sai | Xem Bước 5.3 |
| Browser cache admin cũ | `Cache-Control: no-cache` đã set nhưng browser stubborn | DevTools → Network → Disable cache → reload |

Vẫn fail → screenshot + step number gửi DevOps. DEPLOYMENT.md + DEBUGGING.md có thêm context kỹ thuật.
