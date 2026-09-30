import { resolve } from "path"

import vue from "@vitejs/plugin-vue"
import vueJsx from "@vitejs/plugin-vue-jsx"
import { visualizer } from "rollup-plugin-visualizer"
import dts from "vite-plugin-dts"

import { injectStyleCss } from "../../scripts/vite/inject-style-css"

import type { PluginOption } from "vite"

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
      outDirs: "dist",
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
