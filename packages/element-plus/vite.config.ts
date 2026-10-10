import { defineConfig, loadEnv } from "vite-plus"
import { resolve } from "path"
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

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, __dirname, "")
  // VITE_USE_SOURCE 仅用于 dev 热更新（引用源码）；build 一律走外部依赖产物
  const useSource = command === "serve" && env.VITE_USE_SOURCE === "true"
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
    resolve: {
      alias: useSource
        ? [
            {
              find: /^@schemx\/core\/(.+)$/,
              replacement: `${resolve(__dirname, "../core/src")}/$1`,
            },
            {
              find: /^@schemx\/core$/,
              replacement: resolve(__dirname, "../core/src/index.ts"),
            },
            {
              find: /^@schemx\/vue\/(.+)$/,
              replacement: `${resolve(__dirname, "../vue/src")}/$1`,
            },
            {
              find: /^@schemx\/vue$/,
              replacement: resolve(__dirname, "../vue/src/index.ts"),
            },
          ]
        : [],
    },
    css: {
      preprocessorOptions: {
        // Vite 5 使用 Sass legacy API；静默其已知弃用提示。
        scss: { silenceDeprecations: ["legacy-js-api"] },
      },
    },
    plugins: createVitePlugins({ analyze }),
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
