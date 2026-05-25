# Quoted — Bộ tài liệu bàn giao CEO (Launch Handoff)

> **Đối tượng:** CEO / non-technical founder.
> **Mục tiêu:** Hiểu mình đang sở hữu cái gì, cần làm gì để **gắn domain + payment + webhook + chạy production + bắt đầu bán**.
> **Phụ lục kỹ thuật chi tiết:** [`docs/DEPLOYMENT.md`](./DEPLOYMENT.md), [`docs/ARCHITECTURE-COMMERCIAL.md`](./ARCHITECTURE-COMMERCIAL.md), [`docs/DEBUGGING.md`](./DEBUGGING.md) — đưa cho DevOps khi triển khai.

---

## 1. Executive Summary

**Quoted là một plugin WordPress giúp website của khách hàng "hiện ra đúng cách" khi người dùng cuối hỏi ChatGPT, Claude, Perplexity hoặc Google AI Search.**

- **Sản phẩm bán:** Subscription hàng tháng/năm cho gói **Pro** ($19/mo) và **Agency** ($29/mo). Khách trả tiền để mở các tính năng như citation tracking, bot crawl analytics, live AI test, llms.txt chuyên sâu.
- **Khách hàng mục tiêu:** Chủ website WordPress vừa và nhỏ (SMB, agency, local business) — những người đang chạy SEO truyền thống nhưng muốn được AI assistants trích dẫn khi user hỏi về ngành/dịch vụ của họ.
- **Lý do khách trả tiền:** SEO cũ là cho Google. Khi user chuyển sang hỏi AI ("Quán cà-phê nào giao tận văn phòng ở Brooklyn?"), AI cần dữ liệu sạch để trích dẫn được. Quoted chuẩn bị dữ liệu đó **mà không bắt khách thay SEO plugin hiện có**.
- **Sau khi gắn domain + webhook xong, mô hình bán hàng là:** Marketing site (`quotedeasy.com`) → khách click **Start Pro** → Lemon Squeezy hosted checkout (Quoted không cầm thẻ tín dụng) → khách nhận email kèm license key → khách cài plugin từ WordPress.org → nhập license key → website của họ bắt đầu sync. **Không cần đội sales, không cần đội support cho mỗi đơn hàng.**

---

## 2. What Is Included (Trong tay anh đang có gì)

| Thành phần | Trạng thái | Ghi chú cho CEO |
|---|---|---|
| **Marketing website** (`frontend/`) | ✅ Đã viết xong, chạy local | Tĩnh, deploy trên Cloudflare Pages — gần như miễn phí. Hero copy đã edit được từ CMS. |
| **Backend API** (`backend/omniplug/`, Node.js + SQLite) | ✅ Đã build, đã test 19/19 pass | Deploy trên Fly.io (~$5–10/tháng). Tự backup qua Litestream. |
| **CMS / Admin portal** (`/admin/`) | ✅ Có sẵn (do OmniPlug ship) | Login bằng email/password admin để chỉnh sửa nội dung hero, sections, media, xem leads, xem audit log. |
| **WordPress plugin** (`wp-plugin/`) | ✅ Đã build, có 25 test PHP pass | Submit lên wordpress.org để khách tự install. |
| **JS SDK** (`sdk/js-client/`) | ✅ Đã build, npm-publishable | Cho developer tích hợp — không phải CEO concern. |
| **Payment + License flow** (Lemon Squeezy) | ✅ Wired xong, 15/15 commercial test pass | Lemon Squeezy lo việc cầm thẻ, xuất hoá đơn, refund, tax. Backend của Quoted chỉ xác minh webhook và phát license. |
| **Local test mode** (`LEMONSQUEEZY_TEST_MODE=true`) | ✅ Mặc định bật ở dev | Mua-bán giả lập được 100% không cần tài khoản LS thật. |
| **Production mode** (`LEMONSQUEEZY_TEST_MODE=false`) | ⏳ Cần credentials thật | Phần dưới đây hướng dẫn. |

**Tóm tắt:** Code xong, test xong. Phần còn lại là **vận hành + cấu hình**, không phải lập trình.

---

## 3. Final Production Setup Checklist

Đây là checklist cần tick xong trước khi mở bán. Mỗi dòng nên giao cho người chịu trách nhiệm rõ ràng.

### Domain & hạ tầng (CEO mua domain + duyệt — DevOps thực thi)

