/* Cloudflare Pages Functions · /api/media
 * GET → 媒体列表   POST → 登记媒体元数据（url 为 R2 公开地址或 http(s) 外链） */
import { handleMedia } from '../_lib/api-core.js';

export async function onRequest(context) {
  return handleMedia(context.request, context.env);
}
