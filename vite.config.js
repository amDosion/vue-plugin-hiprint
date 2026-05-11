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

    fs.copyFileSync(
      path.resolve(__dirname, 'src/hiprint/css/print-lock.css'),
      path.resolve(__dirname, 'dist/print-lock.css')
    )
  },
})

export default defineConfig(({ mode }) => {
  const common = {
    plugins: [vue(), stripConsoleInDev(), copyPrintLockCss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
        // V2 拆分 (refactor/hiprint-v2 branch): ES module 版本与 v1 bundle.js 并存。
        // 见 docs/adr/0010-hiprint-bundle-refactor-strangler-fig.md
        '@hiprint-v2': path.resolve(__dirname, 'src/hiprint-v2'),
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
          // V1 main entry + V2 alpha entry (P13 Strangler Fig). Vite 5 supports
          // lib.entry as Record<name, path> for multi-entry builds.
          // Note: UMD format incompatible with multi-entry — drop to cjs+es only.
          // Business consumers needing UMD continue using v1.0.2 (1 entry).
          entry: {
            'vue-plugin-hiprint': path.resolve(__dirname, 'src/index.js'),
            'vue-plugin-hiprint.v2': path.resolve(__dirname, 'src/index-v2.js'),
          },
          name: 'vue-plugin-hiprint',
          formats: ['cjs', 'es'],
          fileName: (format, entryName) => {
            if (format === 'cjs') return entryName + '.cjs.js'
            return entryName + '.esm.js'
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
