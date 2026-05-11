# PM-011: XHR onreadystatechange 网络错全部静默

- **Category:** silent failure / 错误掩盖
- **Severity:** HIGH
- **First detected:** 2026-05-11 (R3 silent-failure-hunter)
- **Status:** prevented

## What happened

`print2` / `printByHtml2` 用 XHR fetch `print-lock.css`:

```js
s.onreadystatechange = function () {
  if (4 === s.readyState && 200 === s.status && (...)) {
    n.sentToClient(...);
  }
};
```

网络错 (CORS / 404 / timeout / offline) → `readyState=4 status=0`, 条件不命中,`sentToClient` 永不调用。**印字任务静默丢失,业务方无任何反馈**。

**真实影响**:
- 用户点"打印"按钮 → 无反应 (没有 toast / error)
- 业务方调试痛苦 (DevTools network tab 才看到 404,console 干净)
- 多个 css link 时 1 个失败整个 print 卡住 (不计入 `++i == r.length` 计数)

## Root cause

XHR 错误处理三件套缺失:
- `onerror`: 网络层错 (CORS / DNS / offline)
- `ontimeout`: 超时
- `onreadystatechange` 内只查 `status === 200`,不分类 `status === 0` vs `status === 404` vs `status === 500`

```js
// 错误模式
if (4 === readyState && 200 === status) { /* success */ }
// 其他状态 (4 + 0/404/500/...) 全部 silent
```

## Where it appeared

`hiprint.bundle.js`:
- line 12596 `print2` (sentToClient css fetch)
- line 12660 `printByHtml2` (sentToClient + arbitrary html print)

类似 pattern 可能在其他 fetch (head/footer external HTML 等),但本次只发现 2 处。

## How it was fixed

```js
s.onerror = function () {
  console.error('[hiprint] print2: CSS XHR failed for', $(p).attr("href"));
};
s.ontimeout = function () {
  console.error('[hiprint] print2: CSS XHR timeout for', $(p).attr("href"));
};
s.open("GET", $(p).attr("href"));
s.onreadystatechange = function () {
  if (4 === s.readyState) {
    if (200 === s.status) {
      // success path
      o[a + ""] = '<style ...>' + s.responseText + "</style>";
      if (++i == r.length) {
        // 全部 css 加载完成,sentToClient
      }
    } else if (s.status !== 0) {
      // 0 走 onerror; 非 0 非 200 是 HTTP error
      console.error('[hiprint] print2: CSS load got HTTP', s.status, 'for', url);
    }
  }
};
s.send();
```

## Why it kept happening

1. **XHR API 设计**: status === 0 是网络层错,看似 "正常未完成",容易漏判
2. **`status === 200` 单条件检查**: 是最 naive 但极常见的 success 判断
3. **多 XHR 计数 race**: `++i == r.length` 在某些失败的 XHR 不计数,卡死
4. **测试覆盖**: 单元测试很少模拟 status=0 / timeout 场景

## Prevention

### 规则
- `.claude/rules/hiprint-bundle.md` 不变式: 任何 XHR 必须有 `onerror` + `ontimeout` + readyState 内分类 status

### Pattern
```js
xhr.onerror = function () { console.error('[hiprint] <ctx> XHR network error for', url); };
xhr.ontimeout = function () { console.error('[hiprint] <ctx> XHR timeout'); };
xhr.onreadystatechange = function () {
  if (xhr.readyState === 4) {
    if (xhr.status === 200) { /* success */ }
    else if (xhr.status !== 0) { /* HTTP error */ console.error(...); }
    // status === 0 → onerror 已处理
  }
};
```

### 现代替代
- 新代码用 `fetch` (内置 `.catch` + reject on network error)
- 如必须 XHR,封装 helper `xhrLoadWithErrors(url, onSuccess, onError)`

### 教训
- 网络层错 ≠ HTTP error ≠ 业务错。三层错都必须有 handler
- "static counter check + status===200" 是经典反模式 → 任何 XHR 失败就 corrupted state
