import { defineConfig, transformWithEsbuild } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

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

export default defineConfig(({ mode }) => {
  const common = {
    plugins: [vue(), stripConsoleInDev()],
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
            'lodash',
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
              lodash: '_',
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