- [ ] **Domain frontend** đã mua (ví dụ `quotedeasy.com`)
- [ ] **Domain backend/API** đã chọn (khuyến nghị `api.quotedeasy.com` — subdomain)
- [ ] **DNS records** đã trỏ:
  - [ ] `quotedeasy.com` → Cloudflare Pages
  - [ ] `api.quotedeasy.com` → Fly.io app (A record IPv4 + AAAA IPv6)
- [ ] **SSL/TLS** đã active (Cloudflare tự lo cho frontend; Fly tự lo cho backend qua `flyctl certs create`)

### Environment variables (DevOps cấu hình — CEO không động vào)

- [ ] `JWT_SECRET` — random 32 hex bytes (`openssl rand -hex 32`)
- [ ] `ADMIN_EMAIL` — email login admin của CEO (ví dụ `admin@quotedeasy.com`)
- [ ] `ADMIN_INITIAL_PASSWORD` — **password mạnh, không phải `ChangeMe123!`**
- [ ] `CORS_ORIGIN` — `https://quotedeasy.com,https://www.quotedeasy.com`
- [ ] `APP_BASE_URL` — `https://quotedeasy.com`
- [ ] `API_BASE_URL` — `https://api.quotedeasy.com`
- [ ] `TENANT_DEFAULT_DOMAIN` — `api.quotedeasy.com`
- [ ] `LEMONSQUEEZY_TEST_MODE=false` ← **bắt buộc, nếu quên flag này thì khách trả tiền nhưng license không phát ra**

### Lemon Squeezy (CEO mở tài khoản — đưa cho DevOps các giá trị copy ra)

- [ ] `LEMONSQUEEZY_API_KEY` — lấy từ LS Dashboard → Settings → API
- [ ] `LEMONSQUEEZY_STORE_ID` — lấy từ URL store
- [ ] `LEMONSQUEEZY_WEBHOOK_SECRET` — lấy khi tạo webhook (section 4 bên dưới)
- [ ] `LEMONSQUEEZY_VARIANT_PRO_MONTHLY` — ID số của variant
- [ ] `LEMONSQUEEZY_VARIANT_PRO_YEARLY`
- [ ] `LEMONSQUEEZY_VARIANT_AGENCY_MONTHLY`
- [ ] `LEMONSQUEEZY_VARIANT_AGENCY_YEARLY`
- [ ] `LEMONSQUEEZY_CHECKOUT_PRO_MONTHLY` — hosted checkout URL của variant
- [ ] `LEMONSQUEEZY_CHECKOUT_PRO_YEARLY`
- [ ] `LEMONSQUEEZY_CHECKOUT_AGENCY_MONTHLY`
- [ ] `LEMONSQUEEZY_CHECKOUT_AGENCY_YEARLY`

### Verification

- [ ] Sau deploy, mở `https://api.quotedeasy.com/api/health` → trả `{"status":"ok"}`
- [ ] Login được vào `https://api.quotedeasy.com/admin/`
- [ ] **Đổi password admin ngay lần login đầu**
- [ ] Mở `https://quotedeasy.com/` → website hiện ra, không lỗi
- [ ] Chạy 1 lần test purchase (section 7 bên dưới)

> **Lệnh deploy thực tế cho DevOps:** [`docs/DEPLOYMENT.md`](./DEPLOYMENT.md) section 2 — copy-paste sẵn `flyctl secrets set`.

---

## 4. Lemon Squeezy Webhook Setup

Đây là bước **quan trọng nhất** trong toàn bộ launch. Sai bước này thì khách trả tiền nhưng backend không biết → license không phát ra → khách giận.

### Vào đâu

1. Đăng nhập <https://app.lemonsqueezy.com>
2. Chọn store của Quoted ở góc trên trái.
3. Sidebar trái → **Settings** → **Webhooks** → **+ Create webhook**.

### Tạo webhook

| Trường | Giá trị |
|---|---|
| **Name** | `Quoted Production` (tự đặt cho dễ nhớ) |
| **Callback URL** | `https://api.quotedeasy.com/api/payments/webhook/lemon-squeezy` |
| **Signing secret** | LS sinh tự động — **bấm Reveal → copy → dán vào `LEMONSQUEEZY_WEBHOOK_SECRET` ở backend env** |

### Chọn các event (tick đủ 6 cái sau)

