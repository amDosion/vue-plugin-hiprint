import './_setup-jquery.js'

import { createApp } from 'vue'
import App from './App.vue'

import Antd, { message, Modal } from 'ant-design-vue'
import 'ant-design-vue/dist/reset.css'

import { hiPrintPlugin } from './index'

const app = createApp(App)

app.use(Antd)
app.use(hiPrintPlugin)

// antd v4 不再自动挂 this.$message / this.$confirm，这里手动挂回 globalProperties
// 用以兼容 designer-shell.vue 现有代码中的 this.$message / this.$confirm 调用
app.config.globalProperties.$message = message
app.config.globalProperties.$confirm = Modal.confirm

app.mount('#app')
