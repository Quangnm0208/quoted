/**
 * middleware/magicMime.js — Validate file bằng magic numbers (file signature).
 *
 * Tại sao cần:
 *   - multer chỉ check `Content-Type` header — attacker dễ fake
 *   - file `.exe` rename thành `.jpg` vẫn pass MIME check
 *   - Phải đọc N byte đầu file để xác định format thực sự
 *
 * Library: `file-type` (pure JS, không native deps).
 *
 * Allowed MIME (whitelist):
 *   - image/jpeg, image/png, image/webp, image/gif
 *
 * Block:
 *   - SVG (XSS risk, cần sanitize riêng → tạm cấm)
 *   - PDF, ZIP, EXE, anything else
 *
 * Pixel bomb prevention:
 *   - sharp.metadata() check width × height < MAX_PIXELS
 *   - Reject nếu ảnh quá lớn (decompression bomb attack)
 */

import { fileTypeFromBuffer } from 'file-type';
import sharp from 'sharp';
import { HttpError } from '../lib/asyncHandler.js';

const ALLOWED_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

// 25MP: ~5000x5000. Giam tu 50MP de tranh OOM tren 512MB VM.
const MAX_PIXELS = 25_000_000;

/**
 * Validate file buffer trước khi sharp process.
 *
 * @param {Buffer} buffer
 * @returns {Promise<{ mime: string, ext: string, width: number, height: number }>}
 * @throws HttpError(400) nếu invalid
 */
export async function validateImageBuffer(buffer) {
  if (!buffer || buffer.length === 0) {
    throw new HttpError(400, 'Empty file', 'INVALID_FILE');
  }

  // 1. Magic number check
  const detected = await fileTypeFromBuffer(buffer);
  if (!detected) {
    throw new HttpError(400, 'Không xác định được định dạng file. File có thể bị hỏng.', 'BAD_FILE_FORMAT');
  }
  if (!ALLOWED_MIMES.has(detected.mime)) {
    throw new HttpError(
      400,
      `Định dạng "${detected.mime}" không được chấp nhận. Chỉ cho phép: JPEG, PNG, WebP, GIF.`,
      'UNSUPPORTED_FORMAT'
    );
  }

  // 2. Dimension + pixel bomb check (sharp.metadata() cheap — không decode full image)
  let metadata;
  try {
    metadata = await sharp(buffer, { failOn: 'truncated' }).metadata();
  } catch (err) {
    throw new HttpError(400, 'File ảnh không đọc được: ' + err.message, 'CORRUPTED_IMAGE');
  }
  if (!metadata.width || !metadata.height) {
    throw new HttpError(400, 'File ảnh không có dimensions hợp lệ', 'INVALID_IMAGE');
  }
  const pixels = metadata.width * metadata.height;
  if (pixels > MAX_PIXELS) {
    throw new HttpError(
      400,
      `Ảnh quá lớn (${metadata.width}×${metadata.height}, ${(pixels / 1e6).toFixed(1)}MP). Tối đa ${MAX_PIXELS / 1e6}MP.`,
      'IMAGE_TOO_LARGE'
    );
  }

  return {
    mime: detected.mime,
    ext: detected.ext,
    width: metadata.width,
    height: metadata.height,
    detected_format: metadata.format,
  };
}
