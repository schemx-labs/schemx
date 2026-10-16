import { defineConfig, lazyPlugins } from "vite-plus"
import vue from "@vitejs/plugin-vue"
import vueJsx from "@vitejs/plugin-vue-jsx"
import { workspaceSource } from "vite-plugin-workspace-source"

export default defineConfig({
  plugins: lazyPlugins(() => [
    workspaceSource({ projectRoot: __dirname }),
    vue(),
    vueJsx(),
  ]),
  css: {
    preprocessorOptions: {
      scss: { api: "modern-compiler", silenceDeprecations: ["legacy-js-api"] },
    },
  },
  server: { host: "0.0.0.0" },
})
