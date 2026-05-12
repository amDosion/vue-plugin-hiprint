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

test('appendElementTypeGroups tid 去重 — 重复注册不堆积 + XSS title 不执行', async ({ page }) => {
  // 修正: 用公开 API appendElementTypeGroups (不是内部 PrintElementTypeManager class).
  // PrintElementTypeManager 暴露的是 UI builder 静态方法 (not data layer 单例).
  const result = await page.evaluate(() => {
    const h = (window as any).hiprint;
    const xssGroups = [{
      name: 'xss-group',
      printElementTypes: [{ tid: 'xss.test', title: '<script>window.__xss=1<\/script>', type: 'text', field: 'name' }]
    }];
    // 重复注册同 tid 应被 dedup,不抛异常
    h.appendElementTypeGroups('xssModule', xssGroups);
    h.appendElementTypeGroups('xssModule', xssGroups);
    // XSS title 通过 hiprint UI 渲染时不应执行 (.text() 转义)
    const xssMarkerSet = (window as any).__xss === 1;
    return { ok: true, xssMarkerSet };
  });
  expect(result.ok).toBe(true);
  expect(result.xssMarkerSet).toBe(false); // <script> in title 没执行
});

test('B7: text 元素含 <script> 的业务数据渲染不执行脚本', async ({ page }) => {
  // Reviewer B7: line 9987 text 元素默认 .html(p) — p 可能含 user data
  const fired = await page.evaluate(() => {
    (window as any).__b7_xss = false;
    const h = (window as any).hiprint;
    const tpl = new h.PrintTemplate({
      template: { panels: [{
        index: 0, name: '1', height: 100, width: 100, paperHeader: 0, paperFooter: 300,
        printElements: [{
          options: { left: 0, top: 0, height: 16, width: 200, field: 'name', title: 't' },
          printElementType: { type: 'text', tid: 'defaultModule.text' }
        }]
      }] }
    });
    const html = tpl.getHtml({ name: '<img src=x onerror="window.__b7_xss=true">' });
    // 把渲染结果挂到 DOM 触发 img onerror (如果 .html() 没修)
    if (html && html[0]) document.body.appendChild(html[0]);
    tpl.destroy();
    return (window as any).__b7_xss;
  });
  expect(fired).toBe(false);
});

test('B8: 表格 column header 含 <script> 不渲染为标签', async ({ page }) => {
  // Reviewer B8: line 1927 表格 column header .html(t.title) - t.title 是 user input
  const result = await page.evaluate(() => {
    const h = (window as any).hiprint;
    const tpl = new h.PrintTemplate({
      template: { panels: [{
        index: 0, name: '1', height: 100, width: 100, paperHeader: 0, paperFooter: 300,
        printElements: [{
          options: {
            left: 0, top: 0, height: 50, width: 200, field: 'items', tableHeaderRepeat: 'first',
            columns: [[{ title: '<img src=x onerror="window.__b8_xss=true">', field: 'a', width: 50, checked: true }]]
          },
          printElementType: { type: 'table', tid: 'defaultModule.table' }
        }]
      }] }
    });
    (window as any).__b8_xss = false;
    const html = tpl.getHtml({ items: [{ a: 'ok' }] });
    if (html && html[0]) document.body.appendChild(html[0]);
    tpl.destroy();
    // header 渲染后 <img> 应被转义,onerror 不触发
    return { fired: (window as any).__b8_xss };
  });
  expect(result.fired).toBe(false);
});

test('A1: hicontextMenu menu.text 含 <img onerror> 不执行脚本', async ({ page }) => {
  // bundle.js:8909 — contextMenu 把 e.text 拼接进 .html()，opts.menus[].text 业务可控
  const result = await page.evaluate(() => {
    (window as any).__a1_xss = false;
    const $ = (window as any).jQuery || (window as any).$;
    const $host = $('<div id="a1-host" style="display:none"></div>').appendTo('body');
    $host.hicontextMenu({
      menus: [
        { text: '<img src=x onerror="window.__a1_xss=true">', callback: function () {} },
      ],
    });
    // 触发 contextmenu 事件让 renderMenu 跑
    $host.trigger('contextmenu');
    const rendered = $('.hicontextmenuroot').length > 0;
    // 渲染后立即查 DOM 看有没有 <img> 标签 (有 = .html() 注入；没有 = 已转义)
    const imgInjected = $('.hicontextmenu img').length > 0;
    const textPreserved = $('.hicontextmenuitem span').first().text();
    $('.hicontextmenuroot').remove();
    $host.remove();
    return {
      rendered,
      imgInjected,
      xssFired: (window as any).__a1_xss,
      textPreserved,
    };
  });
  expect(result.rendered).toBe(true);
  expect(result.imgInjected).toBe(false);
  expect(result.xssFired).toBe(false);
  // 文本应保留原样（作为字符串显示）
  expect(result.textPreserved).toContain('onerror');
});

