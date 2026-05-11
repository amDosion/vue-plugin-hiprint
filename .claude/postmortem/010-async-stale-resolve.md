# PM-010: destroy 后 in-flight Promise/setTimeout 仍 resolve stale state

- **Category:** 异步竞态 / 资源管理
- **Severity:** HIGH
- **First detected:** 2026-05-11 (R3 state-modeler)
- **Status:** prevented

## What happened

PrintTemplate destroy 后,以下 in-flight async 仍触发:
1. `toPdf().then()` — domtoimage.toCanvas 在 destroy 后 ~200ms 完成,回调访问 stale `this`
2. `getSimpleHtmlAsync` 的 setTimeout 递归链 — destroy 后下一轮 setTimeout 触发
3. `loadAllImages` 自递归 — destroy 后 setTimeout 触发 + 上游 callback 永远不调
4. `sendByFragments` setTimeout — `hiwebSocket.stop()` 后 socket = null, emit 抛 TypeError
5. XHR `onreadystatechange` — destroy 后 XHR 完成,回调 access stale closure

**真实影响**:
- toPdf 返回 ghost PDF (resolve 给已 unmount 的 caller)
- getHtmlAsync 在 abort 时 resolve($('<div>')) 让 caller 拿到 "成功但空" 误导
- loadAllImages 不调 callback → toPdf chain hang
- sendByFragments 抛 TypeError: emit on null
- 内存 / DOM 泄漏 (tempContainer 不清)

## Root cause

JS 单线程 async 模型:
- destroy 是**同步**操作,瞬间完成
- async 任务 (Promise / setTimeout / XHR) 已 schedule, 不会因 destroy 取消
- 回调闭包持 `this` / DOM / panel 引用, destroy 后是 stale

**所有 async 回调入口必须检查 `_destroyed` flag**。

## Where it appeared

`hiprint.bundle.js`:
- line 12713 `toPdf().then(domtoimage.toCanvas)`
- line 12401 `appendElementByParamsList` (getSimpleHtmlAsync setTimeout 链)
- line 12849 `loadAllImages` setTimeout 自递归
- line 8417 `sendByFragments` setTimeout × N
- line 12596 / 12660 `print2`/`printByHtml2` XHR onreadystatechange

## How it was fixed

### 1. toPdf .then 加 _destroyed 检查 + .catch
```js
domtoimage.toCanvas(...).then(function (t) {
  if (i._destroyed) {
    i.removeTempContainer();
    dtd.reject(new Error('template destroyed mid-toPdf'));
    return;
  }
  // ... pdf gen
}).catch(function (err) {
  console.error('[hiprint] toPdf: domtoimage failed:', err);
  i.removeTempContainer();
  dtd.reject(err);
});
```

### 2. getSimpleHtmlAsync abort → reject (不再 resolve empty)
```js
return new Promise((resolve, reject) => {
  function appendElementByParamsList(...) {
    if (that._destroyed) {
      return reject(new Error('aborted: template destroyed mid-async'));
    }
    // ...
  }
});
```

### 3. loadAllImages destroy 时仍调 callback
```js
if (this._destroyed) {
  if (typeof e === 'function') e();  // 让上游 chain 收敛
  return;
}
```

### 4. sendByFragments setTimeout 内 socket null 守卫
```js
setTimeout(() => {
  if (!this.socket) {
    console.warn('[hiprint] sendByFragments: socket closed, dropping fragment');
    return;
  }
  try { this.socket.emit(...); }
  catch (e) { console.error('[hiprint] sendByFragments: emit failed:', e); }
});
```

### 5. XHR onerror / ontimeout
```js
s.onerror = function () { console.error('[hiprint] XHR failed for', url); };
s.ontimeout = function () { console.error('[hiprint] XHR timeout for', url); };
```

## Why it kept happening

1. **destroy 是新引入概念**: 上游 hiprint 不支持销毁,所有 async 假设"永远活着"
2. **race 难重现**: 需要恰好在 destroy 时刻有 in-flight task
3. **JS 单线程错觉**: 开发者以为"destroy 完成后没有 async 残留",忽略已 schedule 的 microtask
4. **多 async 模式混合**: Promise / setTimeout / XHR 各自有自己的"还活着"判断,无统一抽象

## Prevention

### 规则
- `.claude/rules/hiprint-bundle.md` 不变式: 任何 setTimeout/Promise.then/XHR onreadystatechange 入口必须 `if (this._destroyed) return` 或 `reject('aborted')`

### Pattern
所有 async 回调入口三件套:
1. `if (this._destroyed) return safeFallback()` (call destroyed)
2. `.catch(err => ...)` (async reject)
3. try 包外层同步部分 (sync throw)

### e2e
- destroy.spec.ts 锁住 5 类 race scenario

### 教训
- destroy 不是销毁,而是"标记 + 拒绝服务"。已 schedule 的 async 必须自己检查
- 任何 setTimeout 闭包 = potential race vector
- 任何 Promise.then 链 = 必须有 `_destroyed` 出口 + `.catch` 兜底
