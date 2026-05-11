/**
 * print-element-type-registry.spec.ts
 * Regression: PrintElementTypeRegistry export (v1.0.1 新加)
 *
 * 锁定: hiprint.PrintElementTypeRegistry 是 data 层单例 class,
 * 与 hiprint.PrintElementTypeManager (UI builder utility, 含静态方法 build/buildByHtml) 解耦.
 *
 * Covers:
 *   - PrintElementTypeRegistry 暴露为 function (#registry-export)
 *   - new PrintElementTypeRegistry() 拿独立 instance (#registry-instance)
 *   - instance.addPrintElementTypes / allElementTypes / removePrintElementTypes 可用 (#registry-methods)
 *   - PrintElementTypeManager 仍保持 UI builder 语义 (#manager-still-builder)
 */
import { test, expect } from '@playwright/test';
import { waitForHiprint } from './helpers/wait-for-hiprint';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await waitForHiprint(page);
});

test('PrintElementTypeRegistry 暴露为 class (function)', async ({ page }) => {
  const t = await page.evaluate(() => typeof (window as any).hiprint.PrintElementTypeRegistry);
  expect(t).toBe('function');
});

test('new PrintElementTypeRegistry() 拿到独立 instance + data API 可用', async ({ page }) => {
  const result = await page.evaluate(() => {
    const h = (window as any).hiprint;
    const r1 = new h.PrintElementTypeRegistry();
    return {
      instType: typeof r1,
      hasAllElementTypes: Array.isArray(r1.allElementTypes),
      hasAddMethod: typeof r1.addPrintElementTypes,
      hasRemoveMethod: typeof r1.removePrintElementTypes,
      initialCount: r1.allElementTypes.length,
    };
  });
  expect(result.instType).toBe('object');
  expect(result.hasAllElementTypes).toBe(true);
  expect(result.hasAddMethod).toBe('function');
  expect(result.hasRemoveMethod).toBe('function');
  expect(result.initialCount).toBe(0);
});

test('Registry instance 间 allElementTypes 互相独立', async ({ page }) => {
  const result = await page.evaluate(() => {
    const h = (window as any).hiprint;
    const r1 = new h.PrintElementTypeRegistry();
    const r2 = new h.PrintElementTypeRegistry();
    r1.addPrintElementTypes('mod', [{ printElementTypes: [{ tid: 'iso.x' }] }]);
    return {
      r1Has: r1.allElementTypes.some((e: any) => e.tid === 'iso.x'),
      r2Has: r2.allElementTypes.some((e: any) => e.tid === 'iso.x'),
    };
  });
  expect(result.r1Has).toBe(true);
  expect(result.r2Has).toBe(false);
});

test('PrintElementTypeManager 保持 UI builder 语义 (静态方法 build/buildByHtml)', async ({ page }) => {
  const surface = await page.evaluate(() => {
    const h = (window as any).hiprint;
    const M = h.PrintElementTypeManager;
    return {
      hasBuild: typeof M.build,
      hasBuildByHtml: typeof M.buildByHtml,
      hasGetElementTypeGroups: typeof M.getElementTypeGroups,
      // 静态方法,不是 prototype 方法; new 后的 instance 不带这些
      newInstanceHasBuild: typeof (new M()).build,
    };
  });
  // Manager 是 UI builder, build 是静态方法
  expect(surface.hasBuild).toBe('function');
  expect(surface.hasBuildByHtml).toBe('function');
  expect(surface.newInstanceHasBuild).toBe('undefined');
});

test('Registry vs Manager 是两个独立 class (不共享 prototype)', async ({ page }) => {
  const same = await page.evaluate(() => {
    const h = (window as any).hiprint;
    return h.PrintElementTypeRegistry === h.PrintElementTypeManager;
  });
  expect(same).toBe(false);
});
