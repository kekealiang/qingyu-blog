/* Cloudflare Pages Functions · GET /api/ai/ping
 * 能力探测：AI 可用 → 200 {ok:true}；不可用 → 404 {ok:false}
 * 前端以此决定是否渲染 AI 元素（未启用时零干扰）。 */
import { json, corsPreflight } from '../../_lib/api-core.js';
import { aiEnabled } from '../../_lib/ai.js';

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === 'OPTIONS') return corsPreflight(request, env);
  if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405, request, env);
  if (!aiEnabled(env)) return json({ ok: false, error: 'AI 未启用' }, 404, request, env);
  return json({ ok: true }, 200, request, env);
}