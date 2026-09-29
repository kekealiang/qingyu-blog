/* Cloudflare Pages Functions · /api/media/upload-url
 * POST → 签发 R2 预签名上传 URL（图片浏览器直传，媒体专用桶）
 * 与 worker.js 的 /api/media/upload-url 路由行为一致。 */
import { handleMediaUploadUrl } from '../../_lib/media.js';

export async function onRequest(context) {
  return handleMediaUploadUrl(context.request, context.env);
}