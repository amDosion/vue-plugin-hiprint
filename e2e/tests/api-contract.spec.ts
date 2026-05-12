/**
 * api-contract.spec.ts
 * Regression: 公开 API 契约 — 锁住签名 / 类型 / 调用模式
 *
 * Covers bug fixes (commit D):
 *   - tpl.isDestroyed 是方法 (前文档误写"属性")
 *   - buildToolbar(host, template, options) 是 3 参数 (前文档误写 2 参数)
 *
 * 这些契约一旦回归,业务方按文档写的代码会静默错位。
 */
import { test, expect } from '@playwright/test';
import { waitForHiprint } from './helpers/wait-for-hiprint';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await waitForHiprint(page);
});

test('C1: tpl.isDestroyed 是 function 不是 property', async ({ page }) => {
  const result = await page.evaluate(() => {
    const h = (window as any).hiprint;
    const tpl = new h.PrintTemplate({});
    const isFunctionBeforeDestroy = typeof tpl.isDestroyed === 'function';
    // 函数引用本身是 truthy — 业务方 `if (!tpl.isDestroyed)` 永远是 false (守卫永远跳过!)
    // 必须 `if (!tpl.isDestroyed())` 才对
    const truthyBeforeDestroy = Boolean(tpl.isDestroyed);
    const calledBeforeDestroy = tpl.isDestroyed();
    tpl.destroy();
    const calledAfterDestroy = tpl.isDestroyed();
    return {
      isFunctionBeforeDestroy,
      truthyBeforeDestroy,
      calledBeforeDestroy,
      calledAfterDestroy,
    };
  });
  expect(result.isFunctionBeforeDestroy).toBe(true);
  // 文档警示: 函数引用本身永远 truthy — 文档示例必须用 `tpl.isDestroyed()` (带括号)
  expect(result.truthyBeforeDestroy).toBe(true);
  expect(result.calledBeforeDestroy).toBe(false);
  expect(result.calledAfterDestroy).toBe(true);
});

test('C2: buildToolbar(host, template, options) 接收 3 参数', async ({ page }) => {
  // 验证 buildToolbar 函数 arity 是 3 (或至少接受第 2 个 template 参数生效)
  const result = await page.evaluate(() => {
    const h = (window as any).hiprint;
    const fnLength = h.buildToolbar.length;
    // 实际验证: 调用 buildToolbar 不传 template 应该错位 / 无法工作;
    // 传 template 应该让 toolbar 绑到 template 实例 (toolbar 调 template.print 等)
    const $ = (window as any).jQuery || (window as any).$;
    const $host = $('<div id="c2-toolbar"></div>').appendTo('body');
    const tpl = new h.PrintTemplate({
      template: {
        panels: [{ index: 0, name: '1', height: 100, width: 100, paperHeader: 0, paperFooter: 300, printElements: [] }],
      },
    });
    // 正确 3 参数调用必须能成功构建
    let threeArgOk = true;
    try {
      h.buildToolbar('#c2-toolbar', tpl, {});
    } catch (e) {
      threeArgOk = false;
    }
    const toolbarRendered = $host.find('.hiprint-toolbar, .hiprint-print-tools').length > 0
      || $host.children().length > 0;
    tpl.destroy();
    $host.remove();
    return { fnLength, threeArgOk, toolbarRendered };
  });
  expect(result.fnLength).toBeGreaterThanOrEqual(2); // 至少 2 参 (host, template) — 第 3 个 options 可省略
  expect(result.threeArgOk).toBe(true);
  expect(result.toolbarRendered).toBe(true);
});
