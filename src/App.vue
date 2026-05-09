<template>
  <designer-shell />
</template>

<script>
import DesignerShell from "@/standalone/designer-shell.vue";

export default {
  name: "App",
  components: {
    DesignerShell,
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

.hiprint-printElement-image-content {
  img {
    content: url("@/assets/logo.png");
  }
}

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
