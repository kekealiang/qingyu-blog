/* Cloudflare Pages Functions · 根路径 /feed.xml（RSS 源）
 * 站点地址取 env.SITE_URL，未配置则用请求来源；
 * 由云端最新文章生成 RSS 2.0，文章增删改查后自动更新。 */
import { handleFeed } from './_lib/api-core.js';

export async function onRequestGet(context) {
  return handleFeed(context.request, context.env);
}
export async function onRequestOptions(context) {
  return handleFeed(context.request, context.env);
}
