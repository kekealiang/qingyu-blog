/* ============================================================
 * 轻语博客 · 导入示例数据到云端 API
 * ------------------------------------------------------------
 * 用法：
 *   node seed.js https://www.2024921.xyz [--token <会话或写入令牌>]
 *   node seed.js https://your-blog.example.com [--token ...]
 * 说明：
 *   · 会把 public/posts.js 里的示例文章逐篇 POST 到 /api/posts，
 *     已存在的 id 自动跳过（幂等，可重复执行）。
 *   · 若后端开启了写鉴权（管理员密码存 KV / BLOG_WRITE_TOKEN），
 *     需提供凭证，二选一：
 *       1) --token <token>  命令参数（登录后浏览器 localStorage 里的 qingyu.token，
 *          或旧式 BLOG_WRITE_TOKEN）
 *       2) 环境变量 BLOG_TOKEN
 * ============================================================ */
'use strict';
const fs = require('fs');
const vm = require('vm');
const path = require('path');

async function main() {
  const args = process.argv.slice(2);
  const base = args[0];
  const ti = args.indexOf('--token');
  const token = (ti >= 0 && args[ti + 1]) || process.env.BLOG_TOKEN || '';
  if (!base) {
    console.error('用法：node seed.js <站点地址> [--token <token>]\n示例：node seed.js https://www.2024921.xyz');
    process.exit(1);
  }

  // 解析 posts.js（JS 字面量，非 JSON）
  const src = fs.readFileSync(path.join(__dirname, 'public', 'posts.js'), 'utf8');
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  const posts = sandbox.window.BLOG_POSTS || [];

  const api = base.replace(/\/+$/, '') + '/api/posts';
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  console.log('目标 API：' + api + (token ? '（已携带凭证）' : '（无凭证，若后端要求鉴权将返回 401）'));

  let created = 0, skipped = 0, failed = 0;
  for (const p of posts) {
    try {
      const r = await fetch(api, {
        method: 'POST',
        headers,
        body: JSON.stringify(p)
      });
      if (r.status === 201) { created++; console.log('  ✅ 已创建：' + p.title); }
      else if (r.status === 409) { skipped++; console.log('  ⏭ 已存在：' + p.title); }
      else { failed++; console.log('  ❌ 失败(' + r.status + ')：' + p.title + ' — ' + ((await r.json().catch(() => ({}))).error || '')); }
    } catch (e) {
      failed++;
      console.log('  ❌ 请求异常：' + p.title + ' — ' + e.message);
    }
  }

  console.log(`\n完成：新建 ${created} / 跳过 ${skipped} / 失败 ${failed}`);
  if (failed && !token) console.log('提示：若后端开启写鉴权，请携带凭证重试（--token 或 BLOG_TOKEN 环境变量）。');
  process.exit(failed ? 1 : 0);
}

main();