- ☑ `order_created` — tạo customer + order
- ☑ `subscription_created` — tạo subscription + entitlement
- ☑ `subscription_cancelled` — khách cancel → khoá entitlement
- ☑ `subscription_resumed` — khách resume → mở lại entitlement
- ☑ `subscription_expired` — hết hạn → khoá entitlement
- ☑ `license_key_created` — tạo license + entitlement cho khách

> 6 event này là tất cả những gì backend **đang xử lý**. Không cần tick thêm — tick dư cũng không hại, chỉ ồn ào log thôi.

### Test webhook đã hoạt động

Sau khi tạo:

1. Trong LS dashboard → Webhooks → bấm vào webhook vừa tạo → tab **History**.
2. Mua thử 1 đơn (xem section 7) → quan sát History có dòng mới.
3. **Status phải là `200 OK`**. Nếu thấy `401`, `403`, `500` → secret sai hoặc backend chưa deploy đúng.
4. Mở admin → **Audit log** → có dòng `webhook.lemon-squeezy.received` ⇒ thành công, backend đã ghi nhận order/subscription/license vào DB.

> **Quy tắc vàng:** Mỗi khi đổi `LEMONSQUEEZY_WEBHOOK_SECRET` hoặc URL → phải vào LS Webhooks và **cập nhật ở cả hai nơi cùng lúc**, không thì webhook sẽ fail.

---

## 5. Domain Mapping

| Mục đích | URL anh sẽ thấy |
|---|---|
| **Website bán hàng / marketing** | `https://quotedeasy.com` |
| **API / backend** | `https://api.quotedeasy.com` |
| **Admin / CMS** (anh login vào đây) | `https://api.quotedeasy.com/admin/` |
| **Webhook URL** (nhập vào LS) | `https://api.quotedeasy.com/api/payments/webhook/lemon-squeezy` |
| **Backend URL** (khách nhập vào WordPress plugin) | `https://api.quotedeasy.com` |
| **Health check** (cho uptime monitor) | `https://api.quotedeasy.com/api/health` |
| **Pricing page** | `https://quotedeasy.com/pricing` |
| **Success page sau checkout** | `https://quotedeasy.com/success` |

> Tất cả các đường trên không hardcode trong code — đều đọc từ env. DevOps đổi `APP_BASE_URL`/`API_BASE_URL` thì cả hệ thống đổi theo.

---

## 6. CEO Launch Flow (Quy trình bán hàng)

Sau khi setup xong, đây là flow tự động — **không cần Quoted team can thiệp vào từng đơn**:

```
1. Khách Google → vào quotedeasy.com
        ↓
2. Đọc hero, pricing, FAQ → click "Start Pro" / "Start Agency"
        ↓
3. Bị redirect sang trang Lemon Squeezy hosted checkout
   (LS lo việc: nhập thẻ, Apple Pay, Google Pay, VAT, tax, hoá đơn)
        ↓
4. Pay thành công
        ├──► LS gửi webhook → backend Quoted ghi customer/order/license vào DB
        ├──► LS gửi email cho khách kèm license key (UUID)
        └──► LS redirect khách về quotedeasy.com/success.html
        ↓
5. Khách vào wordpress.org/plugins/quoted → cài plugin
        ↓
6. Khách mở wp-admin → Settings → Quoted:
   - Backend URL: https://api.quotedeasy.com  ← nhập cố định một lần
   - License key: paste UUID từ email LS
   - Bấm Activate
        ↓
7. Plugin gọi backend Quoted → backend xác minh với LS License API →
   trả về activation token → tự register WP site
        ↓
8. Plugin bắt đầu sync content + llms.txt + bot crawl logs lên backend
        ↓
9. Khách thấy dashboard trong wp-admin: AI Distribution Score,
   bot crawl activity, citation feed (Phase 2).
```

**CEO chỉ vào hệ thống khi:**

- Edit copy marketing (CMS — xem [`CMS-CEO-GUIDE.md`](./CMS-CEO-GUIDE.md))
- Xem leads / form contact
- Xem audit log nếu cần điều tra
- Refund hoặc xoá khách (làm trong Lemon Squeezy dashboard, không phải Quoted admin)

---

## 7. Smoke Test Before Selling

Trước khi public, chạy đúng 1 lần purchase thật. Đây là test cuối cùng đảm bảo cả 4 mảnh (frontend → LS → backend → plugin) ráp được vào nhau.

