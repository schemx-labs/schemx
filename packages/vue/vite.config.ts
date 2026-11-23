import { defineConfig } from "vite"
import vue from "@vitejs/plugin-vue"
import vueJsx from "@vitejs/plugin-vue-jsx"
import dts from "vite-plugin-dts"
import { visualizer } from "rollup-plugin-visualizer"
import { resolve } from "path"
import { injectStyleCss } from "@plugins/injectStyleCss"

const useSource = process.env.VITE_USE_SOURCE === "true"
const analyze = process.env.ANALYZE === "true"

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
      ...(useSource
        ? { "@schemx/core": resolve(__dirname, "../core/src/index.ts") }
        : {}),
    },
  },
  plugins: [
    vue(),
    vueJsx(),
    injectStyleCss(),
    dts({
      include: ["src/**/*.ts", "src/**/*.tsx"],
      outDir: "dist",
      tsconfigPath: "tsconfig.build.json",
      // rollupTypes: true,
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
  ].filter(Boolean),
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "schemxCore",
      formats: ["es", "cjs", "umd"],
      fileName: (format) => {
        if (format === "es") return "index.mjs"
        if (format === "cjs") return "index.cjs"
        return "index.umd.js"
      },
    },
    rollupOptions: {
      external: ["vue", "classnames", "dayjs", "es-toolkit", "@preact/signals-core"],
      output: {
        globals: {
          vue: "Vue",
        },
        exports: "named",
        assetFileNames: (assetInfo) => {
          if (assetInfo.name === "style.css") return "style.css"
          return assetInfo.name || "asset"
        },
      },
    },
    sourcemap: true,
    minify: "terser",
  },
})
