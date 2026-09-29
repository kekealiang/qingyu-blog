/* 留言板功能隔离验证（复用评论云管道） */
'use strict';
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const dir = __dirname;
const PUB = path.join(dir, 'public');

function makeCtx() {
  const mem = {};
  const stubEl = () => ({
    addEventListener() {}, textContent: '', innerHTML: '', value: '',
    style: {}, dataset: {}, classList: { add() {}, remove() {}, toggle() {} },
    closest: () => null, focus() {}, disabled: false,
    querySelector: () => null,
  });
  const body = { appendChild() {}, removeChild() {}, style: {} };
  const doc = {
    title: '', documentElement: { setAttribute() {}, getAttribute: () => 'light' },
    querySelector: () => stubEl(), querySelectorAll: () => [],
    createElement: () => Object.assign(stubEl(), { click() {}, set href(v) {} }),
    body, addEventListener() {},
  };
  const win = {
    BLOG_POSTS: [], addEventListener() {}, matchMedia: () => ({ matches: false }),
    scrollTo() {}, crypto,
  };
  const base = {
    window: win, document: doc, navigator: { language: 'zh-CN', userLanguage: '' },
    location: { protocol: 'https:', origin: 'https://t.example', host: 't.example', pathname: '/', search: '', hash: '', href: 'https://t.example/' },
    history: { pushState() {}, replaceState() {} },
    localStorage: { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => { delete mem[k]; } },
    confirm: () => true, alert: () => {}, prompt: () => null,
    setTimeout, clearTimeout, URLSearchParams, Blob: function () {},
    URL: { createObjectURL: () => 'blob', revokeObjectURL() {} },
    console, Date, JSON, Math, String, Array, Object, RegExp, Map, Set, Uint8Array,
    TextEncoder, TextDecoder, btoa, atob, encodeURIComponent, decodeURIComponent,
  };
  vm.createContext(base);
  return { ctx: base, win, mem };
}

const { ctx, win } = makeCtx();
vm.runInContext(fs.readFileSync(path.join(PUB, 'i18n.js'), 'utf8'), ctx, { filename: 'i18n.js' });
vm.runInContext(fs.readFileSync(path.join(PUB, 'posts.js'), 'utf8'), ctx, { filename: 'posts.js' });
// 让 app.js 里的裸 t() 可解析：把翻译函数挂到上下文全局
ctx.t = (k, v) => win.__i18n.t(k, v);
vm.runInContext(fs.readFileSync(path.join(PUB, 'app.js'), 'utf8'), ctx, { filename: 'app.js' });

let pass = 0, fail = 0;
function ok(name, cond) { if (cond) { pass++; console.log('  ✅ ' + name); } else { fail++; console.log('  ❌ ' + name); } }

(async function () {
  // 1. id 映射
  ok('guestbookId note -> gb-note', ctx.guestbookId('note') === 'gb-note');
  ok('guestbookId idea -> gb-idea', ctx.guestbookId('idea') === 'gb-idea');

  // 2. renderGuestbook 产出关键结构（静态环境，mode 默认静态）
  ctx.location.pathname = '/guestbook';
  const html = ctx.renderGuestbook();
  ok('含留言板标题', html.indexOf('guestbook') >= 0);
  ok('含分区切换 tabs（留言/优化方案）', html.indexOf('gbTabs') >= 0 && html.indexOf('data-kind="idea"') >= 0);
  ok('含表单元素（昵称/文本域/提交）', html.indexOf('gbAuthor') >= 0 && html.indexOf('gbContent') >= 0 && html.indexOf('gbSubmit') >= 0);
  ok('含列表容器', html.indexOf('gbList') >= 0);
  ok('含顶部导航（renderNav）', html.indexOf('main-nav') >= 0);

  // 3. 内存路由器注册：/guestbook 路由应调用 renderGuestbook
  const routePath = ctx.currentRoute().path;
  console.log('  (route path = ' + routePath + ')');
  ok('路由解析 /guestbook', routePath === '/guestbook');

  // 4. 前端 saveComment/loadComments 复用（静态模式回退 localStorage）
  const saved = await ctx.saveComment('gb-note', '测试用户', '这是一条测试留言');
  ok('静态模式 saveComment 返回对象', !!(saved && saved.author === '测试用户'));
  const list = await ctx.loadComments('gb-note');
  ok('静态模式 loadComments 取回留言', list.length >= 1);

  // 5. 云端模式失败透传：saveComment 抛出后端具体错误（而非静默 null）
  win.BLOG_CONFIG = Object.assign({}, win.BLOG_CONFIG, { mode: 'api' });
  const origFetch = ctx.apiFetch;
  ctx.apiFetch = async function () { throw new Error('请勿重复发送相同内容'); };
  let dupErr = null;
  try { await ctx.saveComment('gb-note', '测试用户', '这是一条测试留言'); }
  catch (e) { dupErr = e; }
  ok('云端重复发送时 saveComment 抛错', !!dupErr);
  ok('错误消息透传后端文案', !!(dupErr && dupErr.message === '请勿重复发送相同内容'));
  // 频控场景同理
  ctx.apiFetch = async function () { throw new Error('评论太频繁，请稍后再试'); };
  let rateErr = null;
  try { await ctx.saveComment('gb-note', '测试用户', '第二条'); }
  catch (e) { rateErr = e; }
  ok('频控错误同样透传', !!(rateErr && rateErr.message === '评论太频繁，请稍后再试'));
  ctx.apiFetch = origFetch;
  delete win.BLOG_CONFIG.mode;   // 还原静态模式，避免影响后续断言

  // 6. syncDeletedPost：前台内存/缓存同步删除
  win.BLOG_POSTS = [{ id: 'a', title: 'A' }, { id: 'b', title: 'B' }];
  ctx.localStorage.setItem('qingyu.postCache.a', '{"post":{"id":"a","content":"x"}}');
  const removed = ctx.syncDeletedPost('a');
  ok('syncDeletedPost 返回 true 且移除文章', removed === true && win.BLOG_POSTS.length === 1 && win.BLOG_POSTS[0].id === 'b');
  ok('正文缓存同步清除', ctx.localStorage.getItem('qingyu.postCache.a') === null);
  ok('删除不存在的文章返回 false', ctx.syncDeletedPost('不存在') === false);

  // 7. 存储型 XSS 回归：回复标签渲染父评论作者名时必须转义（app.js renderCommentTree）
  //    作者名服务端只清控制字符，昵称可含 HTML；若拼接进 innerHTML 前未 esc，
  //    他人回复该评论时会对所有访客触发 XSS（曾为真实漏洞，见 app.js:1691 修复注释）。
  const xssAuthor = '<img src=x onerror=alert(1)>';
  const tree = ctx.renderCommentTree([
    { id: 'c1', author: xssAuthor, content: '父评论', date: '2025-01-01', parent_id: null },
    { id: 'c2', author: '回复者', content: '回复', date: '2025-01-02', parent_id: 'c1' }
  ], false);
  ok('父评论作者名已转义（渲染结果无裸 <img）', tree.indexOf('<img') < 0);
  ok('作者名以 &lt;img 形式存在', tree.indexOf('&lt;img') >= 0);

  console.log('\n结果: ' + pass + ' 通过, ' + fail + ' 失败');
  process.exit(fail > 0 ? 1 : 0);
})();