### Chuẩn bị

- 1 thẻ thật (sẽ refund ngay sau test) HOẶC dùng tài khoản LS test mode với card giả `4242 4242 4242 4242`
- 1 site WordPress thật để test plugin (có thể là staging WP `staging.quotedeasy.com`)

### Bước test

| # | Việc làm | Kỳ vọng |
|---:|---|---|
| 1 | Mở `https://quotedeasy.com/` | Trang load, không 404, không lỗi JS |
| 2 | Click **Start Pro** | Redirect sang checkout LS, URL bắt đầu bằng `https://*.lemonsqueezy.com/checkout/...` |
| 3 | Nhập thẻ test, complete purchase | Hiện success page LS, sau 2–3s redirect về `quotedeasy.com/success.html` |
| 4 | Check email | Nhận email từ LS kèm **license key** (UUID dài ~36 ký tự) |
| 5 | Mở LS dashboard → Webhooks → History | Dòng mới với **status 200 OK** cho `order_created` + `subscription_created` + `license_key_created` |
| 6 | Mở `https://api.quotedeasy.com/admin/` → Audit log | Có dòng `webhook.lemon-squeezy.received` mới |
| 7 | Vào staging WP → Plugins → Add New → Upload `quoted.zip` → Activate | Plugin install OK, hiện trong sidebar |
| 8 | Settings → Quoted → nhập backend URL + license key → **Activate** | Hiện "Active" + plan name "Pro" + danh sách features |
| 9 | `https://api.quotedeasy.com/api/health` | Trả `{"status":"ok"}` |
| 10 | `https://api.quotedeasy.com/api/public/llm/sitemap.txt` (với header `X-Quoted-Domain: staging.quotedeasy.com`) | Trả về danh sách post của site đã đăng ký |
| 11 | Vào LS dashboard → Refund đơn test | Refund OK, webhook tự khoá license |

**Pass cả 11 bước** ⇒ hệ thống thương mại đã sẵn sàng. Có thể public marketing.

**Fail bước nào** ⇒ gửi screenshot + step number cho DevOps, dừng launch, không công bố.

---

## 8. What The CEO Should Not Touch

Đây là danh sách "đụng vào là gãy" — chỉ DevOps được sửa:

| Không được | Vì sao |
|---|---|
| Sửa code trong `backend/omniplug/src/` | Đây là vendored OmniPlug — sửa sẽ vỡ upstream merge sau này |
| Bật `LEMONSQUEEZY_TEST_MODE=true` trên production | Backend sẽ phát license **giả** thay vì verify với LS thật → khách trả tiền nhưng license không hoạt động |
| Public `JWT_SECRET`, `LEMONSQUEEZY_API_KEY`, `LEMONSQUEEZY_WEBHOOK_SECRET` ra ngoài (Slack, email, screenshot, GitHub issue) | Ai có 3 cái này có thể giả mạo webhook + đọc DB |
| Đổi `LEMONSQUEEZY_WEBHOOK_SECRET` mà không cập nhật bên LS Dashboard ngay sau đó | Webhook fail → tất cả đơn mới không tạo license cho đến khi sync lại |
| Đổi URL webhook trong LS sau khi đã live mà không thông báo DevOps để cập nhật endpoint | Như trên |
| Dùng admin password mặc định `ChangeMe123!` trên production | Bất kỳ ai biết mặc định này đều login được vào CMS |
| Xoá tenant id=1 trong DB | Đây là tenant chính của marketing site — xoá là website chết |
| Edit migration đã shipped (`.sql` trong `src/core/db/migrations/`) | Migration đã chạy ở production thì không re-run. Sửa file = lỗi không thể nhận biết. |

---

## 9. Commercial Readiness Statement

