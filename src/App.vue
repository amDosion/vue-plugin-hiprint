<template>
  <div id="app">
    <!-- 动态渲染组件，懒得去弄路由了 -->
    <keep-alive>
      <component :is="curDemo" />
    </keep-alive>
  </div>
</template>

<script>
import printDesign from "@/demo/design/index";
import printCustom from "@/demo/custom/index";
import printTasks from "@/demo/tasks/index";
import printPanels from "@/demo/panels/index";
import templates from "@/demo/templates/index";
import { decodeVer } from "@/utils";

export default {
  name: "App",
  components: {
    printDesign,
    printCustom,
    printTasks,
    printPanels,
    templates,
  },
  data() {
    return {
      curDemo: "printDesign",
      demoList: [
        { name: "printDesign", title: "默认拖拽设计" },
        { name: "printCustom", title: "自定义设计" },
        { name: "printTasks", title: "队列/批量打印" },
        { name: "printPanels", title: "多面板设计" },
      ],
      // npm 信息
      npmInfo: {},
      versions: [],
      lang: "cn",
      languages: [
        {
          label: "简体中文-cn",
          value: "cn",
        },
        {
          label: "英语-en",
          value: "en",
        },
        {
          label: "德语-de",
          value: "de",
        },
        {
          label: "西班牙语-es",
          value: "es",
        },
        {
          label: "法语-fr",
          value: "fr",
        },
        {
          label: "意大利语-it",
          value: "it",
        },
        {
          label: "日语-ja",
          value: "ja",
        },
        {
          label: "俄语-ru",
          value: "ru",
        },
        {
          label: "繁体中文-cn_tw",
          value: "cn_tw",
        },
      ],
      // 选择版本
      version: undefined,
    };
  },
  computed: {
    i18nSupport() {
      return (
        this.version == "development" ||
        (this.version && decodeVer(this.version).verVal >= 55.8)
      );
    },
  },
  created() {
    this.version = sessionStorage.getItem("version") || "development";
    this.lang = sessionStorage.getItem("lang") || "cn";
    if (!sessionStorage.getItem("lang")) {
      sessionStorage.setItem("lang", "cn");
    }
    this.getVersion();
    this.registerExternalControls();
  },
  beforeDestroy() {
    if (window.__hiprintDemoControls && window.__hiprintDemoControls.__owner === this) {
      delete window.__hiprintDemoControls;
    }
  },
  methods: {
    normalizeDemoName(name) {
      return this.demoList.some((demo) => demo.name === name) ? name : null;
    },
    switchDemo(name) {
      const demoName = this.normalizeDemoName(name);
      if (!demoName) return false;
      this.curDemo = demoName;
      return true;
    },
    openTemplateCenter() {
      this.curDemo = "templates";
      return true;
    },
    getControlState() {
      return {
        curDemo: this.curDemo,
        version: this.version,
        lang: this.lang,
        demos: this.demoList.map((demo) => demo.name),
        startWithEmptyTemplate: sessionStorage.getItem("hiprintEmptyTemplateOnStart") !== "0",
      };
    },
    registerExternalControls() {
      const vm = this;
      window.__hiprintDemoControls = {
        __owner: vm,
        switchDemo(name) {
          return vm.switchDemo(name);
        },
        openTemplateCenter() {
          return vm.openTemplateCenter();
        },
        setVersion(version) {
          vm.handleVerChange(version);
        },
        setLang(lang) {
          vm.handleLangChange(lang);
        },
        getState() {
          return vm.getControlState();
        },
        listVersions() {
          return vm.versions.slice();
        },
        listLanguages() {
          return vm.languages.slice();
        },
        setStartWithEmptyTemplate(enabled = true) {
          sessionStorage.setItem("hiprintEmptyTemplateOnStart", enabled ? "1" : "0");
          location.reload();
        },
        getStartWithEmptyTemplate() {
          return sessionStorage.getItem("hiprintEmptyTemplateOnStart") !== "0";
        },
      };
    },
    /**
     * @description: 通过 jsdelivr 获取所有 npm 信息
     * @return {*}
     */
    getVersion() {
      const xhr = new XMLHttpRequest();
      // jsdelivr 源
      // xhr.open(
      //   "GET",
      //   "https://data.jsdelivr.com/v1/packages/npm/vue-plugin-hiprint"
      // );
      // cnpm 源
      xhr.open("GET", "https://registry.npmmirror.com/vue-plugin-hiprint");
      xhr.onload = () => {
        if (xhr.status === 200) {
          this.npmInfo = JSON.parse(xhr.responseText);
          this.versions = Object.keys(this.npmInfo.versions)
            .map((version) => ({
              label: version,
              value: version,
            }))
            .reverse();
          if (process.env.NODE_ENV === "development") {
            this.versions.unshift({
              label: "development",
              value: "development",
            });
          }
          this.version ??= this.versions[0].value;
        }
      };
      xhr.send();
    },
    /**
     * @description: 版本切换事件
     * @param {String} val
     */
    handleVerChange(val) {
      sessionStorage.setItem("version", val);
      location.reload();
    },
    /**
     * @description: 语言切换事件
     * @param {String} val
     */
    handleLangChange(val) {
      sessionStorage.setItem("lang", val);
      location.reload();
    },
  },
};
</script>

<style lang="less">

html,
body {
  height: 100%;
  margin: 0;
  overflow: hidden;
}

#app {
  height: 100%;
  overflow: hidden;
}

// hiprint 拖拽图片
.hiprint-printElement-image-content {
  img {
    content: url("~@/assets/logo.png");
  }
}

// 修改 页眉/页脚线 样式
.hiprint-headerLine,
.hiprint-footerLine {
  border-color: red !important;
}

.hiprint-headerLine:hover,
.hiprint-footerLine:hover {
  border-top: 3px dashed red !important;
}

.hiprint-headerLine:hover:before {
  content: "页眉线";
  left: calc(50% - 18px);
  position: relative;
  background: #ffff;
  top: -12px;
  color: red;
  font-size: 12px;
}

.hiprint-footerLine:hover:before {
  content: "页脚线";
  left: calc(50% - 18px);
  position: relative;
  color: red;
  background: #ffff;
  top: -12px;
  font-size: 12px;
}
</style>
