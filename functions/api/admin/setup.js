/* Cloudflare Pages Functions · /api/admin/setup
 * POST 首次设置管理员密码（需 X-Setup-Key 匹配环境变量 BLOG_ADMIN_SETUP_KEY）
 * 密码经 PBKDF2-SHA256 加盐哈希后存 D1 表 admin_auth，不明文存储。 */
import { handleAdminSetup } from '../../_lib/api-core.js';

export async function onRequest(context) {
  return handleAdminSetup(context.request, context.env);
}
export async function onRequestOptions(context) {
  return handleAdminSetup(context.request, context.env);
}