import { defineConfig } from "vite"
import { resolve } from "path"
import { createVitePlugins } from "./vite.plugins"

const externalPackages = ["es-toolkit", "@preact/signals-core", "async-validator"]

function isExternal(id: string) {
  return externalPackages.some((pkg) => id === pkg || id.startsWith(`${pkg}/`))
}

export default defineConfig(({ mode }) => {
  const analyze = mode === "analyze"

  return {
    resolve: {
      alias: {
        "@": resolve(__dirname, "src"),
      },
    },
    plugins: createVitePlugins({ analyze }),
    build: {
      lib: {
        entry: {
          index: resolve(__dirname, "src/index.ts"),
          adapter: resolve(__dirname, "src/adapter/index.ts"),
        },
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