> Quoted v0.4.0 **sẵn sàng để triển khai thương mại** sau khi chủ sở hữu hoàn tất:
>
> 1. Gắn domain production (`quotedeasy.com` + `api.quotedeasy.com`)
> 2. Nhập đầy đủ Lemon Squeezy credentials (API key, store ID, 4 variant ID, 4 hosted checkout URL, webhook secret) vào environment variables của backend
> 3. Tạo webhook trên Lemon Squeezy trỏ về `https://api.quotedeasy.com/api/payments/webhook/lemon-squeezy` với đủ 6 event đã liệt kê
> 4. Đặt `LEMONSQUEEZY_TEST_MODE=false` ở production
> 5. Đổi admin password khỏi giá trị mặc định
> 6. Chạy đầy đủ 11 bước smoke test ở section 7 — **pass hết 11 bước**
>
> Sau khi đáp ứng đủ 6 điều kiện trên, hệ thống có thể nhận đơn hàng thật và thu tiền. Toàn bộ flow purchase → webhook → license activation → WordPress plugin connect đã được test 15/15 ở commercial layer và 19/19 trên toàn repo.
>
> **Không cam kết:** thị phần, tốc độ ra đơn, conversion rate — những thứ này phụ thuộc marketing/sales, không phải code.

---

## 10. Final CEO One-Page Instruction

> **Đọc 10 dòng là biết phải làm gì.**

1. **Tôi cần domain gì?** → 1 domain chính (`quotedeasy.com`) + 1 subdomain cho API (`api.quotedeasy.com`).
2. **Tôi cần tài khoản gì?** → Lemon Squeezy seller account (có store, có 2 product Pro + Agency, mỗi product 2 variant Monthly + Yearly, mỗi variant bật **License keys** + lấy **hosted checkout URL**).
3. **Tôi cần gửi cho DevOps cái gì?** → 1 file `.env` chứa: LS API key, store ID, 4 variant ID, 4 checkout URL, webhook secret. Plus admin email + 1 password mạnh.
4. **DevOps làm gì?** → Deploy backend lên Fly.io (`flyctl deploy`), deploy frontend lên Cloudflare Pages (auto từ Git), trỏ DNS, bật SSL. Có sẵn lệnh trong [`docs/DEPLOYMENT.md`](./DEPLOYMENT.md).
5. **Webhook tôi làm hay DevOps làm?** → CEO vào LS dashboard tạo webhook (URL = `https://api.quotedeasy.com/api/payments/webhook/lemon-squeezy`, tick 6 event), copy secret đưa DevOps.
6. **Tôi test thế nào?** → Mua thử 1 đơn bằng thẻ test (hoặc thẻ thật rồi refund). Check 11 bước ở section 7. Pass hết ⇒ launch.
7. **Sau khi pass thì bán thế nào?** → Public marketing → khách tự click Start Pro → checkout LS → license vào email → cài plugin → done. **Không cần đụng tay từng đơn.**
8. **Khi nào tôi vào admin?** → Đổi copy marketing trong CMS, xem leads, xem audit log. Refund/cancel làm bên LS, không trong Quoted admin.
9. **Nếu khách kêu plugin không activate?** → Hỏi license key + domain WP. Vào admin → tìm license trong DB → kiểm tra status. Nếu kẹt, đưa DevOps theo [`docs/DEBUGGING.md`](./DEBUGGING.md).
10. **Cảnh báo cuối:** đừng public `LEMONSQUEEZY_WEBHOOK_SECRET` / `JWT_SECRET` / `ADMIN_INITIAL_PASSWORD`. Đừng bật `TEST_MODE=true` trên production. Đừng dùng password mặc định.

---

## Tài liệu liên quan

| Tài liệu | Dành cho ai | Đọc khi nào |
|---|---|---|
| [`LAUNCH-HANDOFF.md`](./LAUNCH-HANDOFF.md) | CEO | Bây giờ — bạn đang đọc |
| [`DEPLOYMENT.md`](./DEPLOYMENT.md) | DevOps | Lúc deploy lần đầu |
| [`ARCHITECTURE-COMMERCIAL.md`](./ARCHITECTURE-COMMERCIAL.md) | Developer | Khi cần hiểu vì sao LS-proxy chứ không phải hybrid |
| [`DEBUGGING.md`](./DEBUGGING.md) | Developer / DevOps | Khi có khách báo lỗi |
| [`CMS-CEO-GUIDE.md`](./CMS-CEO-GUIDE.md) | CEO | Khi muốn sửa copy marketing |
| [`CMS-FRONTEND-INTEGRATION.md`](./CMS-FRONTEND-INTEGRATION.md) | Developer | Khi extend CMS cho section mới |
| [`API-CONTRACT.md`](./API-CONTRACT.md) | Developer / Partner | Khi tích hợp SDK |
| [`MODULE-MAP.md`](./MODULE-MAP.md) | Developer | Trace bug theo module |
