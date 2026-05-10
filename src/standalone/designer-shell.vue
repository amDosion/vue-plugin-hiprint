<template>
  <div class="hiprint-designer-shell">
    <div id="hiprintDesigner"></div>
    <a-modal
      v-model:open="previewVisible"
      title="打印预览"
      :width="1100"
      :footer="null"
      :maskClosable="false"
      :getContainer="getPreviewContainer"
      wrapClassName="hiprint-preview-modal"
      @cancel="handlePreviewCancel"
    >
      <div class="hiprint-preview-modal-body">
        <div v-if="!previewHtml" class="hiprint-preview-empty">暂无可预览内容</div>
        <div v-else class="hiprint-preview-content" v-html="previewHtml"></div>
      </div>
      <div class="hiprint-preview-footer">
        <a-button @click="handlePreviewCancel">关闭</a-button>
        <a-button type="primary" @click="handlePreviewPrint">打印</a-button>
      </div>
    </a-modal>
  </div>
</template>

<script>
import { hiprint, defaultElementTypeProvider } from "@/index";

export default {
  name: "DesignerShell",
  data() {
    return {
      designerCtrl: null,
      template: null,
      toolbarCtrl: null,
      previewVisible: false,
      previewHtml: "",
      printData: {},
      printMode: "browser",
      clientPrintOptions: {},
    };
  },
  mounted() {
    this.initDesigner();
  },
  beforeUnmount() {
    if (window.__hiprintDesignerControls && window.__hiprintDesignerControls.__owner === this) {
      delete window.__hiprintDesignerControls;
    }
    if (this.designerCtrl && this.designerCtrl.destroy) {
      this.designerCtrl.destroy();
    }
  },
  methods: {
    parseJson(json) {
      if (!json) return null;
      if (typeof json === "string") {
        try {
          return JSON.parse(json);
        } catch (e) {
          return null;
        }
      }
      return json;
    },
    registerExternalControls() {
      var vm = this;
      window.__hiprintDesignerControls = {
        __owner: vm,
        getState: function () {
          return {
            ready: !!vm.template,
            lang: "cn",
            printMode: vm.getPrintMode(),
          };
        },
        getTemplateJson: function () {
          return vm.template && vm.template.getJson ? vm.template.getJson() : null;
        },
        setTemplateJson: function (json) {
          var tpl = vm.parseJson(json);
          if (!tpl || !vm.template || !vm.template.update) return false;
          vm.template.update(tpl);
          return true;
        },
        clear: function () {
          if (vm.template && vm.template.clear) vm.template.clear();
        },
        openTemplateDialog: function () {
          if (vm.toolbarCtrl && vm.toolbarCtrl.openTemplateDialog) {
            vm.toolbarCtrl.openTemplateDialog();
          }
        },
        refreshTemplateList: function () {
          if (vm.toolbarCtrl && vm.toolbarCtrl.refreshTemplateList) {
            return vm.toolbarCtrl.refreshTemplateList();
          }
          return Promise.resolve([]);
        },
        setTemplateListProvider: function (provider) {
          if (vm.toolbarCtrl && vm.toolbarCtrl.setTemplateListProvider) {
            vm.toolbarCtrl.setTemplateListProvider(provider);
          }
        },
        setTemplateLoader: function (loader) {
          if (vm.toolbarCtrl && vm.toolbarCtrl.setTemplateLoader) {
            vm.toolbarCtrl.setTemplateLoader(loader);
          }
        },
        openBusinessDialog: function () {
          if (vm.toolbarCtrl && vm.toolbarCtrl.openBusinessDialog) {
            vm.toolbarCtrl.openBusinessDialog();
          }
        },
        refreshBusinessList: function () {
          if (vm.toolbarCtrl && vm.toolbarCtrl.refreshBusinessList) {
            return vm.toolbarCtrl.refreshBusinessList();
          }
          return Promise.resolve([]);
        },
        setBusinessItems: function (list) {
          if (vm.toolbarCtrl && vm.toolbarCtrl.setBusinessItems) {
            vm.toolbarCtrl.setBusinessItems(list);
          }
        },
        setBusinessListProvider: function (provider) {
          if (vm.toolbarCtrl && vm.toolbarCtrl.setBusinessListProvider) {
            vm.toolbarCtrl.setBusinessListProvider(provider);
          }
        },
        setBusinessLoader: function (loader) {
          if (vm.toolbarCtrl && vm.toolbarCtrl.setBusinessLoader) {
            vm.toolbarCtrl.setBusinessLoader(loader);
          }
        },
        setDialogHandler: function (handlerKey, handler) {
          if (vm.toolbarCtrl && vm.toolbarCtrl.setDialogHandler) {
            return vm.toolbarCtrl.setDialogHandler(handlerKey, handler);
          }
          return null;
        },
        setBusinessDialogOpenHandler: function (handler) {
          if (vm.toolbarCtrl && vm.toolbarCtrl.setBusinessDialogOpenHandler) {
            return vm.toolbarCtrl.setBusinessDialogOpenHandler(handler);
          }
          return null;
        },
        setTemplateDialogOpenHandler: function (handler) {
          if (vm.toolbarCtrl && vm.toolbarCtrl.setTemplateDialogOpenHandler) {
            return vm.toolbarCtrl.setTemplateDialogOpenHandler(handler);
          }
          return null;
        },
        setSaveDialogOpenHandler: function (handler) {
          if (vm.toolbarCtrl && vm.toolbarCtrl.setSaveDialogOpenHandler) {
            return vm.toolbarCtrl.setSaveDialogOpenHandler(handler);
          }
          return null;
        },
        setToolbarButtonVisible: function (key, visible) {
          if (vm.toolbarCtrl && vm.toolbarCtrl.setButtonVisible) {
            return vm.toolbarCtrl.setButtonVisible(key, visible);
          }
          return false;
        },
        setToolbarButtonText: function (key, text, useHtml) {
          if (vm.toolbarCtrl && vm.toolbarCtrl.setButtonText) {
            return vm.toolbarCtrl.setButtonText(key, text, useHtml);
          }
          return false;
        },
        setToolbarButtonDisabled: function (key, disabled) {
          if (vm.toolbarCtrl && vm.toolbarCtrl.setButtonDisabled) {
            return vm.toolbarCtrl.setButtonDisabled(key, disabled);
          }
          return false;
        },
        triggerToolbarButton: function (key) {
          if (vm.toolbarCtrl && vm.toolbarCtrl.triggerButton) {
            return vm.toolbarCtrl.triggerButton(key);
          }
          return false;
        },
        getToolbarButtons: function () {
          if (vm.toolbarCtrl && vm.toolbarCtrl.getButtons) {
            return vm.toolbarCtrl.getButtons();
          }
          return {};
        },
        setPrintData: function (data) {
          var parsed = vm.parseJson(data);
          vm.printData = parsed || data || {};
        },
        getPrintData: function () {
          return vm.getPrintData();
        },
        setPrintMode: function (mode) {
          return vm.setPrintMode(mode);
        },
        getPrintMode: function () {
          return vm.getPrintMode();
        },
        setClientPrintOptions: function (options) {
          return vm.setClientPrintOptions(options);
        },
        getClientPrintOptions: function () {
          return vm.getClientPrintOptions();
        },
        setPrintConfig: function (config) {
          var conf = vm.parseJson(config) || {};
          if (conf.mode !== undefined) vm.setPrintMode(conf.mode);
          if (conf.clientOptions !== undefined) vm.setClientPrintOptions(conf.clientOptions);
          if (conf.printData !== undefined) vm.printData = vm.parseJson(conf.printData) || conf.printData || {};
          return {
            mode: vm.getPrintMode(),
            clientOptions: vm.getClientPrintOptions(),
          };
        },
        openPreview: function () {
          if (vm.template) vm.handlePreview(vm.template);
        },
        print: function (options) {
          if (vm.template) return vm.executePrint(vm.template, options);
        },
      };
    },
    normalizePrintMode(mode) {
      return mode === "client" ? "client" : "browser";
    },
    setPrintMode(mode) {
      this.printMode = this.normalizePrintMode(mode);
      return this.printMode;
    },
    getPrintMode() {
      return this.normalizePrintMode(this.printMode);
    },
    setClientPrintOptions(options) {
      var parsed = this.parseJson(options);
      if (parsed && typeof parsed === "object") {
        this.clientPrintOptions = Object.assign({}, parsed);
      } else {
        this.clientPrintOptions = {};
      }
      return this.getClientPrintOptions();
    },
    getClientPrintOptions() {
      return Object.assign({}, this.clientPrintOptions || {});
    },
    getPrintData() {
      return this.printData && typeof this.printData === "object" ? this.printData : {};
    },
    buildPreviewHtml(tpl) {
      if (!tpl || !tpl.getHtml) return "";
      var $html = tpl.getHtml(this.getPrintData());
      if ($html && $html.length) return $html[0].outerHTML;
      return "";
    },
    handlePreview(tpl) {
      try {
        this.previewHtml = this.buildPreviewHtml(tpl);
        this.previewVisible = true;
      } catch (e) {
        this.previewHtml = "";
        this.previewVisible = false;
        this.$message.error("生成预览失败");
      }
    },
    handlePreviewCancel() {
      this.previewVisible = false;
    },
    handlePreviewPrint() {
      if (!this.template) return;
      this.executePrint(this.template);
    },
    getPreviewContainer() {
      return document.querySelector("#hiprintDesigner") || document.body;
    },
    executePrint(tpl, overrideOptions) {
      if (!tpl) return "none";
      var data = this.getPrintData();
      var mode = this.getPrintMode();
      var override = this.parseJson(overrideOptions) || {};
      if (mode === "client") {
        try {
          if (!tpl.clientIsOpened || !tpl.clientIsOpened()) {
            this.$message.warning("打印客户端未连接，已自动切换为浏览器打印");
            tpl.print(data, override);
            return "browser-fallback";
          }
          var options = Object.assign({}, this.getClientPrintOptions(), override);
          tpl.print2(data, options);
          return "client";
        } catch (e) {
          this.$message.error("客户端打印失败，已自动切换为浏览器打印");
          tpl.print(data, override);
          return "browser-fallback";
        }
      }
      tpl.print(data, override);
      return "browser";
    },
    initDesigner() {
      hiprint.init({
        providers: [new defaultElementTypeProvider()],
        lang: "cn",
      });
      hiprint.setConfig();
      var that = this;
      this.designerCtrl = hiprint.buildDesigner("#hiprintDesigner", {
        componentModule: "defaultModule",
        templateOptions: {
          template: {},
          dataMode: 1,
          history: true,
          willOutOfBounds: true,
          qtDesigner: true,
          onDataChanged: function () {},
          onUpdateError: function (e) {
            console.log(e);
          },
        },
        toolbarOptions: {
          // 启用工具栏分页管理(下拉切换 + '+' 添加新分页) - 替代画布底部 .hiprint-printPagination。
          // 业务方按需关闭(showPanelManager: false)。
          showPanelManager: true,
          onPreview: function (tpl) {
            that.handlePreview(tpl);
          },
          onPrint: function (tpl) {
            that.executePrint(tpl);
          },
          onClear: function (tpl) {
            that.$confirm({
              title: "是否确认清空?",
              content: "清空后将无法恢复，是否继续?",
              okText: "确定",
              cancelText: "取消",
              centered: true,
              getContainer: function () {
                return document.querySelector("#hiprintDesigner") || document.body;
              },
              onOk: function () {
                tpl.clear();
              },
            });
          },
        },
        onReady: function (tpl, toolbarCtrl) {
          that.template = tpl;
          that.toolbarCtrl = toolbarCtrl;
          that.registerExternalControls();
        },
      });
    },
  },
};
</script>

<style lang="less">
.hiprint-designer-shell {
  height: 100%;
}

#hiprintDesigner {
  height: 100%;
  overflow: hidden;
  box-sizing: border-box;
  padding: 8px;
}

.hiprint-preview-modal-body {
  max-height: 70vh;
  overflow: auto;
  padding: 12px;
  background: #f5f5f5;
}

.hiprint-preview-empty {
  min-height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #999;
  background: #fff;
}

.hiprint-preview-content {
  display: flex;
  justify-content: center;
}

.hiprint-preview-content .hiprint-printTemplate {
  background: #fff;
}

.hiprint-preview-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 12px;
}
</style>
