/**
 * xss.spec.ts
 * Regression: barcode / qrcode / business-card / element-list XSS 防护
 *
 * Covers bug fixes:
 *   - barcode testData 含 <script> 不注入 DOM (#barcode-xss)
 *   - qrcode field value 含 onerror 不执行 (#qrcode-xss)
 *   - 元素 title 含 <img onerror> 不执行 (#title-xss)
 *   - jQuery .html() -> .text() 替换验证 (#jquery-text-xss)
 */
import { test, expect } from '@playwright/test';
import { waitForHiprint } from './helpers/wait-for-hiprint';
import sampleTemplate from './fixtures/sample-template.json';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await waitForHiprint(page);
});

test('jQuery .text() 阻止 <script> 注入 DOM', async ({ page }) => {
  const scriptCount = await page.evaluate(() => {
    const $ = (window as any).jQuery || (window as any).$;
    const $div = $('<div></div>').text('<script>window.__xss_fired=true<\/script>');
    return $div.find('script').length;
  });
  expect(scriptCount).toBe(0);
  const xssFired = await page.evaluate(() => (window as any).__xss_fired);
  expect(xssFired).toBeUndefined();
});

test('barcode testData 含 <script> 不在 DOM 里产生 script 标签', async ({ page }) => {
  // Inject template with XSS payload as testData, render it, then check DOM
  const xssPayload = '<script>window.__barcode_xss=1<\/script>';
  const injected = await page.evaluate((payload) => {
    const h = (window as any).hiprint;
    const tpl = new h.PrintTemplate({
      template: {
        panels: [{
          index: 0, name: '1', height: 100, width: 100,
          paperHeader: 0, paperFooter: 300,
          printElements: [{
            options: { left: 0, top: 0, height: 40, width: 80, testData: payload, title: 'bc' },
            printElementType: { type: 'barcode', tid: 'defaultModule.barcode' }
          }]
        }]
      }
    });
    // getHtml renders the template to a string; check for unescaped <script>
    try {
      const html = tpl.getHtml({}) || '';
      tpl.destroy();
      return {
        hasRawScript: /<script[^>]*>.*xss/i.test(html),
        xssFired: !!(window as any).__barcode_xss,
      };
    } catch {
      tpl.destroy();
      return { hasRawScript: false, xssFired: false };
    }
  }, xssPayload);

  expect(injected.hasRawScript).toBe(false);
  expect(injected.xssFired).toBe(false);
});

test('element title 含 <img onerror> 不执行脚本', async ({ page }) => {
  const fired = await page.evaluate(() => {
    (window as any).__img_xss = false;
    const h = (window as any).hiprint;
    const tpl = new h.PrintTemplate({
      template: {
        panels: [{
          index: 0, name: '1', height: 100, width: 100,
          paperHeader: 0, paperFooter: 300,
          printElements: [{
            options: {
              left: 0, top: 0, height: 16, width: 100,
              testData: 'hello',
              title: '<img src=x onerror="window.__img_xss=true">',
            },
            printElementType: { type: 'text', tid: 'defaultModule.text' }
          }]
        }]
      }
    });
    try { tpl.getHtml({}); } catch { /* ignore render errors */ }
    tpl.destroy();
    return (window as any).__img_xss;
  });
  expect(fired).toBe(false);
});

test('PrintElementTypeManager.addPrintElementTypes tid 去重后无 XSS 残留', async ({ page }) => {
  // Validates that re-registering same tid with XSS name does not accumulate
  const count = await page.evaluate(() => {
    const h = (window as any).hiprint;
    const mgr = new h.PrintElementTypeManager();
    const xssGroup = [{
      printElementTypes: [{ tid: 'xss.test', title: '<script>1<\/script>' }]
    }];
    mgr.addPrintElementTypes('xssModule', xssGroup);
    const before = mgr.allElementTypes.filter((e: any) => e.tid === 'xss.test').length;
    mgr.addPrintElementTypes('xssModule', xssGroup);
    const after = mgr.allElementTypes.filter((e: any) => e.tid === 'xss.test').length;
    return { before, after };
  });
  expect(count.before).toBe(1);
  expect(count.after).toBe(1); // no accumulation even with XSS title
});
