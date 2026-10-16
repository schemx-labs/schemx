import { defineConfig } from "vite-plus"
import { resolve } from "path"
import { workspaceSource } from "vite-plugin-workspace-source"
import { createVitePlugins } from "./vite.plugins"

const externalPackages = [
  "vue",
  "element-plus",
  "@element-plus/icons-vue",
  "@schemx/core",
  "@schemx/vue",
  "dayjs",
]

function createExternalMatcher(packages: string[]) {
  return (id: string) => packages.some((pkg) => id === pkg || id.startsWith(`${pkg}/`))
}

export default defineConfig(({ mode }) => {
  const analyze = mode === "analyze"
  const isExternal = createExternalMatcher(externalPackages)

  return {
    test: {
      // Vitest v4 compatibility: preserve mock call history.
      // Remove after tests no longer rely on calls from setup or earlier tests.
      // https://viteplus.dev/guide/vitest-v5#remove-unneeded-compatibility-settings
      // https://vitest.dev/guide/migration/#clearmocks-is-enabled-by-default
      clearMocks: false,
    },
    css: {
      preprocessorOptions: {
        // Vite 5 使用 Sass legacy API；静默其已知弃用提示。
        scss: { silenceDeprecations: ["legacy-js-api"] },
      },
    },
    plugins: [
      workspaceSource({ projectRoot: __dirname }),
      ...createVitePlugins({ analyze }),
    ],
    build: {
      lib: {
        entry: resolve(__dirname, "src/index.ts"),
        cssFileName: "style",
        name: "schemxElementPlus",
        formats: ["es", "cjs"],
        fileName: (format) => {
          if (format === "es") return "index.mjs"
          return "index.cjs"
        },
      },
      rollupOptions: {
        external: isExternal,
        output: {
          exports: "named",
        },
        treeshake: {
          moduleSideEffects: "no-external",
        },
      },
      sourcemap: true,
      minify: "terser",
    },
  }
})
