import { defineConfig, loadEnv } from "vite-plus"
import { resolve } from "path"
import { createVitePlugins } from "./vite.plugins"

const externalPackages = ["vue", "@schemx/core", "classnames", "es-toolkit"]

function isExternal(id: string) {
  return externalPackages.some((pkg) => id === pkg || id.startsWith(`${pkg}/`))
}

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, __dirname, "")
  // VITE_USE_SOURCE 仅用于 dev 热更新（引用源码）；build 一律走外部依赖产物
  const useSource = command === "serve" && env.VITE_USE_SOURCE === "true"
  const analyze = mode === "analyze"

  return {
    test: {
      // Vitest v4 compatibility: preserve mock call history.
      // Remove after tests no longer rely on calls from setup or earlier tests.
      // https://viteplus.dev/guide/vitest-v5#remove-unneeded-compatibility-settings
      // https://vitest.dev/guide/migration/#clearmocks-is-enabled-by-default
      clearMocks: false,
    },
    resolve: {
      alias: [
        { find: "@", replacement: resolve(__dirname, "src") },
        ...(useSource
          ? [
              {
                find: /^@schemx\/core\/(.+)$/,
                replacement: `${resolve(__dirname, "../core/src")}/$1`,
              },
              {
                find: /^@schemx\/core$/,
                replacement: resolve(__dirname, "../core/src/index.ts"),
              },
            ]
          : []),
      ],
    },
    plugins: createVitePlugins({ analyze }),
    build: {
      lib: {
        entry: resolve(__dirname, "src/index.ts"),
        cssFileName: "style",
        name: "schemxCore",
        formats: ["es", "cjs"],
        fileName: (format) => {
          if (format === "es") return "index.mjs"
          return "index.cjs"
        },
      },
      rollupOptions: {
        external: isExternal,
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
  }
})
