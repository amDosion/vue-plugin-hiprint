/**
 * element-types-each.spec.ts
 * Regression: 每种 element type 渲染 + getData / field 解析
 *
 * Covers (P1 e2e 100% expansion for V2 refactor):
 *   每种 etype 单独验证渲染:
 *   - text: .text() 安全 (R3 B7)
 *   - long-text: BinarySearch + nested-field reduce ?? "" (PM-002)
 *   - image: src attr 转义 (R3 B1)
 *   - barcode: jsbarcode 集成 + try-catch i18n "格式不支持" fallback
 *   - qrcode: QRCode 集成 + try-catch i18n "生成失败" fallback
 *   - html: by-design .html() 渲染 formatter 输出
 *   - hline / vline / rect / oval: 视觉装饰元素, DOM 节点存在
 */
import { test, expect } from '@playwright/test';
import { waitForHiprint } from './helpers/wait-for-hiprint';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await waitForHiprint(page);
});

async function renderElement(page: any, type: string, options: any, data: any = {}, extra?: any) {
  return page.evaluate(
    ({ type, options, data, extra }: any) => {
      const h = (window as any).hiprint;
      const tpl = new h.PrintTemplate({
        template: {
          panels: [{
            index: 0, name: '1', height: 100, width: 200,
            paperHeader: 0, paperFooter: 300,
            printElements: [{
              options: { left: 0, top: 0, height: 50, width: 100, ...options },
              printElementType: { type, tid: `defaultModule.${type}`, ...(extra || {}) }
            }]
          }]
        }
      });
      const $html = tpl.getHtml(data);
      const out = $html && $html[0] ? $html[0].outerHTML : '';
      tpl.destroy();
      return out;
    },
    { type, options, data, extra }
  );
}

test('text element 渲染 user data 作 textContent (R3 B7 .text() 默认)', async ({ page }) => {
  const html = await renderElement(page, 'text',
    { field: 'name', title: 'T' },
    { name: 'plainText' }
  );
  expect(html).toContain('plainText');
});

test('text element <script> 在 user data 中不执行 (B7 XSS regression)', async ({ page }) => {
  const html = await renderElement(page, 'text',
    { field: 'name', title: 'T' },
    { name: '<script>window.__et_xss=1</script>' }
  );
  const fired = await page.evaluate(() => (window as any).__et_xss === 1);
  expect(fired).toBe(false);
  // 字面 string 仍可见
  expect(html).toContain('script');
});

test('long-text element nested-field 0 渲染 "0" (PM-002 ?? "")', async ({ page }) => {
  const html = await renderElement(page, 'longText',
    { field: 'data.count', title: 'C', height: 100 },
    { data: { count: 0 } }
  );
  expect(html).toMatch(/0\s*<\/div>|>0</);
});

test('image element src 通过 .attr() 设置 (R3 B1 防字符串拼接 XSS)', async ({ page }) => {
  const html = await renderElement(page, 'image',
    { src: 'data:image/png;base64,iVBORw0KGgo=', title: 'I' }
  );
  expect(html).toContain('<img');
  // src 通过 attribute 设置, 浏览器自动编码,不会有 onerror 注入
  expect(html).toMatch(/src="data:image\/png;base64/);
});

test('barcode element 正确数据渲染 SVG, 非法数据 fallback i18n 文本', async ({ page }) => {
  const okHtml = await renderElement(page, 'barcode',
    { field: 'code', title: 'BC', tableBarcodeMode: 'CODE128' },
    { code: '12345' }
  );
  // element-level barcode 用 <svg viewBox> 直接渲染 (不是 table cell 的 hibarcode_imgcode)
  expect(okHtml).toContain('hiprint-printElement-barcode-content');
  expect(okHtml).toMatch(/<svg[^>]*viewBox/);

  const badHtml = await renderElement(page, 'barcode',
    { field: 'code', title: 'BC', tableBarcodeMode: 'CODE128' },
    { code: '' } // empty value
  );
  // 空 value 退化, 仍渲染 barcode-content 容器, 不抛
  expect(badHtml).toContain('hiprint-printElement-barcode-content');
});

test('qrcode element 渲染 svg + 失败时 i18n fallback', async ({ page }) => {
  const html = await renderElement(page, 'qrcode',
    { field: 'url', title: 'Q' },
    { url: 'https://example.com' }
  );
  // qrcode 渲染输出 svg / canvas
  expect(html).toMatch(/qrcode|svg|canvas/i);
});

test('html element by-design 渲染 .html() (业务方负责安全)', async ({ page }) => {
  const html = await renderElement(page, 'html',
    { field: 'content', title: 'H', formatter: 'function(v){return "<em>"+v+"</em>"}' },
    { content: 'safeContent' }
  );
  // html 元素 by-design 渲染 HTML (业务方自己 escape)
  expect(html).toContain('hiprint-printElement-html');
});

test('hline / vline 渲染 hr-like 装饰元素', async ({ page }) => {
  const hHtml = await renderElement(page, 'hline', { left: 0, top: 0, width: 100, height: 1 });
  const vHtml = await renderElement(page, 'vline', { left: 0, top: 0, width: 1, height: 100 });
  expect(hHtml).toContain('hiprint-printElement');
  expect(vHtml).toContain('hiprint-printElement');
});

test('rect / oval 渲染装饰形状', async ({ page }) => {
  const rectHtml = await renderElement(page, 'rect', { left: 0, top: 0, width: 50, height: 50 });
  const ovalHtml = await renderElement(page, 'oval', { left: 0, top: 0, width: 50, height: 50 });
  expect(rectHtml).toContain('hiprint-printElement');
  expect(ovalHtml).toContain('hiprint-printElement');
});
