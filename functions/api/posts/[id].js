/* Cloudflare Pages Functions · /api/posts/:id
 * GET  → 单篇    PUT → 更新    DELETE → 删除
 * 数据存储于 D1 数据库（绑定名 DB，见 wrangler.toml）
 */
import { handlePostId } from '../../_lib/api-core.js';

export async function onRequestGet(context) {
  return handlePostId(context.request, context.env, context.params.id);
}

export async function onRequestPut(context) {
  return handlePostId(context.request, context.env, context.params.id);
}

export async function onRequestDelete(context) {
  return handlePostId(context.request, context.env, context.params.id);
}

export async function onRequestOptions(context) {
  return handlePostId(context.request, context.env, context.params.id);
}