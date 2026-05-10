/**
 * destroy.spec.ts
 * Regression: PrintTemplate.destroy 幂等 / 内存释放 / destroy 后 print 不静默
 *
 * Covers bug fixes:
 *   - destroy 重复调用抛异常 (#destroy-idempotent)
 *   - _destroyed flag 未设置导致内存泄漏 (#destroy-flag)
 *   - destroy 后调用 print() 静默成功 (#post-destroy-print)
 *   - isDestroyed() getter 未暴露 (#isDestroyed-getter)
 */
import { test, expect } from '@playwright/test';
import { waitForHiprint } from './helpers/wait-for-hiprint';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await waitForHiprint(page);
});

test('destroy 幂等 — 连续两次调用不抛错', async ({ page }) => {
  const result = await page.evaluate(() => {
    const h = (window as any).hiprint;
    const t = new h.PrintTemplate({});
    try {
      t.destroy();
      t.destroy(); // second call must not throw
      return { ok: true, destroyed: t._destroyed };
    } catch (e: any) {
      return { ok: false, error: e.message };
    }
  });
  expect(result.ok).toBe(true);
  expect(result.destroyed).toBe(true);
});

test('destroy 后 _destroyed flag 为 true', async ({ page }) => {
  const destroyed = await page.evaluate(() => {
    const h = (window as any).hiprint;
    const t = new h.PrintTemplate({});
    t.destroy();
    return t._destroyed;
  });
  expect(destroyed).toBe(true);
});

test('destroy 后 print() 返回 undefined 而非静默执行', async ({ page }) => {
  const result = await page.evaluate(() => {
    const h = (window as any).hiprint;
    const t = new h.PrintTemplate({});
    t.destroy();
    // print() on a destroyed template must bail out, not return a DOM node
    const ret = t.print();
    return ret === undefined ? 'undefined' : typeof ret;
  });
  expect(result).toBe('undefined');
});

test('isDestroyed() getter 暴露并返回正确值', async ({ page }) => {
  const result = await page.evaluate(() => {
    const h = (window as any).hiprint;
    const t = new h.PrintTemplate({});
    const before = typeof t.isDestroyed === 'function' && !t.isDestroyed();
    t.destroy();
    const after = typeof t.isDestroyed === 'function' && t.isDestroyed();
    return { before, after };
  });
  expect(result.before).toBe(true);
  expect(result.after).toBe(true);
});
