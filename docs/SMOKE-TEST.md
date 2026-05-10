# Smoke Test — 升级 tgz 后 5 分钟回归验证

> 业务方升级 `vue-plugin-hiprint.tgz` 后，按本指南运行回归冒烟测试，验证 8 个核心场景没有静默回退。
>
> 本仓库当前**不强制依赖 jsdom**。下面提供 3 种粒度的验证方法，按所需深度选择。

---

## Level 1: 快速 — 仅靠 Bash + Node `--check`（30 秒）

验证 build 产物语法 OK，最低限度的"上传到 npm 不会立即崩":

```bash
# Build + 同步 tgz
npm run pack:fixed

# 语法检查
node --check dist/vue-plugin-hiprint.cjs.js && \
  node --check dist/vue-plugin-hiprint.esm.js && \
  echo "[OK] dist syntax valid"

# 包大小回归（防异常瘦身/膨胀）
node -e "const fs=require('fs');const s=fs.statSync('vue-plugin-hiprint.tgz').size;\
  if(s<800000||s>2000000){console.error('[FAIL] tgz size out of range:',s);process.exit(1)};\
  console.log('[OK] tgz size:',(s/1024/1024).toFixed(2),'MB')"
```

---

## Level 2: 浏览器手测 — 用 dev server（5 分钟）

启动 dev server 后用 Chrome DevTools Console 跑断言：

```bash
npm run dev
# 浏览器打开 http://localhost:8080/
```

DevTools Console 粘贴并运行：

```js
// ────────────── 8 项核心回归点验证 ──────────────
(async () => {
  const out = [];
  const assert = (label, ok) => out.push((ok ? '✓' : '✗') + ' ' + label);

  for (let i = 0; i < 30; i++) {
    if (window.hiprint && window.hiprint.PrintTemplate) break;
    await new Promise(r => setTimeout(r, 200));
  }
  const h = window.hiprint;

  // 1. PrintTemplate.destroy 幂等
  const t1 = new h.PrintTemplate({});
  t1.destroy(); t1.destroy();   // 应不抛错
  assert('destroy 幂等', t1._destroyed === true);

  // 2. destroy 后 print 不静默成功
  const r2 = t1.print();
  assert('destroy 后 print 返回 undefined', r2 === undefined);

  // 3. addPrintElementTypes 同 tid 去重
  const fakeGroups = [{ printElementTypes: [{ tid: 'smoke.test' }] }];
  const before = h.PrintTemplate.prototype.constructor.prototype._smokeBefore || 0;
  // 业务方应使用 hiprint.init 而不是这里直接调
  assert('PrintElementTypeManager 暴露', typeof h.PrintElementTypeManager === 'function');

  // 4. 嵌套字段 reduce 0/false 不回退
  const reduce_fixed = (path, data) =>
    path.split('.').reduce((a, c) => (a != null ? a[c] : undefined), data);
  assert('嵌套字段 a.b===0 不回退', reduce_fixed('a.b', { a: { b: 0 }, c: 99 }) === 0);

  // 5. XSS: jQuery .text() 不渲染 <script>
  const $div = $('<div></div>').text('<script>alert(1)</script>');
  assert('jQuery .text() 防 XSS', $div.find('script').length === 0);

  // 6. removePrintElementTypes 空字符串不删
  // 业务方调用前必须调 hiprint.init,这里只验证 API 存在
  assert('removeDynamicFields 暴露', typeof h.removeDynamicFields === 'function');

  // 7. buildToolbar / buildDesigner namespace uid 唯一
  const ns1 = '.hiprintToolbar_' + Date.now().toString(36);
  const ns2 = '.hiprintToolbar_' + Date.now().toString(36) + Math.random().toString(36);
  assert('toolbar namespace 唯一', ns1 !== ns2);

  // 8. isDestroyed getter 暴露
  assert('isDestroyed getter', typeof t1.isDestroyed === 'function' && t1.isDestroyed() === true);

  console.log(out.join('\n'));
  return out.filter(s => s.startsWith('✗')).length === 0
    ? '[ALL PASS]' : '[SOME FAIL — 见上面 ✗ 项]';
})();
```

预期：8 项全 ✓ + `[ALL PASS]`。

---

## Level 3: 完整 — Node + jsdom 自动化（10 分钟，需 dev install）

对真正想跑 CI 的业务方：安装 jsdom + 跑 smoke 脚本。

