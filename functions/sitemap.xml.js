/* Cloudflare Pages Functions · 根路径 /sitemap.xml（SEO 站点地图）
 * 站点地址取 env.SITE_URL，未配置则用请求来源；
 * 文章增删改查后已自动刷新边缘缓存，因此此文件始终是云端最新文章数据。 */
import { handleSitemap } from './_lib/api-core.js';

export async function onRequestGet(context) {
  return handleSitemap(context.request, context.env);
}
export async function onRequestOptions(context) {
  return handleSitemap(context.request, context.env);
}
