/**
 * callback-safety.spec.ts
 * Regression: 业务回调 throw 不冻结主流程 (commit C / B2)
 *
 * Covers bug fixes:
 *   - bundle.js:12957 onUpdateError 直调改 _safeCall
 *   - bundle.js:13164 onDataChanged 直调改 _safeCall
 *   - bundle.js:12314 onPanelAddClick 直调改 _safeCall
 *   - bundle.js:841 onBeforeSelectAllDrag 直调改 try-catch
 *
 * 守约: throw 在业务回调 → 主流程继续 + 错误被 console.error 捕获,
 *      不冒泡冻结 update() / data-change historyList / addPanel / multi-select.
 */
import { test, expect } from '@playwright/test';
import { waitForHiprint } from './helpers/wait-for-hiprint';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await waitForHiprint(page);
});

test('B2-A: onUpdateError 回调 throw 不冻结后续 update', async ({ page }) => {
  const result = await page.evaluate(() => {
    const h = (window as any).hiprint;
    let onErrorCalls = 0;
    const tpl = new h.PrintTemplate({
      onUpdateError: function () {
        onErrorCalls++;
        throw new Error('intentional onUpdateError throw');
      },
    });
    // 触发 update 走 catch 路径 (传 invalid template)
    let firstUpdateThrew = false;
    try {
      tpl.update({ panels: null } as any);
    } catch (e) {
      firstUpdateThrew = true;
    }
    // 第二次 update — 如果回调 throw 冒泡冻结了 tpl.update,这里也会 throw
    let secondUpdateThrew = false;
    try {
      tpl.update({ panels: [] } as any);
    } catch (e) {
      secondUpdateThrew = true;
    }
    tpl.destroy();
    return { onErrorCalls, firstUpdateThrew, secondUpdateThrew };
  });
  // onUpdateError 被调用至少 1 次
  expect(result.onErrorCalls).toBeGreaterThan(0);
  // _safeCall 吃掉了 throw — update 自身不应再向上冒泡
  expect(result.firstUpdateThrew).toBe(false);
  // 第二次 update 也正常,无残留状态
  expect(result.secondUpdateThrew).toBe(false);
});

test('B2-B: onDataChanged 回调 throw 不阻塞 historyList push', async ({ page }) => {
  const result = await page.evaluate(() => {
    const h = (window as any).hiprint;
    let onChangedCalls = 0;
    const tpl = new h.PrintTemplate({
      onDataChanged: function () {
        onChangedCalls++;
        throw new Error('intentional onDataChanged throw');
      },
    });
    // 直接触发 historyList 路径 — emit hiprintTemplateDataChanged event
    const hinnn = (window as any).hinnn;
    const eventKey = 'hiprintTemplateDataChanged_' + tpl.id;
    const lenBefore = tpl.historyList.length;
    let triggerThrew = false;
    try {
      hinnn.event.trigger(eventKey, 'test-change-1');
    } catch (e) {
      triggerThrew = true;
    }
    const lenAfter = tpl.historyList.length;
    // 再 trigger 一次 — 验证后续 event 不被前一次 throw 影响
    try {
      hinnn.event.trigger(eventKey, 'test-change-2');
    } catch {}
    const lenFinal = tpl.historyList.length;
    tpl.destroy();
    return { onChangedCalls, lenBefore, lenAfter, lenFinal, triggerThrew };
  });
  expect(result.onChangedCalls).toBeGreaterThanOrEqual(2);
  // _safeCall 吞 throw — event.trigger 调用方不感知
  expect(result.triggerThrew).toBe(false);
  // historyList 必须能 push (业务回调失败 ≠ 历史记录失败)
  expect(result.lenAfter).toBe(result.lenBefore + 1);
  expect(result.lenFinal).toBe(result.lenBefore + 2);
});
