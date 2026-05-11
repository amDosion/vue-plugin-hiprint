/**
 * designer-undo-redo.spec.ts
 * Regression: Ctrl+Z / Ctrl+Y 撤销重做 (event-bus trigger)
 *
 * Covers (P1.2 e2e expansion):
 *   - undo() / redo() API 不抛 (#api)
 *   - undo trigger event-bus path (#event-trigger)
 *   - destroy 后 undo/redo return; (R3 W3 #destroyed-no-op)
 *   - historyList / historyPos 初始状态 (#history-init)
 *
 * 注: 真 Ctrl+Z 键盘 emit 涉及 designer 完整初始化, e2e 此处仅验证 API + event-bus.
 */
import { test, expect } from '@playwright/test';
import { waitForHiprint } from './helpers/wait-for-hiprint';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await waitForHiprint(page);
});

test('undo / redo API 不抛 + destroy 后安全', async ({ page }) => {
  const result = await page.evaluate(() => {
    const h = (window as any).hiprint;
    const tpl = new h.PrintTemplate({
      template: { panels: [{ index: 0, name: '1', height: 100, width: 100, paperHeader: 0, paperFooter: 300, printElements: [] }] }
    });
    let undoThrew = false, redoThrew = false;
    try { tpl.undo(); } catch { undoThrew = true; }
    try { tpl.redo(); } catch { redoThrew = true; }
    tpl.destroy();
    let undoAfterDestroy = false, redoAfterDestroy = false;
    try { tpl.undo(); } catch { undoAfterDestroy = true; }
    try { tpl.redo(); } catch { redoAfterDestroy = true; }
    return { undoThrew, redoThrew, undoAfterDestroy, redoAfterDestroy };
  });
  expect(result.undoThrew).toBe(false);
  expect(result.redoThrew).toBe(false);
  expect(result.undoAfterDestroy).toBe(false);
  expect(result.redoAfterDestroy).toBe(false);
});

test('historyList 初始状态 含初始 snapshot', async ({ page }) => {
  const result = await page.evaluate(() => {
    const h = (window as any).hiprint;
    const tpl = new h.PrintTemplate({
      template: { panels: [{ index: 0, name: '1', height: 100, width: 100, paperHeader: 0, paperFooter: 300, printElements: [] }] }
    });
    const init = {
      hasHistoryList: Array.isArray(tpl.historyList),
      historyLength: tpl.historyList ? tpl.historyList.length : 0,
      historyPos: tpl.historyPos,
    };
    tpl.destroy();
    return init;
  });
  expect(result.hasHistoryList).toBe(true);
  // 初始有 1 个 snapshot (constructor 内 push '初始')
  expect(result.historyLength).toBeGreaterThanOrEqual(1);
  expect(result.historyPos).toBe(0);
});

test('event-bus shortcut key trigger 触发 undo/redo', async ({ page }) => {
  const result = await page.evaluate(() => {
    const h = (window as any).hiprint;
    const tpl = new h.PrintTemplate({
      template: { panels: [{ index: 0, name: '1', height: 100, width: 100, paperHeader: 0, paperFooter: 300, printElements: [] }] }
    });
    // 内部 event-bus path (Ctrl+Z 触发的实际机制)
    const eventKey = 'hiprintTemplateDataShortcutKey_' + tpl.id;
    let undoFired = false;
    // window.hinnn.event 是事件总线
    (window as any).hinnn.event.on(eventKey, function (kind: string) {
      if (kind === 'undo') undoFired = true;
    });
    tpl.undo();
    tpl.destroy();
    return undoFired;
  });
  expect(result).toBe(true);
});
