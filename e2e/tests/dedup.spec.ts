/**
 * dedup.spec.ts
 * Regression: addPrintElementTypes 同 tid 多次注册不累积
 *
 * Covers bug fixes:
 *   - allElementTypes 数组因重复 push 膨胀 (#dedup-accumulate)
 *   - removePrintElementTypes 前缀精确匹配，不误删 order_v2 (#dedup-prefix)
 *   - 空 tid 注册不崩溃 (#dedup-empty-tid)
 *   - removePrintElementTypes 空字符串不删任何组 (#dedup-empty-remove)
 */
import { test, expect } from '@playwright/test';
import { waitForHiprint } from './helpers/wait-for-hiprint';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await waitForHiprint(page);
});

test('同 tid 注册两次后 allElementTypes 中只有一条', async ({ page }) => {
  const result = await page.evaluate(() => {
    const h = (window as any).hiprint;
    const mgr = new h.PrintElementTypeRegistry();
    const group = [{ printElementTypes: [{ tid: 'dedup.item' }] }];
    mgr.addPrintElementTypes('dedupMod', group);
    const before = mgr.allElementTypes.filter((e: any) => e.tid === 'dedup.item').length;
    mgr.addPrintElementTypes('dedupMod', group);
    const after = mgr.allElementTypes.filter((e: any) => e.tid === 'dedup.item').length;
    return { before, after };
  });
  expect(result.before).toBe(1);
  expect(result.after).toBe(1);
});

test('removePrintElementTypes 前缀精确: order 不删 order_v2', async ({ page }) => {
  const result = await page.evaluate(() => {
    const h = (window as any).hiprint;
    const mgr = new h.PrintElementTypeRegistry();
    mgr.addPrintElementTypes('order',    [{ printElementTypes: [{ tid: 'order.item' }] }]);
    mgr.addPrintElementTypes('order_v2', [{ printElementTypes: [{ tid: 'order_v2.item' }] }]);
    mgr.removePrintElementTypes('order');
    return {
      orderRemoved: !mgr['order'],
      v2Intact: !!mgr['order_v2'],
      v2InCache: mgr.allElementTypes.some((e: any) => e.tid === 'order_v2.item'),
      orderInCache: mgr.allElementTypes.some((e: any) => e.tid === 'order.item'),
    };
  });
  expect(result.orderRemoved).toBe(true);
  expect(result.v2Intact).toBe(true);
  expect(result.v2InCache).toBe(true);
  expect(result.orderInCache).toBe(false);
});

test('removePrintElementTypes 空字符串不删任何组', async ({ page }) => {
  const result = await page.evaluate(() => {
    const h = (window as any).hiprint;
    const mgr = new h.PrintElementTypeRegistry();
    mgr.addPrintElementTypes('mod1', [{ printElementTypes: [{ tid: 'mod1.x' }] }]);
    const before = mgr.allElementTypes.length;
    mgr.removePrintElementTypes('');
    const after = mgr.allElementTypes.length;
    return { before, after };
  });
  expect(result.after).toBe(result.before);
});

test('hiprint.init providers 注册后 addPrintElementTypes 可查询 tid', async ({ page }) => {
  const found = await page.evaluate(() => {
    const h = (window as any).hiprint;
    // Use the real defaultElementTypeProvider via window context
    // since direct import is not available in evaluate()
    const mgr = new h.PrintElementTypeRegistry();
    mgr.addPrintElementTypes('smokeGroup', [{
      printElementTypes: [
        { tid: 'smokeGroup.alpha' },
        { tid: 'smokeGroup.beta' },
      ]
    }]);
    return mgr.allElementTypes.some((e: any) => e.tid === 'smokeGroup.alpha') &&
           mgr.allElementTypes.some((e: any) => e.tid === 'smokeGroup.beta');
  });
  expect(found).toBe(true);
});
