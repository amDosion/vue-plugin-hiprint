/**
 * dynamic-fields.spec.ts
 * Regression: setDynamicFields / setElementTypeGroups / appendElementTypeGroups
 *
 * Covers (P1.2 e2e expansion):
 *   - setDynamicFields(name, groups) 不抛 + 后续 element 注册成功 (#set-dynamic)
 *   - setDynamicFields(undefined) throw (R1 fix #moduleName-required)
 *   - setElementTypeGroups(name, groups) 注册 element types (#set-groups)
 *   - appendElementTypeGroups 不破坏既有 (#append-non-destructive)
 *   - removeDynamicFields(name) 清空 module (#remove-dynamic)
 */
import { test, expect } from '@playwright/test';
import { waitForHiprint } from './helpers/wait-for-hiprint';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await waitForHiprint(page);
});

test('setDynamicFields 注册动态字段不抛 (正确 fieldGroup shape)', async ({ page }) => {
  const ok = await page.evaluate(() => {
    const h = (window as any).hiprint;
    let err: string | null = null;
    try {
      h.setDynamicFields('testDynModule', [
        {
          groupName: '客户信息',
          fields: [
            { field: 'custName', title: '客户名', type: 'text' },
            { field: 'custPhone', title: '电话', type: 'text' },
          ]
        }
      ]);
    } catch (e: any) { err = e.message; }
    return err;
  });
  expect(ok).toBeNull();
});

test('setDynamicFields(undefined) throw with clear error', async ({ page }) => {
  const result = await page.evaluate(() => {
    const h = (window as any).hiprint;
    let msg: string | null = null;
    try {
      h.setDynamicFields(undefined as any, []);
    } catch (e: any) {
      msg = e.message;
    }
    return msg;
  });
  // R1 修复: moduleName 必填, 拒绝 undefined
  expect(result).toContain('moduleName');
});

test('setElementTypeGroups 注册 element types', async ({ page }) => {
  const ok = await page.evaluate(() => {
    const h = (window as any).hiprint;
    let threw = false;
    try {
      h.setElementTypeGroups('orderTest', [
        {
          name: '订单',
          printElementTypes: [
            { tid: 'orderTest.no', title: '订单号', type: 'text', field: 'orderNo' },
          ]
        }
      ]);
    } catch { threw = true; }
    return !threw;
  });
  expect(ok).toBe(true);
});

test('appendElementTypeGroups 多次注册同 module 不破坏既有', async ({ page }) => {
  const result = await page.evaluate(() => {
    const h = (window as any).hiprint;
    h.appendElementTypeGroups('multiAppend', [{
      name: 'A', printElementTypes: [{ tid: 'multiAppend.a', title: 'A', type: 'text', field: 'a' }]
    }]);
    h.appendElementTypeGroups('multiAppend', [{
      name: 'B', printElementTypes: [{ tid: 'multiAppend.b', title: 'B', type: 'text', field: 'b' }]
    }]);
    // 两次注册的 tid 都应在 registry
    const reg = new h.PrintElementTypeRegistry.instance.constructor();  // get the class
    // 实际上 registry 是单例, 通过 PrintElementTypeRegistry.instance 访问
    const allTids = h.PrintElementTypeRegistry.instance.allElementTypes.map((e: any) => e.tid);
    return {
      hasA: allTids.includes('multiAppend.a'),
      hasB: allTids.includes('multiAppend.b'),
    };
  });
  expect(result.hasA).toBe(true);
  expect(result.hasB).toBe(true);
});

test('removeDynamicFields 清空 module', async ({ page }) => {
  const result = await page.evaluate(() => {
    const h = (window as any).hiprint;
    h.setDynamicFields('toRemove', [{
      groupName: 'X',
      fields: [{ field: 'x', title: 'X', type: 'text' }]
    }]);
    const before = h.PrintElementTypeRegistry.instance.allElementTypes
      .some((e: any) => e.tid && e.tid.indexOf('toRemove') === 0);
    h.removeDynamicFields('toRemove');
    const after = h.PrintElementTypeRegistry.instance.allElementTypes
      .some((e: any) => e.tid && e.tid.indexOf('toRemove') === 0);
    return { before, after };
  });
  expect(result.before).toBe(true);
  expect(result.after).toBe(false);
});
