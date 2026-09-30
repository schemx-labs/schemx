/**
 * Vite 插件本地打包。
 *
 * @remarks 原实现在 4 处手动恢复版本且没有 trap，中断会把插件的 package.json 版本
 * 留在工作区；这里用 try/finally 保证恢复，并通过统一的哨兵行返回 tarball 路径。
 */
import { existsSync, mkdirSync, readdirSync } from "node:fs"
import path from "node:path"

import { failure, usageError } from "../core/errors.ts"
import { readManifestSafe, writeManifest } from "../core/package-json.ts"
import { type Ui } from "../ui/ui.ts"

/** 支持本地打包的 Vite 插件。 */
const SUPPORTED_PLUGINS: ReadonlySet<string> = new Set([
  "vite-plugin-workspace-source",
  "vite-plugin-package-resolution-compat",
  "vite-plugin-realpath-fallback",
])

/** 返回 tarball 路径的哨兵行前缀。 */
export const TARBALL_SENTINEL = "__SCHEMX_LOCAL_TARBALL__="

/** 插件打包选项。 */
export interface PluginPackOptions {
  /** 仓库根目录。 */
  readonly root: string
  /** 终端 UI。 */
  readonly ui: Ui
  /** 插件标识。 */
  readonly pluginKey: string
  /** 版本后缀。 */
  readonly suffix: string
  /** 产物目录。 */
  readonly outputDir: string
}

/**
 * 执行 Vite 插件本地打包。
 *
 * @param options - 打包选项。
 * @returns tarball 路径。
 * @throws {WorkflowError} 插件未知或打包失败时抛出。
 */
export async function packVitePlugin(options: PluginPackOptions): Promise<string> {
  const { root, ui, pluginKey, suffix, outputDir } = options

  if (!SUPPORTED_PLUGINS.has(pluginKey)) {
    throw usageError(`未知 Vite 插件：${pluginKey}`)
  }

  const pluginDir = path.join(root, "plugins", pluginKey)

  const manifestPath = path.join(pluginDir, "package.json")

  if (!existsSync(manifestPath)) {
    throw failure(`插件目录不存在：plugins/${pluginKey}`)
  }

  const original = readManifestSafe(manifestPath)

  if (!original?.version || !original.name) {
    throw failure(`无法读取 plugins/${pluginKey}/package.json`)
  }

  const stamp = new Date().toISOString().replace(/\D/g, "").slice(0, 14)

  const packVersion = `${original.version}-${suffix}.${stamp}`

  mkdirSync(outputDir, { recursive: true })

  try {
    writeManifest(manifestPath, { ...original, version: packVersion })

    const build = await ui.task(
      { title: `构建 ${original.name}`, itemKey: original.name, log: "live" },
      async () => await ui.exec("pnpm", ["run", "build"], { cwd: pluginDir })
    )

    if (build !== 0) {
      throw failure(`构建 ${original.name} 失败。`)
    }

    const packed = await ui.task(
      { title: `打包 ${original.name}`, itemKey: original.name, log: "live" },
      async () =>
        await ui.exec("pnpm", ["pack", "--pack-destination", outputDir], {
          cwd: pluginDir,
        })
    )

    if (packed !== 0) {
      throw failure(`打包 ${original.name} 失败。`)
    }

    // 产物名由 pnpm 依据包名与版本生成，按版本精确定位，避免误取历史 tarball。
    const tarball = readdirSync(outputDir).find((file) =>
      file.endsWith(`-${packVersion}.tgz`)
    )

    if (tarball === undefined) {
      throw failure(`未找到本次打包产物：${packVersion}`)
    }

    return path.join(outputDir, tarball)
  } finally {
    const current = readManifestSafe(manifestPath)

    writeManifest(manifestPath, { ...current, version: original.version })
  }
}
