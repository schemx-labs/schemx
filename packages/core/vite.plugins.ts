import { resolve } from "path"

import { visualizer } from "rollup-plugin-visualizer"
import dts from "vite-plugin-dts"

import type { PluginOption } from "vite"

interface PackagePluginOptions {
  analyze: boolean
}

export function createVitePlugins({ analyze }: PackagePluginOptions): PluginOption[] {
  return [
    dts({
      include: ["src/**/*.ts"],
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
        title: "@schemx/core bundle analysis",
      }),
  ].filter(Boolean) as PluginOption[]
}
