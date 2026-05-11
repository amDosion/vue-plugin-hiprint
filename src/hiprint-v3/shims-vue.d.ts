/**
 * shims-vue.d.ts — module shim so `tsc` accepts `import X from './X.vue'`.
 *
 * Vue 3 SFCs are not native TS modules; `@vue/tsconfig` does not ship a
 * project-level shim. Without this file the V3 element components barrel
 * (./components/elements/index.ts) reports TS2307 for every `.vue` import.
 *
 * The declared type is the generic `DefineComponent` from 'vue', which is
 * sufficient for `<script setup>` SFCs — at consumer sites Vue's volar /
 * vue-tsc deliver more specific types from the actual SFC body.
 */
declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<
    Record<string, unknown>,
    Record<string, unknown>,
    unknown
  >
  export default component
}
