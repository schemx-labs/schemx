import { resolve } from "path"
import type { PluginOption } from "vite"
import vue from "@vitejs/plugin-vue"
import vueJsx from "@vitejs/plugin-vue-jsx"
import dts from "vite-plugin-dts"
import { visualizer } from "rollup-plugin-visualizer"
import { injectStyleCss } from "@plugins/inject-style-css"

interface PackagePluginOptions {
  analyze: boolean
}

export function createVitePlugins({ analyze }: PackagePluginOptions): PluginOption[] {
  return [
    vue(),
    vueJsx(),
    injectStyleCss(),
    dts({
      include: ["src/**/*.ts", "src/**/*.tsx", "src/**/*.vue"],
      outDir: "dist",
      tsconfigPath: "tsconfig.build.json",
    }),
    analyze &&
      visualizer({
        filename: resolve(__dirname, "dist/analyze.html"),
        gzipSize: true,
        brotliSize: true,
        open: false,
        template: "treemap",
        title: "@schemx/vue bundle analysis",
      }),
  ].filter(Boolean) as PluginOption[]
}
