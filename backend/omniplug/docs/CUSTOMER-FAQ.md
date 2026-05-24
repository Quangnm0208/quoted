# Customer FAQ — pre-written replies for common questions

Each section is meant to be copy-paste-able into a support reply with minor personalization.

---

## "Tôi không thấy thông tin liên hệ trong leads, chỉ thấy 091•••5678"

> Chào anh/chị,
>
> Đây là tính năng của gói **Community Free** — thông tin liên hệ được che để bảo vệ dữ liệu khi anh/chị chưa có license. **Toàn bộ dữ liệu vẫn được lưu đầy đủ trong hệ thống** — không bị xoá, không bị mất. Sau khi nâng cấp lên Lite (12tr/năm) và kích hoạt license, tất cả lead cũ + lead mới sẽ tự động hiển thị đầy đủ.
>
> Anh/chị có muốn dùng thử Lite 14 ngày miễn phí không?
>
> — OmniPlug

---

## "Tôi paste JWT vào nhưng báo `LICENSE_DOMAIN_MISMATCH`"

> Chào anh/chị,
>
> License được phát hành cho domain `{signed_for_domain}` nhưng deployment của anh/chị đang ở domain `{tenant_domain}`. Đây là cơ chế bảo vệ để license không bị share/reuse sang server khác.
>
> Có 2 lựa chọn:
>
> 1. Nếu domain `{tenant_domain}` là đúng deployment anh/chị muốn dùng → reply email này để mình re-sign license với domain mới (mất ~1h).
> 2. Nếu deployment anh/chị đang ở sai domain → cập nhật DNS / Fly app cho khớp với `{signed_for_domain}`.
>
> Cho mình biết hướng nào nhé.
>
> — OmniPlug

---

## "Tôi gọi `/api/v1/leads` nhưng báo `IP_RATE_LIMITED`"

> Chào anh/chị,
>
> Hệ thống có giới hạn **60 request/phút từ mỗi IP** ở tầng đầu để chống abuse. Nếu anh/chị thực sự cần throughput cao hơn:
>
> 1. **Distribute traffic across multiple IPs** — đặt SDK ở nhiều worker.
> 2. **Dùng `Authorization: Bearer <api-key>` đúng cách** — request có API key hợp lệ vẫn dùng IP bucket, nhưng nếu key của anh/chị bị share trên nhiều IP thì mỗi IP có quota riêng.
> 3. **Upgrade lên Pro/Pro+** — quota daily lên 500k/2M requests, đủ cho hầu hết use case.
>
> Cho mình biết workload của anh/chị (req/s peak, geographic distribution) thì mình tư vấn cụ thể hơn.
>
> — OmniPlug

---

## "Tôi mất API key, làm sao lấy lại?"

> Chào anh/chị,
>
> API key của OmniPlug **không thể recover** — bản thân hệ thống không lưu cleartext key (chỉ lưu bcrypt hash để chống leak). Nhưng không sao, mình sẽ:
>
> 1. **Revoke key cũ** (key cũ ngay lập tức không dùng được nữa).
> 2. **Mint key mới** và gửi cho anh/chị qua 1Password share (ưu tiên) hoặc email signed PGP.
>
> Cho mình biết:
> - Tenant ID của anh/chị (xem ở /admin/tenants).
> - Prefix của key cũ (8 ký tự sau `op_live_`, ví dụ `op_live_AbCdEf12_…` → prefix là `AbCdEf12`).
> - Nếu nghi key bị leak (commit lên git public, share trong group, etc.), nói rõ — mình sẽ ưu tiên xử lý.
>
> SLA: ≤ 4h trong giờ làm việc.
>
> — OmniPlug

---

## "License của tôi hết hạn, làm sao gia hạn?"

> Chào anh/chị,
>
> Có 2 hướng:
>
> 1. **Gia hạn cùng plan** (ví dụ Lite → Lite tiếp 1 năm): 12tr/năm cho Lite, hoá đơn gửi qua email. Sau khi thanh toán mình sẽ re-sign license với `expires_at` mới và gửi file `.jwt` mới — paste lại vào /admin/license/.
>
> 2. **Nâng cấp plan** (ví dụ Lite → Standard): chỉ trả phần chênh lệch cho phần còn lại của năm + phần mới. Liên hệ <sales@omniplug.com> để báo giá cụ thể.
>
> Trong thời gian chờ gia hạn, deployment vẫn hoạt động bình thường nhưng `/api/v1/*` sẽ trả `LICENSE_EXPIRED`. Bạn cần gia hạn trước hạn để tránh gián đoạn integration.
>
> — OmniPlug

---

## "Tại sao OmniPlug bắt tôi hiển thị `Powered by OmniPlug`?"

> Chào anh/chị,
>
> Đây là điều khoản của các gói **Community / Lite / Standard** — một dòng attribution nhỏ giúp OmniPlug phát triển hệ sinh thái. Nếu anh/chị không muốn hiển thị, vui lòng nâng cấp lên **Pro hoặc Pro+** — attribution sẽ tự động bị tắt ngay sau khi kích hoạt.
>
> Cụ thể về attribution:
> - Community (L1): badge "Powered by OmniPlug" hiện trong footer admin
> - Lite (L2): header HTTP `X-Powered-By` (không hiển thị visible cho user cuối)
> - Standard (L3): meta tag trong footer page
> - Pro / Pro+: hoàn toàn không có
>
> Việc cố tình strip attribution ở Community/Lite/Standard vi phạm Terms of Service và có thể dẫn đến revocation license.
>
> — OmniPlug

---

## "Có thể tự host OmniPlug trên server của tôi không?"

> Có. OmniPlug CMS Core thiết kế self-hosted ngay từ đầu. Tài liệu deployment:
> - **Fly.io** (recommended): `fly launch` từ repo, ~5 phút.
> - **Docker compose**: file `docker-compose.yml` trong repo.
> - **Bare metal**: Node.js 20+ và SQLite — chạy `node src/backend/server.js`.
>
> License vẫn theo plan như cloud version — paid plan cần JWT từ OmniPlug, không phụ thuộc OmniPlug có chạy hay không. Bridge server (v1.5.0) sẽ optional cho việc auto-sync CRL.
>
> Repo: <https://github.com/omniplug/cms-core>

---

## "Có refund không?"

> Có. OmniPlug có chính sách refund 14 ngày đầu cho mọi plan trả phí. Sau 14 ngày, không refund — nhưng có thể credit sang plan khác hoặc kéo dài thời hạn.
>
> Để request refund: email <sales@omniplug.com> kèm hoá đơn + lý do. Xử lý trong 3-5 ngày làm việc.

---

## "OmniPlug có thu thập dữ liệu gì không (telemetry)?"

> Mặc định trong v1.4.4: **không**. Biến môi trường `TELEMETRY_URL=disabled` đã được set sẵn trong `fly.toml`.
>
> Nếu anh/chị bật telemetry sau này (tự nguyện), hệ thống chỉ gửi:
> - `instance_uuid` (UUID ngẫu nhiên, không phải email/domain)
> - Version, Node.js version, số tenant
> - Timestamp
>
> Không gửi: lead data, user emails, content, IP của user cuối, query strings, v.v.
>
> Source code có thể audit tại `src/core/lib/telemetry.js`.

---

**Maintainer:** Quang (<licensing@omniplug.com>) — last updated 2026-05-20.
