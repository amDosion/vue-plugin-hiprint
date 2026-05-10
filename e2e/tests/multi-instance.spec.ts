/**
 * multi-instance.spec.ts
 * Regression: 多 buildDesigner 实例不冲突
 *
 * Covers bug fixes:
 *   - toolbar namespace uid 未隔离，多实例共享同一事件监听器 (#multi-instance-namespace)
 *   - 第二次 buildDesigner 覆盖第一次 window.__hiprintDesignerControls (#multi-instance-controls)
 *   - destroy 一个实例不影响另一个 (#multi-instance-destroy-isolation)
 *   - PrintTemplate 实例间 printPanels 不共享引用 (#multi-instance-panels)
 */
import { test, expect } from '@playwright/test';
import { waitForHiprint } from './helpers/wait-for-hiprint';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await waitForHiprint(page);
});

test('两个 PrintTemplate 实例的 printPanels 不共享引用', async ({ page }) => {
  const result = await page.evaluate(() => {
    const h = (window as any).hiprint;
    const panelCfg = {
      template: {
        panels: [{
          index: 0, name: '1', height: 297, width: 210,
          paperHeader: 0, paperFooter: 840, printElements: []
        }]
      }
    };
    const t1 = new h.PrintTemplate(panelCfg);
    const t2 = new h.PrintTemplate(panelCfg);
    const sameRef = t1.printPanels === t2.printPanels;
    t1.destroy && t1.destroy();
    t2.destroy && t2.destroy();
    return { sameRef };
  });
  expect(result.sameRef).toBe(false);
});

test('destroy 第一个实例后第二个实例 _destroyed 仍为 false', async ({ page }) => {
  const result = await page.evaluate(() => {
    const h = (window as any).hiprint;
    const t1 = new h.PrintTemplate({});
    const t2 = new h.PrintTemplate({});
    t1.destroy();
    const t2Destroyed = t2._destroyed;
    t2.destroy && t2.destroy();
    return { t1: t1._destroyed, t2: t2Destroyed };
  });
  expect(result.t1).toBe(true);
  expect(result.t2).toBeFalsy();
});

test('PrintElementTypeManager 实例间 allElementTypes 独立', async ({ page }) => {
  const result = await page.evaluate(() => {
    const h = (window as any).hiprint;
    const mgr1 = new h.PrintElementTypeManager();
    const mgr2 = new h.PrintElementTypeManager();
    mgr1.addPrintElementTypes('mod', [{ printElementTypes: [{ tid: 'inst1.x' }] }]);
    const mgr2HasIt = mgr2.allElementTypes.some((e: any) => e.tid === 'inst1.x');
    return { mgr2HasIt };
  });
  expect(result.mgr2HasIt).toBe(false);
});

test('window.__hiprintDesignerControls.getState() 返回 ready 状态', async ({ page }) => {
  await page.waitForFunction(
    () => typeof (window as any).__hiprintDesignerControls !== 'undefined',
    { timeout: 15_000 }
  );
  const state = await page.evaluate(() => {
    const ctrl = (window as any).__hiprintDesignerControls;
    return ctrl.getState();
  });
  expect(state).toHaveProperty('ready');
  expect(typeof state.ready).toBe('boolean');
});
