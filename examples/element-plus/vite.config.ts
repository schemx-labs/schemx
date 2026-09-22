import { defineConfig, loadEnv, type Plugin } from "vite"
import vue from "@vitejs/plugin-vue"
import vueJsx from "@vitejs/plugin-vue-jsx"
import { existsSync, statSync } from "fs"
import { resolve } from "path"

const suffixes = [
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".vue",
  "/index.ts",
  "/index.tsx",
  "/index.js",
  "/index.jsx",
  "/index.vue",
]

function tryResolveFile(basePath: string): string | null {
  if (existsSync(basePath) && statSync(basePath).isFile()) return basePath

  for (const suffix of suffixes) {
    const candidate = basePath + suffix

    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate
  }

  return null
}

function dynamicAtAlias(packageRoots: Record<string, string>): Plugin {
  return {
    name: "dynamic-at-alias",
    enforce: "pre",
    resolveId(source, importer) {
      if (!source.startsWith("@/") || !importer) return null

      for (const root of Object.values(packageRoots)) {
        if (!importer.startsWith(root)) continue

        return tryResolveFile(resolve(root, source.slice(2)))
      }

      return null
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, "")
  const useSource = env.VITE_USE_SOURCE === "true"
  const packagesDir = resolve(__dirname, "../../packages")
  const packageRoots = {
    core: resolve(packagesDir, "core/src"),
    vue: resolve(packagesDir, "vue/src"),
    elementPlus: resolve(packagesDir, "element-plus/src"),
  }

  return {
    resolve: {
      alias: useSource
        ? [
            { find: /^@schemx\/core\/(.+)$/, replacement: `${packageRoots.core}/$1` },
            { find: /^@schemx\/core$/, replacement: `${packageRoots.core}/index.ts` },
            { find: /^@schemx\/vue\/(.+)$/, replacement: `${packageRoots.vue}/$1` },
            { find: /^@schemx\/vue$/, replacement: `${packageRoots.vue}/index.ts` },
            {
              find: /^@schemx\/element-plus\/style\.css$/,
              replacement: `${packageRoots.elementPlus}/styles/index.scss`,
            },
            {
              find: /^@schemx\/element-plus\/(.+)$/,
              replacement: `${packageRoots.elementPlus}/$1`,
            },
            {
              find: /^@schemx\/element-plus$/,
              replacement: `${packageRoots.elementPlus}/index.ts`,
            },
          ]
        : [],
    },
    plugins: [...(useSource ? [dynamicAtAlias(packageRoots)] : []), vue(), vueJsx()],
    server: {
      host: "0.0.0.0",
    },
  }
})
