import { defineConfig } from "vite-plus"
import { resolve } from "path"
import { workspaceSource } from "vite-plugin-workspace-source"
import { createVitePlugins } from "./vite.plugins"

const externalPackages = ["vue", "@schemx/core", "classnames", "es-toolkit"]

function isExternal(id: string) {
  return externalPackages.some((pkg) => id === pkg || id.startsWith(`${pkg}/`))
}

export default defineConfig(({ mode }) => {
  const analyze = mode === "analyze"

  return {
    test: {
      // Vitest v4 compatibility: preserve mock call history.
      // Remove after tests no longer rely on calls from setup or earlier tests.
      // https://viteplus.dev/guide/vitest-v5#remove-unneeded-compatibility-settings
      // https://vitest.dev/guide/migration/#clearmocks-is-enabled-by-default
      clearMocks: false,
    },
    plugins: [
      workspaceSource({ projectRoot: __dirname }),
      ...createVitePlugins({ analyze }),
    ],
    build: {
      lib: {
        entry: {
          index: resolve(__dirname, "src/index.ts"),
        },
        cssFileName: "style",
        name: "schemxCore",
        formats: ["es", "cjs"],
        fileName: (format, entryName) => {
          if (format === "es") return `${entryName}.mjs`
          return `${entryName}.cjs`
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
