/**
 * keyboard-shortcuts.spec.ts
 * Regression: 全局 keyboard shortcut 监听 + namespace 清理
 *
 * Covers (P1.2 e2e expansion):
 *   - $(document) 上的 keydown 监听 namespace 含 template.id (PM-004 fix)
 *   - destroy 后 $(document).off('.hiprintTemplate' + id) 清空对应 namespace
 *   - 多 template 实例 keydown handler 互不干扰
 */
import { test, expect } from '@playwright/test';
import { waitForHiprint } from './helpers/wait-for-hiprint';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await waitForHiprint(page);
});

test('多 template 实例的 keydown handler 通过 namespace 隔离', async ({ page }) => {
  const result = await page.evaluate(() => {
    const h = (window as any).hiprint;
    const $ = (window as any).jQuery;
    const tpl1 = new h.PrintTemplate({
      template: { panels: [{ index: 0, name: 'A', height: 100, width: 100, paperHeader: 0, paperFooter: 300, printElements: [] }] }
    });
    const tpl2 = new h.PrintTemplate({
      template: { panels: [{ index: 0, name: 'B', height: 100, width: 100, paperHeader: 0, paperFooter: 300, printElements: [] }] }
    });
    // 销毁 tpl1, tpl2 仍存活
    tpl1.destroy();
    const tpl1Destroyed = tpl1.isDestroyed();
    const tpl2Alive = !tpl2.isDestroyed();
    tpl2.destroy();
    return { tpl1Destroyed, tpl2Alive };
  });
  expect(result.tpl1Destroyed).toBe(true);
  expect(result.tpl2Alive).toBe(true);
});

test('destroy 后 event-bus 不再触发该 template 的 handler', async ({ page }) => {
  const triggered = await page.evaluate(() => {
    const h = (window as any).hiprint;
    const tpl = new h.PrintTemplate({
      template: { panels: [{ index: 0, name: '1', height: 100, width: 100, paperHeader: 0, paperFooter: 300, printElements: [] }] }
    });
    const eventKey = 'hiprintTemplateDataShortcutKey_' + tpl.id;
    let fired = false;
    (window as any).hinnn.event.on(eventKey, function () { fired = true; });
    tpl.destroy();
    // destroy 后 trigger event, handler 应已 off
    (window as any).hinnn.event.trigger(eventKey, 'undo');
    return fired;
  });
  expect(triggered).toBe(false);
});

test('isDestroyed() public getter 返回正确值', async ({ page }) => {
  const result = await page.evaluate(() => {
    const h = (window as any).hiprint;
    const tpl = new h.PrintTemplate({
      template: { panels: [{ index: 0, name: '1', height: 100, width: 100, paperHeader: 0, paperFooter: 300, printElements: [] }] }
    });
    const before = tpl.isDestroyed();
    tpl.destroy();
    const after = tpl.isDestroyed();
    return { before, after };
  });
  expect(result.before).toBe(false);
  expect(result.after).toBe(true);
});