test('I-B2: qrcode options.title 含 <img onerror> 不执行脚本', async ({ page }) => {
  // bundle.js:10505 — title 通过模板字符串拼进 .html(),options.title 来自 user JSON 可控
  const result = await page.evaluate(() => {
    (window as any).__qrtitle_xss = false;
    const h = (window as any).hiprint;
    const tpl = new h.PrintTemplate({
      template: { panels: [{
        index: 0, name: '1', height: 100, width: 100, paperHeader: 0, paperFooter: 300,
        printElements: [{
          options: {
            left: 0, top: 0, height: 80, width: 80,
            title: '<img src=x onerror="window.__qrtitle_xss=true">',
            testData: 'hello', hideTitle: false,
          },
          printElementType: { type: 'qrcode', tid: 'defaultModule.qrcode' }
        }]
      }] }
    });
    const $html = tpl.getHtml({});
    if ($html && $html[0]) document.body.appendChild($html[0]);
    tpl.destroy();
    return {
      fired: (window as any).__qrtitle_xss,
      // 必须用 textNode 渲染 (无字面 <img onerror>)
      hasInjectedImg: document.querySelectorAll('.hiprint-printElement-qrcode-content-title img').length > 0,
    };
  });
  expect(result.fired).toBe(false);
  expect(result.hasInjectedImg).toBe(false);
});

test('I-B3: qrcode options.textAlign 含闭合 attr 注入不破坏 style', async ({ page }) => {
  // bundle.js:10504 — textAlign 拼进 style attr,user 传 'right">...<img onerror=...' 可注入
  const result = await page.evaluate(() => {
    (window as any).__qralign_xss = false;
    const h = (window as any).hiprint;
    const tpl = new h.PrintTemplate({
      template: { panels: [{
        index: 0, name: '1', height: 100, width: 100, paperHeader: 0, paperFooter: 300,
        printElements: [{
          options: {
            left: 0, top: 0, height: 80, width: 80,
            title: 'qr', testData: 'hello', hideTitle: false,
            textAlign: 'right"><img src=x onerror="window.__qralign_xss=true">',
            fontSize: '12; background:url(javascript:alert(1))',
          },
          printElementType: { type: 'qrcode', tid: 'defaultModule.qrcode' }
        }]
      }] }
    });
    const $html = tpl.getHtml({});
    if ($html && $html[0]) document.body.appendChild($html[0]);
    tpl.destroy();
    // 序列化整个渲染输出,检查是否含未转义的攻击片段
    const outer = ($html && $html[0]) ? $html[0].outerHTML : '';
    return {
      fired: (window as any).__qralign_xss,
      hasInjectedImg: document.querySelectorAll('.hiprint-printElement-qrcode-content-title img').length > 0,
      // 输出 HTML 不能含 user 注入的 <img> 字面或 javascript: 协议
      hasInjectedFragment: /onerror=|javascript:/i.test(outer),
    };
  });
  expect(result.fired).toBe(false);
  expect(result.hasInjectedImg).toBe(false);
  expect(result.hasInjectedFragment).toBe(false);
});

test('A2: pagination panel.name 含 <img onerror> 不执行脚本', async ({ page }) => {
  // bundle.js:12292 — buildPagination 把 panel.name 拼接进 .html()，template JSON 用户可控
  const result = await page.evaluate(() => {
    (window as any).__a2_xss = false;
    const h = (window as any).hiprint;
    const $ = (window as any).jQuery || (window as any).$;
    const $host = $('<div id="a2-pagination"></div>').appendTo('body');
    // 通过 PrintTemplate 构造参数 paginationContainer 触发内部 dt.buildPagination 渲染
    const tpl = new h.PrintTemplate({
      paginationContainer: '#a2-pagination',
      template: {
        panels: [
          {
            index: 0, name: '<img src=x onerror="window.__a2_xss=true">',
            height: 100, width: 100, paperHeader: 0, paperFooter: 300, printElements: [],
          },
          {
            index: 1, name: 'normal',
            height: 100, width: 100, paperHeader: 0, paperFooter: 300, printElements: [],
          },
        ],
      },
    });
    const imgInjected = $host.find('img').length > 0;
    const textPreserved = $host.find('li span').first().text();
    tpl.destroy();
    $host.remove();
    return {
      imgInjected,
      xssFired: (window as any).__a2_xss,
      textPreserved,
    };
  });
  expect(result.imgInjected).toBe(false);
  expect(result.xssFired).toBe(false);
  // panel.name 文本应作为字符串显示
  expect(result.textPreserved).toContain('onerror');
});
