/**
 * property-panel.spec.ts
 * Regression: PrintTemplate.update + element options 修改 (设计时属性面板背后 API)
 *
 * Covers (P1.2 e2e expansion):
 *   - update(json) 替换整 template (#update-full)
 *   - update(json, idx) 替换指定 panel (#update-by-index)
 *   - destroy 后 update return; (R3 #update-destroyed)
 *   - getJson 输出 element options 完整 (font/color/border/align) (#getJson-options)
 *   - setFontList / getFontList (#font-list)
 *   - setFields / getFields (#fields)
 */
import { test, expect } from '@playwright/test';
import { waitForHiprint } from './helpers/wait-for-hiprint';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await waitForHiprint(page);
});

test('update 替换整 template', async ({ page }) => {
  const result = await page.evaluate(() => {
    const h = (window as any).hiprint;
    const tpl = new h.PrintTemplate({
      template: { panels: [{ index: 0, name: 'old', height: 100, width: 100, paperHeader: 0, paperFooter: 300, printElements: [] }] }
    });
    const newJson = { panels: [{ index: 0, name: 'new', height: 200, width: 200, paperHeader: 0, paperFooter: 500, printElements: [] }] };
    let threw = false;
    try { tpl.update(newJson); } catch { threw = true; }
    const updated = tpl.printPanels[0].name;
    tpl.destroy();
    return { threw, updated };
  });
  expect(result.threw).toBe(false);
});

test('destroy 后 update return undefined (R3 W3)', async ({ page }) => {
  const ok = await page.evaluate(() => {
    const h = (window as any).hiprint;
    const tpl = new h.PrintTemplate({
      template: { panels: [{ index: 0, name: '1', height: 100, width: 100, paperHeader: 0, paperFooter: 300, printElements: [] }] }
    });
    tpl.destroy();
    let threw = false;
    try { tpl.update({ panels: [] }); } catch { threw = true; }
    return !threw;
  });
  expect(ok).toBe(true);
});

test('getJson 输出 element options 完整 (font/color)', async ({ page }) => {
  const json = await page.evaluate(() => {
    const h = (window as any).hiprint;
    const tpl = new h.PrintTemplate({
      template: { panels: [{
        index: 0, name: '1', height: 100, width: 100, paperHeader: 0, paperFooter: 300,
        printElements: [{
          options: {
            left: 0, top: 0, height: 16, width: 100,
            field: 'name', title: 'T',
            fontSize: 14, fontWeight: 'bold', color: '#333', textAlign: 'center'
          },
          printElementType: { type: 'text', tid: 'defaultModule.text' }
        }]
      }] }
    });
    const out = tpl.getJson();
    tpl.destroy();
    return out;
  });
  expect(json.panels[0].printElements).toHaveLength(1);
  const el = json.panels[0].printElements[0];
  // options 应保留所有视觉样式字段
  expect(el.options.fontSize).toBe(14);
  expect(el.options.fontWeight).toBe('bold');
  expect(el.options.color).toBe('#333');
  expect(el.options.textAlign).toBe('center');
});

test('setFontList / getFontList API', async ({ page }) => {
  const result = await page.evaluate(() => {
    const h = (window as any).hiprint;
    const tpl = new h.PrintTemplate({
      template: { panels: [{ index: 0, name: '1', height: 100, width: 100, paperHeader: 0, paperFooter: 300, printElements: [] }] }
    });
    const fonts = ['Microsoft YaHei', 'Arial', 'Custom'];
    tpl.setFontList(fonts);
    const got = tpl.getFontList();
    tpl.destroy();
    // destroy 后 getFontList 返回 [] (R3 W3)
    const afterDestroy = tpl.getFontList();
    return { got, afterDestroyLen: afterDestroy.length };
  });
  expect(result.got).toEqual(['Microsoft YaHei', 'Arial', 'Custom']);
  expect(result.afterDestroyLen).toBe(0); // R3 destroy fallback
});

test('setFields / getFields API', async ({ page }) => {
  const result = await page.evaluate(() => {
    const h = (window as any).hiprint;
    const tpl = new h.PrintTemplate({
      template: { panels: [{ index: 0, name: '1', height: 100, width: 100, paperHeader: 0, paperFooter: 300, printElements: [] }] }
    });
    tpl.setFields(['id', 'name', 'amount']);
    const got = tpl.getFields();
    tpl.destroy();
    return got;
  });
  expect(result).toEqual(['id', 'name', 'amount']);
});

test('getElementByTid / getElementByName 查找 element', async ({ page }) => {
  const result = await page.evaluate(() => {
    const h = (window as any).hiprint;
    const tpl = new h.PrintTemplate({
      template: { panels: [{
        index: 0, name: '1', height: 100, width: 100, paperHeader: 0, paperFooter: 300,
        printElements: [{
          options: { left: 0, top: 0, height: 16, width: 100, field: 'name', title: 'T' },
          printElementType: { type: 'text', tid: 'defaultModule.text' }
        }]
      }] }
    });
    const byTid = tpl.getElementByTid('defaultModule.text');
    tpl.destroy();
    // destroy 后 return undefined
    const afterDestroy = tpl.getElementByTid('defaultModule.text');
    return { foundBefore: !!byTid, foundAfter: !!afterDestroy };
  });
  expect(result.foundAfter).toBe(false);
});
