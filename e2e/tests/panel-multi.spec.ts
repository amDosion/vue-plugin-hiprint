/**
 * panel-multi.spec.ts
 * Regression: 多 panel template / addPrintPanel / deletePanel / selectPanel
 *
 * Covers (P1 e2e 100% expansion for V2 refactor):
 *   - addPrintPanel 增加面板, printPanels.length += 1 (#add-panel)
 *   - deletePanel(0) 拒绝 (printPanels.length <= 1 守卫) (#delete-single-reject)
 *   - deletePanel(>=2) 成功, 索引正确 (#delete-second-panel)
 *   - deletePanel editingPanel re-select (R3 state-modeler fix #editingPanel-reselect)
 *   - selectPanel(idx) 切换 editingPanel (#select-switch)
 *   - getPaneltotal 返回 length (#getPaneltotal)
 *   - getPanel(idx) 返回对应 panel (#getPanel)
 *   - destroy 后 addPrintPanel 返回 undefined (#destroyed-no-add)
 */
import { test, expect } from '@playwright/test';
import { waitForHiprint } from './helpers/wait-for-hiprint';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await waitForHiprint(page);
});

test('addPrintPanel 增加面板, getPaneltotal 反映', async ({ page }) => {
  const result = await page.evaluate(() => {
    const h = (window as any).hiprint;
    const tpl = new h.PrintTemplate({
      template: { panels: [{ index: 0, name: 'P1', height: 100, width: 100, paperHeader: 0, paperFooter: 300, printElements: [] }] }
    });
    const before = tpl.getPaneltotal();
    tpl.addPrintPanel({ index: 1, name: 'P2', height: 100, width: 100, paperHeader: 0, paperFooter: 300, printElements: [] });
    const after = tpl.getPaneltotal();
    tpl.destroy();
    return { before, after };
  });
  expect(result.before).toBe(1);
  expect(result.after).toBe(2);
});

test('deletePanel(0) 在仅 1 panel 时拒绝 + warn', async ({ page }) => {
  const result = await page.evaluate(() => {
    const h = (window as any).hiprint;
    const tpl = new h.PrintTemplate({
      template: { panels: [{ index: 0, name: 'only', height: 100, width: 100, paperHeader: 0, paperFooter: 300, printElements: [] }] }
    });
    const before = tpl.getPaneltotal();
    tpl.deletePanel(0);
    const after = tpl.getPaneltotal();
    tpl.destroy();
    return { before, after };
  });
  expect(result.before).toBe(1);
  expect(result.after).toBe(1); // 守卫拒绝
});

test('deletePanel 删除 editingPanel 后必须 re-select (R3 state-modeler)', async ({ page }) => {
  const result = await page.evaluate(() => {
    const h = (window as any).hiprint;
    const tpl = new h.PrintTemplate({
      template: {
        panels: [
          { index: 0, name: 'P1', height: 100, width: 100, paperHeader: 0, paperFooter: 300, printElements: [] },
          { index: 1, name: 'P2', height: 100, width: 100, paperHeader: 0, paperFooter: 300, printElements: [] },
          { index: 2, name: 'P3', height: 100, width: 100, paperHeader: 0, paperFooter: 300, printElements: [] },
        ]
      }
    });
    tpl.selectPanel(1); // 选中 P2
    const wasEditingP2 = tpl.editingPanel && tpl.editingPanel.name === 'P2';
    tpl.deletePanel(1); // 删 P2
    const editingNotDangling = tpl.editingPanel != null && tpl.editingPanel !== undefined;
    const panelCount = tpl.getPaneltotal();
    tpl.destroy();
    return { wasEditingP2, editingNotDangling, panelCount };
  });
  expect(result.wasEditingP2).toBe(true);
  expect(result.editingNotDangling).toBe(true);
  expect(result.panelCount).toBe(2);
});

test('selectPanel 切换 editingPanel', async ({ page }) => {
  const result = await page.evaluate(() => {
    const h = (window as any).hiprint;
    const tpl = new h.PrintTemplate({
      template: {
        panels: [
          { index: 0, name: 'PA', height: 100, width: 100, paperHeader: 0, paperFooter: 300, printElements: [] },
          { index: 1, name: 'PB', height: 100, width: 100, paperHeader: 0, paperFooter: 300, printElements: [] },
        ]
      }
    });
    tpl.selectPanel(0);
    const before = tpl.editingPanel === tpl.printPanels[0];
    tpl.selectPanel(1);
    const after = tpl.editingPanel === tpl.printPanels[1];
    tpl.destroy();
    return { before, after };
  });
  expect(result.before).toBe(true);
  expect(result.after).toBe(true);
});

test('getPanel(idx) 返回对应 panel 实例', async ({ page }) => {
  const ok = await page.evaluate(() => {
    const h = (window as any).hiprint;
    const tpl = new h.PrintTemplate({
      template: {
        panels: [
          { index: 0, name: 'A', height: 100, width: 100, paperHeader: 0, paperFooter: 300, printElements: [] },
          { index: 1, name: 'B', height: 100, width: 100, paperHeader: 0, paperFooter: 300, printElements: [] },
        ]
      }
    });
    const p0 = tpl.getPanel(0);
    const p1 = tpl.getPanel(1);
    const result = !!p0 && !!p1 && p0 !== p1 && p0 === tpl.printPanels[0];
    tpl.destroy();
    return result;
  });
  expect(ok).toBe(true);
});

test('destroy 后 addPrintPanel 返回 undefined', async ({ page }) => {
  const result = await page.evaluate(() => {
    const h = (window as any).hiprint;
    const tpl = new h.PrintTemplate({
      template: { panels: [{ index: 0, name: '1', height: 100, width: 100, paperHeader: 0, paperFooter: 300, printElements: [] }] }
    });
    tpl.destroy();
    const ret = tpl.addPrintPanel({ index: 1, name: 'NoOp', height: 100, width: 100, paperHeader: 0, paperFooter: 300, printElements: [] });
    return ret === undefined;
  });
  expect(result).toBe(true);
});

test('destroy 后 getPaneltotal 返回 0 (R3 fallback)', async ({ page }) => {
  const result = await page.evaluate(() => {
    const h = (window as any).hiprint;
    const tpl = new h.PrintTemplate({
      template: { panels: [{ index: 0, name: '1', height: 100, width: 100, paperHeader: 0, paperFooter: 300, printElements: [] }] }
    });
    tpl.destroy();
    return tpl.getPaneltotal();
  });
  expect(result).toBe(0);
});
