import { Page } from '@playwright/test';

/**
 * Wait for hiprint to be available on window and the designer to finish mounting.
 * Returns early as soon as window.hiprint.PrintTemplate is callable.
 */
export async function waitForHiprint(page: Page, timeoutMs = 20_000): Promise<void> {
  await page.waitForFunction(
    () =>
      typeof (window as any).hiprint !== 'undefined' &&
      typeof (window as any).hiprint.PrintTemplate === 'function',
    { timeout: timeoutMs }
  );
}

/**
 * Evaluate a snippet inside the browser that already has hiprint loaded.
 * Returns the stringified result so it crosses the serialisation boundary safely.
 */
export async function evalHiprint<T>(
  page: Page,
  fn: (h: any) => T
): Promise<T> {
  return page.evaluate(fn, undefined);
}
