import './_setup-jquery.js'
import {hiprint, defaultElementTypeProvider} from './hiprint/hiprint.bundle.js'
// 调用浏览器打印js
import "./hiprint/plugins/jquery.hiwprint.js";
// 默认配置
import "./hiprint/hiprint.config";
// 样式
import "./hiprint/css/hiprint.css"
import "./hiprint/css/print-lock.css"

import {version} from '../package.json'

/**
 * 自动连接 / 连接
 * cb: 连接回调， (status, msg) {
 *   // status: true/false
 *   // msg: status == true 时 返回socket.connect回调 e
 * }
 */
let autoConnect = function(cb) {
  window.autoConnect = true;
  window.hiwebSocket && window.hiwebSocket.hasIo() && window.hiwebSocket.start(cb);
};

/**
 * 取消自动连接 / 断开连接
 */
let disAutoConnect = function() {
  window.autoConnect = false;
  window.hiwebSocket && window.hiwebSocket.hasIo() && window.hiwebSocket.stop();
};

let hiPrintPlugin = {
  disAutoConnect,
  install: function (app, name = '$hiPrint', autoConnect = false) {
    if (!autoConnect) {
      disAutoConnect();
    }
    const globals = app.config.globalProperties;
    globals[name] = hiprint;
    /**
     * 预览打印，调起系统打印预览
     * provider 左侧拖拽元素
     * template 模版json字符串
     * args 打印数据data, options,
     */
    globals.$print = function (provider = defaultElementTypeProvider, template, ...args) {
      hiprint.init({
        providers: [new provider()],
      });
      const hiprintTemplate = new hiprint.PrintTemplate({
        template: template,
      });
      hiprintTemplate.print(...args);
      return hiprintTemplate;
    };
    /**
     * 单模版直接打印， 需客户端支持
     * provider 左侧拖拽项对象
     * template 模版json字符串
     * args 打印数据data, options,
     */
    globals.$print2 = function (provider = defaultElementTypeProvider, template, ...args) {
      hiprint.init({
        providers: [new provider()],
      });
      const hiprintTemplate = new hiprint.PrintTemplate({
        template: template,
      });
      hiprintTemplate.print2(...args);
      return hiprintTemplate;
    };
  },
};

hiprint.version = version

window.hiprint = hiprint;

// === 元素类型 / 模板配置 ===
let setDynamicFields = hiprint.setDynamicFields;
let removeDynamicFields = hiprint.removeDynamicFields;
let setElementTypeGroups = hiprint.setElementTypeGroups;
let appendElementTypeGroups = hiprint.appendElementTypeGroups;
let renameElementType = hiprint.renameElementType;

// === 设计器 / 工具栏 ===
let buildToolbar = hiprint.buildToolbar;
let buildDesigner = hiprint.buildDesigner;

// === 核心类（外部项目集成时常用）===
let PrintTemplate = hiprint.PrintTemplate;
let PrintElementTypeManager = hiprint.PrintElementTypeManager;       // UI builder utility (build/buildByHtml/setPanelSlot 等静态)
let PrintElementTypeRegistry = hiprint.PrintElementTypeRegistry;     // 数据层单例 class (.instance / addPrintElementTypes / allElementTypes 等)
let PrintElementTypeGroup = hiprint.PrintElementTypeGroup;

// === 直接打印 / HTML 输出 ===
// .bind(hiprint) 是必要的:hiprint.print/print2/getHtml 内部用 this.getHtml,
// 集成方 `import { print } from 'vue-plugin-hiprint'` 后调用会丢 this(严格模式抛 TypeError)。
let print = hiprint.print.bind(hiprint);
let print2 = hiprint.print2.bind(hiprint);
let getHtml = hiprint.getHtml.bind(hiprint);

// === 客户端 / 静默打印（hiwebSocket 场景）===
// 与 print/print2/getHtml 同样 .bind(hiprint):内部用 this.socket / this.xxx,
// 集成方解构后调用会丢 this(严格模式抛 TypeError)。保持 5 个客户端方法行为一致。
let getClients = hiprint.getClients.bind(hiprint);
let getClientInfo = hiprint.getClientInfo.bind(hiprint);
let getAddress = hiprint.getAddress.bind(hiprint);
let ippPrint = hiprint.ippPrint.bind(hiprint);
let ippRequest = hiprint.ippRequest.bind(hiprint);

export {
  // 核心
  hiprint,
  hiPrintPlugin,
  defaultElementTypeProvider,
  PrintTemplate,
  PrintElementTypeManager,
  PrintElementTypeRegistry,
  PrintElementTypeGroup,
  // 元素类型 / 模板配置
  setDynamicFields,
  removeDynamicFields,
  setElementTypeGroups,
  appendElementTypeGroups,
  renameElementType,
  // 设计器 / 工具栏
  buildToolbar,
  buildDesigner,
  // 直接打印 / HTML
  print,
  print2,
  getHtml,
  // 客户端 / 静默打印
  autoConnect,
  disAutoConnect,
  getClients,
  getClientInfo,
  getAddress,
  ippPrint,
  ippRequest,
}
