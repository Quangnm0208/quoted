# OmniPlug — Customer Onboarding Script

After payment confirms, send this email (Vietnamese) — adjust personalization.

---

**Subject:** Chào mừng đến với OmniPlug — License của bạn đã sẵn sàng

Chào anh/chị **{customer_name}**,

Cảm ơn anh/chị đã tin tưởng OmniPlug. Đính kèm email này là **2 file quan trọng**:

1. **`{customer_slug}-license.jwt`** — license file của anh/chị
2. **`{customer_slug}-api-key.txt`** — API key (chỉ cần nếu anh/chị tích hợp SDK)

## Kích hoạt trong 3 bước (~2 phút)

1. Đăng nhập vào `/admin` trên trang của anh/chị.
2. Vào tab **🔑 License** (góc trên bên phải).
3. Mở file `.jwt` đính kèm, copy toàn bộ nội dung, paste vào ô trên trang và click **"Kích hoạt"**.

Sau khi kích hoạt thành công anh/chị sẽ thấy:
- Banner màu vàng "Community Free" biến mất.
- Gói được nâng từ "Community Free" lên **{plan_label}**.
- Tất cả lead cũ (nếu có) tự động unmask hiển thị đầy đủ thông tin liên hệ.

## API Key

Nếu anh/chị có dùng SDK / CRM integration, file `api-key.txt` chứa key dạng:
```
op_live_AbCdEfGh_<32-char-secret>
```

**Lưu ý quan trọng:**
- Key này chỉ được hiển thị **MỘT LẦN** trong lịch sử OmniPlug. Hãy lưu vào 1Password hoặc password manager của anh/chị NGAY.
- Nếu anh/chị làm mất key, contact ngay <ops@omniplug.com> — chúng tôi sẽ tạo lại key mới và revoke key cũ trong vòng 1h làm việc.
- Đừng commit key này vào git public repository.

Cách dùng key trong SDK:
```js
import { OmniPlug } from '@omniplug/sdk';
const client = new OmniPlug({ apiKey: 'op_live_AbCdEfGh_<...>' });
```

## Câu hỏi thường gặp

- **License hết hạn khi nào?** Sau {expires_in_days} ngày kể từ hôm nay ({expires_at}).
- **Có thể đổi domain không?** Có — gửi yêu cầu qua email, chúng tôi sẽ re-sign license trong 1h làm việc.
- **Sao tôi vẫn không thấy `/api/v1/*` hoạt động?** Anh/chị cần dùng cả **JWT (License)** + **API Key**. Kích hoạt JWT mở cổng cho gói trả phí; API key là credential để gọi API.

## Liên hệ

- **Hỗ trợ kỹ thuật:** <ops@omniplug.com>
- **Vấn đề thanh toán / nâng cấp:** <sales@omniplug.com>
- **Khẩn cấp (security incident, key leak):** <licensing@omniplug.com>

Chúc anh/chị triển khai thuận lợi 🚀

— OmniPlug team
