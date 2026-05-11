/**
 * print-pdf.spec.ts
 * Regression: toPdf Promise resolve/reject + destroy race
 *
 * Covers (P1 e2e 100% expansion for V2 refactor):
 *   - toPdf 返回 jQuery deferred-like Promise (#toPdf-promise)
 *   - destroy 后 toPdf 立即 reject (R3 state-modeler fix #toPdf-destroyed-reject)
 *   - toPdf 不修改原 template (无副作用 #toPdf-no-side-effect)
 *
 * 注: toPdf 内部用 domtoimage + jsPDF, e2e 不验证 PDF 内容只验证 Promise 行为
 */
import { test, expect } from '@playwright/test';
import { waitForHiprint } from './helpers/wait-for-hiprint';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await waitForHiprint(page);
});

test('toPdf 返回 thenable Promise', async ({ page }) => {
  const isThenable = await page.evaluate(() => {
    const h = (window as any).hiprint;
    const tpl = new h.PrintTemplate({
      template: { panels: [{ index: 0, name: '1', height: 100, width: 100, paperHeader: 0, paperFooter: 300, printElements: [] }] }
    });
    const ret = tpl.toPdf({}, 'test', { isDownload: false });
    const thenable = ret && typeof ret.then === 'function';
    tpl.destroy();
    return thenable;
  });
  expect(isThenable).toBe(true);
});

test('destroy 后 toPdf 立即返回 rejected Promise (R3 state-modeler)', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const h = (window as any).hiprint;
    const tpl = new h.PrintTemplate({
      template: { panels: [{ index: 0, name: '1', height: 100, width: 100, paperHeader: 0, paperFooter: 300, printElements: [] }] }
    });
    tpl.destroy();
    // destroy 后调 toPdf 应立即 reject
    let rejected = false;
    let resolvedVal: any;
    try {
      resolvedVal = await tpl.toPdf({}, 'test', { isDownload: false });
    } catch (err: any) {
      rejected = true;
      return { rejected, msg: err.message };
    }
    return { rejected, resolvedVal };
  });
  // toPdf destroyed 时 _assertNotDestroyed 返回 jQuery Deferred reject
  expect(result.rejected).toBe(true);
  expect(result.msg).toContain('destroyed');
});

test('toPdf 不影响 template 内部状态 (printPanels 不变)', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const h = (window as any).hiprint;
    const tpl = new h.PrintTemplate({
      template: { panels: [{ index: 0, name: '1', height: 100, width: 100, paperHeader: 0, paperFooter: 300, printElements: [] }] }
    });
    const beforeCount = tpl.printPanels.length;
    try { await tpl.toPdf({}, 'test', { isDownload: false }); } catch { /* 没 panel 内容可能 reject 也 OK */ }
    const afterCount = tpl.printPanels.length;
    tpl.destroy();
    return { beforeCount, afterCount };
  });
  expect(result.afterCount).toBe(result.beforeCount);
});
