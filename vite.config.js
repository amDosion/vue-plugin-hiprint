import { defineConfig, transformWithEsbuild } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import fs from 'fs'

const isLib = process.env.BUILD_TARGET === 'lib'

// Vite 默认 esbuild 只 transform .ts/.jsx/.tsx；.js 文件（如 hiprint.bundle.js）不会被 drop console。
// build 阶段 Rollup 内置的 esbuild minify 会剥；dev 阶段需要手动跑一道 esbuild transform。
const stripConsoleInDev = () => ({
  name: 'strip-console-in-dev',
  enforce: 'pre',
  apply: 'serve',
  async transform(code, id) {
    if (id.includes('node_modules')) return null
    if (!/\.js(\?.*)?$/.test(id)) return null
    const result = await transformWithEsbuild(code, id, {
      drop: ['console', 'debugger'],
      loader: 'js',
      sourcemap: true,
    })
    return { code: result.code, map: result.map }
  },
})

const copyPrintLockCss = () => ({
  name: 'copy-print-lock-css',
  apply: 'build',
  closeBundle() {
    if (!isLib) return

    // print-lock.css 业务方必须在 index.html link[media=print] 单独引用 (打印窗口隔离)
    fs.copyFileSync(
      path.resolve(__dirname, 'src/hiprint/css/print-lock.css'),
      path.resolve(__dirname, 'dist/print-lock.css')
    )

    // CSS 拆分分发 (task #6):
    // dist/vue-plugin-hiprint.css         — vite 自动合并产物,含 core + designer (向后兼容)
    // dist/hiprint-core.css               — 仅核心打印/元素/骨架样式,无 minicolors (本插件 raw copy)
    // dist/hiprint-designer.css           — 仅 minicolors 颜色选择器,含 68KB sprite url() (本插件 raw copy)
    // 纯打印场景: 业务方 import hiprint-core.css 替代 vue-plugin-hiprint.css,省 minicolors 大头
    fs.copyFileSync(
      path.resolve(__dirname, 'src/hiprint/css/hiprint.css'),
      path.resolve(__dirname, 'dist/hiprint-core.css')
    )
    fs.copyFileSync(
      path.resolve(__dirname, 'src/hiprint/css/hiprint-designer.css'),
      path.resolve(__dirname, 'dist/hiprint-designer.css')
    )
    // designer.css 引用 ./image/jquery.minicolors.png 相对路径 — 同时把 png 单独 copy 出来
    // (vue-plugin-hiprint.css 仍会把它 inline 成 base64; hiprint-designer.css 用户拿到的是外置 png)
    const imgSrcDir = path.resolve(__dirname, 'src/hiprint/css/image')
    const imgDistDir = path.resolve(__dirname, 'dist/image')
    if (!fs.existsSync(imgDistDir)) fs.mkdirSync(imgDistDir, { recursive: true })
    for (const file of fs.readdirSync(imgSrcDir)) {
      fs.copyFileSync(path.join(imgSrcDir, file), path.join(imgDistDir, file))
    }
  },
})

export default defineConfig(({ mode }) => {
  const common = {
    plugins: [vue(), stripConsoleInDev(), copyPrintLockCss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
        // hiprint.bundle.js 中写死了 `import Nzh from "nzh/dist/nzh.min.js"`，
        // 但新版 nzh 包的 exports 字段没暴露该深路径。重定向到包入口。
        'nzh/dist/nzh.min.js': 'nzh',
      },
    },
    // 全局剥离 console.* 与 debugger：
    // - dev 与 build 都生效，控制台保持干净；
    // - hiprint.bundle.js 上游遗留的 60+ 处调试日志无需手改源码，避免与上游脱节；
    // - 与原 webpack.config.js 中 UglifyJS `drop_console: true` / `drop_debugger: true` 行为对齐。
    // include 显式覆盖 .js（Vite 默认 esbuild 只 transform .ts/.jsx/.tsx，
    // 而 hiprint.bundle.js 是 .js，必须显式纳入才能被 drop）。
    esbuild: {
      drop: ['console', 'debugger'],
      include: /\.(m?[jt]s|[jt]sx)$/,
    },
  }

  if (isLib) {
    return {
      ...common,
      // lib 模式不要把 public/（bootstrap.min.css / fonts / template*.png 等 demo 资源）复制进 dist。
      // 这些资源属于演示外壳，不该跟着 npm 包发布。
      publicDir: false,
      build: {
        outDir: 'dist',
        emptyOutDir: true,
        sourcemap: true,
        lib: {
          entry: path.resolve(__dirname, 'src/index.js'),
          name: 'vue-plugin-hiprint',
          formats: ['umd', 'cjs', 'es'],
          fileName: (format) => {
            if (format === 'umd') return 'vue-plugin-hiprint.js'
            if (format === 'cjs') return 'vue-plugin-hiprint.cjs.js'
            return 'vue-plugin-hiprint.esm.js'
          },
        },
        rollupOptions: {
          external: [
            'vue',
            'jquery',
            '@claviska/jquery-minicolors',
            'jsbarcode',
            'socket.io-client',
            'canvg',
            'jspdf',
            'bwip-js',
            'nzh',
            'dom-to-image-more',
          ],
          output: {
            globals: {
              vue: 'Vue',
              jquery: 'jQuery',
              '@claviska/jquery-minicolors': 'minicolors',
              jsbarcode: 'JsBarcode',
              'socket.io-client': 'io',
              canvg: 'canvg',
              jspdf: 'jspdf',
              'bwip-js': 'bwipjs',
              nzh: 'Nzh',
              'dom-to-image-more': 'domtoimage',
            },
            assetFileNames: (assetInfo) => {
              if (assetInfo.name && assetInfo.name.endsWith('.css')) {
                return 'vue-plugin-hiprint.css'
              }
              return assetInfo.name
            },
          },
        },
      },
    }
  }

  return {
    ...common,
    base: mode === 'production' ? '/vue-plugin-hiprint/' : '/',
    build: {
      outDir: 'demo',
      assetsDir: 'static',
      sourcemap: false,
    },
    server: {
      port: 8080,
      open: false,
    },
  }
})
