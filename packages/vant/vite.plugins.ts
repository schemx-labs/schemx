import { normalize, resolve } from "path"
import type { Plugin, PluginOption } from "vite"
import vue from "@vitejs/plugin-vue"
import vueJsx from "@vitejs/plugin-vue-jsx"
import dts from "vite-plugin-dts"
import { visualizer } from "rollup-plugin-visualizer"
import { injectStyleCss } from "@plugins/inject-style-css"

interface PackagePluginOptions {
  analyze: boolean
}

function workspaceSourceAlias(): Plugin {
  const sourceRoots = [
    {
      marker: normalize(resolve(__dirname, "src")),
      root: resolve(__dirname, "src"),
    },
    {
      marker: normalize(resolve(__dirname, "../vue/src")),
      root: resolve(__dirname, "../vue/src"),
    },
    {
      marker: normalize(resolve(__dirname, "../core/src")),
      root: resolve(__dirname, "../core/src"),
    },
  ]

  return {
    name: "workspace-source-alias",
    enforce: "pre",
    async resolveId(id, importer) {
      if (!id.startsWith("@/")) return null

      const normalizedImporter = importer ? normalize(importer) : ""
      const sourceRoot =
        sourceRoots.find(({ marker }) => normalizedImporter.startsWith(marker))?.root ??
        resolve(__dirname, "src")
      const absoluteId = resolve(sourceRoot, id.slice(2))

      return this.resolve(absoluteId, importer, { skipSelf: true })
    },
  }
}

export function createVitePlugins({ analyze }: PackagePluginOptions): PluginOption[] {
  return [
    workspaceSourceAlias(),
    vue(),
    vueJsx(),
    injectStyleCss(),
    dts({
      include: ["src/**/*.ts", "src/**/*.tsx", "src/**/*.vue"],
      outDir: "dist",
      tsconfigPath: "tsconfig.build.json",
      clearPureImport: false,
    }),
    analyze &&
      visualizer({
        filename: resolve(__dirname, "dist/analyze.html"),
        gzipSize: true,
        brotliSize: true,
        open: false,
        template: "treemap",
        title: "@schemx/vant bundle analysis",
      }),
  ].filter(Boolean) as PluginOption[]
}
