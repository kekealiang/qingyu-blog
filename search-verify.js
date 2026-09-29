/* 隔离验证搜索函数（不经过 route，避免 test stub 缺少 document.body.style） */
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
    style: {}, dataset: {}, classList: { add() {}, remove() {} },
    closest: () => null, focus() {}, disabled: false,
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
    window: win, document: doc,
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
  return { ctx: base, win };
}

const { ctx, win } = makeCtx();
vm.runInContext(fs.readFileSync(path.join(PUB, 'posts.js'), 'utf8'), ctx, { filename: 'posts.js' });
vm.runInContext(fs.readFileSync(path.join(PUB, 'app.js'), 'utf8'), ctx, { filename: 'app.js' });

let pass = 0, fail = 0;
function ok(name, cond) {
  if (cond) { pass++; console.log('  ✅ ' + name); }
  else { fail++; console.log('  ❌ ' + name); }
}

// ---- 1. 句子上下文：关键字所在完整句子，前后含省略号语境 ----
const post = {
  id: 't1', title: '测试文章', content:
    '第一句话介绍背景。这是一篇关于搜索功能的文章，关键字“云存储”出现在本句中部，后面还有补充内容。第三句作为结尾。',
  excerpt: '云存储是一种存储方式', tags: ['技术'],
};
const snip1 = ctx.searchSnippet(post, '云存储');
ok('片段包含关键字', snip1.indexOf('云存储') >= 0);
ok('片段是完整句子（含“本句中部”上下文）', snip1.indexOf('本句中部') >= 0);
ok('片段含前后语境而非裸 30/40 切片', snip1.length > 30 && snip1.indexOf('关键字') >= 0);

// ---- 2. 高亮：<mark> 包裹，且对原文转义（防 XSS）----
const hl = ctx.highlightQuery('带 <b> 标签的 云存储 结果', '云存储');
ok('关键字被 <mark class="sh-hl"> 包裹', hl.indexOf('<mark class="sh-hl">云存储</mark>') >= 0);
ok('非关键字部分的 < 被转义', hl.indexOf('&lt;b&gt;') >= 0);
ok('mark 之前无裸 <b>', hl.indexOf('<b>') < 0);

// ---- 3. 标题高亮 ----
const hlt = ctx.highlightQuery(post.title, '测试');
ok('标题关键字也被高亮', hlt.indexOf('<mark class="sh-hl">测试</mark>') >= 0);

// ---- 4. 句子过短时并入相邻句 ----
const post2 = { id: 't2', title: '短句', content: '上面一句。关键字就在这。下面一句。', excerpt: '', tags: [] };
const snip2 = ctx.searchSnippet(post2, '关键字');
ok('短句并入前一句（含“上面一句”）', snip2.indexOf('上面一句') >= 0);
ok('短句并入后一句（含“下面一句”）', snip2.indexOf('下面一句') >= 0);

// ---- 5. 找不到关键字返回空 ----
ok('无命中返回空串', ctx.searchSnippet({ id: 'x', title: 'a', content: 'b' }, '不存在词') === '');

// ---- 6. 超长句以关键字为中心裁剪 + 省略号 ----
const longContent = '起始铺垫文字。' + '非常长的句子描述'.repeat(20) + '目标词放在这里' + '后续大量填充内容'.repeat(20) + '。结束。';
const post3 = { id: 't3', title: '长', content: longContent, excerpt: '', tags: [] };
const snip3 = ctx.searchSnippet(post3, '目标词');
ok('超长片段含关键字', snip3.indexOf('目标词') >= 0);
ok('超长片段被裁剪（远小于原文长度）', snip3.length < longContent.length);
ok('超长片段前后有省略号', snip3.indexOf('…') >= 0);

console.log('\n结果: ' + pass + ' 通过, ' + fail + ' 失败');
process.exit(fail > 0 ? 1 : 0);