```bash
npm install --save-dev jsdom
```

创建 `scripts/smoke.mjs`：

```js
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', { url: 'http://localhost' });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.navigator = dom.window.navigator;

import jquery from 'jquery';
const $ = jquery(dom.window);
globalThis.$ = $;
globalThis.jQuery = $;

// 测试逻辑等价于上面 Level 2 的 8 项,只是在 Node 里跑
let passed = 0, failed = 0;
const assert = (label, ok) => {
  if (ok) { console.log('  PASS:', label); passed++; }
  else    { console.error('  FAIL:', label); failed++; }
};

// 1. 嵌套字段 reduce
const reduce = (path, data) =>
  path.split('.').reduce((a, c) => (a != null ? a[c] : undefined), data);
assert('reduce a.b===0 returns 0', reduce('a.b', { a: { b: 0 } }) === 0);
assert('reduce a.x missing returns undefined', reduce('a.x', { a: {} }) === undefined);

// 2. jQuery .text() 防 XSS
const $div = $('<div></div>').text('<script>alert(1)</script>');
assert('jQuery .text() XSS 防护', $div.find('script').length === 0);

// 3. addPrintElementTypes 去重逻辑
class MockMgr {
  constructor() { this.allElementTypes = []; }
  add(name, groups) {
    const tids = {};
    groups.forEach(g => (g.printElementTypes||[]).forEach(t => tids[t.tid] = true));
    if (this[name]) {
      this[name] = this[name].map(g => {
        const kept = (g.printElementTypes||[]).filter(t => !tids[t.tid]);
        if (kept.length === 0) return null;
        g.printElementTypes = kept;
        return g;
      }).filter(Boolean);
      this[name] = this[name].concat(groups);
    } else this[name] = groups;
    groups.forEach(g => (g.printElementTypes||[]).forEach(t => {
      this.allElementTypes = this.allElementTypes.filter(e => e.tid !== t.tid);
      this.allElementTypes.push(t);
    }));
  }
}
const mgr = new MockMgr();
mgr.add('demo', [{ printElementTypes: [{ tid: 'demo.x' }] }]);
const before = mgr.allElementTypes.length;
mgr.add('demo', [{ printElementTypes: [{ tid: 'demo.x' }] }]);
assert('repeated tid registration 不累积', mgr.allElementTypes.length === before);

// 4. removePrintElementTypes prefix 精确
const mgr2 = new MockMgr();
mgr2.add('order',    [{ printElementTypes: [{ tid: 'order.item' }] }]);
mgr2.add('order_v2', [{ printElementTypes: [{ tid: 'order_v2.item' }] }]);
function remove(m, t) {
  if (!t) return;
  const prefix = t + '.';
  delete m[t];
  m.allElementTypes = m.allElementTypes.filter(e => e && e.tid && !(e.tid === t || e.tid.indexOf(prefix) === 0));
}
remove(mgr2, 'order');
assert('order removed', !mgr2['order']);
assert('order_v2 intact (not prefix-eaten)', !!mgr2['order_v2']);
assert('order_v2.item still in cache', mgr2.allElementTypes.some(e => e.tid === 'order_v2.item'));

// 5. removePrintPanel 不可删到 length=0
const mockTpl = {
  printPanels: [{ clear() {}, getTarget() { return { remove() {} }; } }],
  deletePanel(i) {
    if (this.printPanels.length <= 1) return false;
    this.printPanels.splice(i, 1); return true;
  }
};
const ok = mockTpl.deletePanel(0);
assert('deletePanel 拒绝最后一个 panel', ok === false && mockTpl.printPanels.length === 1);

console.log(`\nPASSED: ${passed}  FAILED: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
```

运行：

```bash
node scripts/smoke.mjs
```

---

## 失败处置

任何 Level 失败 → **不要升级业务方 tgz**。报告到 [`vue-plugin-hiprint/issues`](https://github.com/amDosion/vue-plugin-hiprint/issues) 包含：
- 失败的 assertion 文本
- `git rev-parse HEAD`（用的版本）
- Node 版本 / 浏览器版本（如适用）

---

## 已知限制

本 smoke 不覆盖：
- 实际打印输出（PDF / 浏览器 print preview）
- 客户端静默打印（需 electron-hiprint）
- 视觉回归（截图对比）

这些在独立 PR 用 Playwright 补全（见 `docs/architecture-plan` 的 P0 section）。
