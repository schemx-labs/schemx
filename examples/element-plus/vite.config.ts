import { defineConfig, lazyPlugins } from "vite-plus"
import vue from "@vitejs/plugin-vue"
import vueJsx from "@vitejs/plugin-vue-jsx"
import { createRequire } from "node:module"
import { workspaceSource } from "vite-plugin-workspace-source"

export default defineConfig(() => {
  // Keep Element Plus and Vue on the same @vue/shared implementation.
  const resolveFromConfig = createRequire(import.meta.url)
  const resolveFromVue = createRequire(resolveFromConfig.resolve("vue"))
  const vueSharedPath = resolveFromVue.resolve("@vue/shared")

  return {
    resolve: {
      alias: [{ find: /^@vue\/shared$/, replacement: vueSharedPath }],
    },
    plugins: lazyPlugins(() => [
      workspaceSource({ projectRoot: __dirname }),
      vue(),
      vueJsx(),
    ]),
    server: { host: "0.0.0.0" },
  }
})
