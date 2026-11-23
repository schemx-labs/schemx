import { defineConfig } from "vite"
import vue from "@vitejs/plugin-vue"
import vueJsx from "@vitejs/plugin-vue-jsx"
import dts from "vite-plugin-dts"
import { resolve } from "path"

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  plugins: [
    vue(),
    vueJsx(),
    dts({
      include: ["src/**/*.ts", "src/**/*.tsx", "src/**/*.vue"],
      outDir: "dist",
      tsconfigPath: "tsconfig.build.json",
      skipDiagnostics: true,
      logDiagnostics: false,
      rollupTypes: true,
    }),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "schemxWot",
      formats: ["es", "cjs"],
      fileName: (format) => {
        if (format === "es") return "index.mjs"
        return "index.cjs"
      },
    },
    rollupOptions: {
      external: (id) =>
        ["vue", "@schemx/core", "@schemx/vue", "classnames", "dayjs"].includes(id) ||
        id === "@wot-ui/ui" ||
        id.startsWith("@wot-ui/ui/"),
      output: {
        globals: {
          vue: "Vue",
          "@wot-ui/ui": "WotUI",
          "@schemx/core": "schemxCore",
        },
        exports: "named",
      },
    },
    sourcemap: true,
    minify: "terser",
  },
})
