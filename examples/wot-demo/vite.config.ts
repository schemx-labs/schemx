import { defineConfig, loadEnv, Plugin, PluginOption } from "vite"
import vueJsx from "@vitejs/plugin-vue-jsx"
import uni from "@dcloudio/vite-plugin-uni"
import { resolve } from "path"
import { existsSync, statSync } from "fs"

const INDEX_SUFFIXES = [
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

/**
 * 尝试将路径解析为具体文件。
 *
 * 如果路径本身是文件则直接返回，如果是目录或无后缀则依次尝试
 * 常见后缀和 index 文件，返回第一个存在的路径。
 *
 * @param basePath - 待解析的基础路径
 *
 * @returns 解析后的文件路径，未找到则返回 null
 */
function tryResolveFile(basePath: string): string | null {
  if (existsSync(basePath) && statSync(basePath).isFile()) {
    return basePath
  }
  for (const suffix of INDEX_SUFFIXES) {
    const candidate = basePath + suffix
    if (existsSync(candidate) && statSync(candidate).isFile()) {
      return candidate
    }
  }
  return null
}

/**
 * 根据 importer 所在包动态解析 @/ 路径别名。
 *
 * 各子包（core/vue/wot）源码中使用 @/ 指向自身 src 目录，
 * 当 wot-demo 直接引用源码时，需要根据 importer 的实际位置
 * 将 @/ 解析到对应包的 src 下，并自动补全 index 文件。
 *
 * @param pkgRoots - 包名到 src 绝对路径的映射
 */
function dynamicAtAlias(pkgRoots: Record<string, string>): Plugin {
  return {
    name: "dynamic-at-alias",
    enforce: "pre",
    resolveId(source, importer) {
      if (!source.startsWith("@/") || !importer) return null

      for (const root of Object.values(pkgRoots)) {
        if (importer.startsWith(root)) {
          const resolved = tryResolveFile(resolve(root, source.slice(2)))
          return resolved
        }
      }
      return null
    },
  }
}

// https://vitejs.dev/config/

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname)

  /**
   * 是否直接引用 @schemx/* 源码，由 .env 中 VITE_USE_SOURCE 控制。
   *
   * true  = 引用源码，修改后 vite 热更新，无需 build
   * false = 引用构建产物（dist）
   */
  const useSource = env.VITE_USE_SOURCE === "true"

  const packagesDir = resolve(__dirname, "../../packages")

  const pkgRoots: Record<string, string> = {
    core: resolve(packagesDir, "core/src"),
    vue: resolve(packagesDir, "vue/src"),
    wot: resolve(packagesDir, "wot/src"),
  }

  return {
    resolve: {
      alias: useSource
        ? [
            { find: "@schemx/core", replacement: resolve(pkgRoots.core, "index.ts") },
            { find: "@schemx/vue", replacement: resolve(pkgRoots.vue, "index.ts") },
            { find: "@schemx/wot", replacement: resolve(pkgRoots.wot, "index.ts") },
          ]
        : [],
    },
    css: {
      preprocessorOptions: {
        scss: { api: "modern-compiler", silenceDeprecations: ["legacy-js-api"] },
      },
    },
    plugins: [
      ...(useSource ? [dynamicAtAlias(pkgRoots)] : []),
      uni(),
      vueJsx(),
    ] as PluginOption[],
    server: {
      host: "0.0.0.0",
    },
  }
})
