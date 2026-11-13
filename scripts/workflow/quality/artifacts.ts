/**
 * 包配置与实际发布文件的共享检查。
 */
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"

import { checkBundleBoundaries } from "../packages/check-bundle-boundaries.ts"
import { checkPackageConfig } from "../packages/check-config.ts"
import { executeWorkflowCommand } from "../presentation.ts"

import type { Context } from "../core/context.ts"
import type { RunResult } from "../core/exec.ts"

/**
 * 可注入的打包预览命令。
 */
export type PackPreview = (directory: string) => Promise<RunResult>

/**
 * 校验一个包的配置及构建后实际打包内容。
 * @param context - 当前仓库和执行环境。
 * @param directory - 需要检查的包目录。
 * @param preview - 不执行生命周期脚本的打包预览。
 * @example await checkQualityArtifacts(context, "packages/vue", preview)
 */
export async function checkQualityArtifacts(
  context: Context,
  directory: string,
  preview: PackPreview
): Promise<void> {
  // 仅检查当前包的产物边界结果。
  const boundary = await checkBundleBoundaries(context.root, [directory])

  if (!boundary.ok) {
    throw new Error(boundary.failures.join("\n"))
  }

  // 当前包的原始发布清单。
  const manifest = JSON.parse(
    readFileSync(path.join(context.root, directory, "package.json"), "utf8")
  ) as Record<string, unknown>

  // exports 与传统入口引用的发布文件。
  const targets = new Set<string>()

  /**
   * @param value - exports 条件树、main、module 或 types 的当前节点。
   */
  const collect = (value: unknown): void => {
    if (typeof value === "string") {
      targets.add(value.replace(/^\.\//, ""))
    } else if (value && typeof value === "object") {
      for (const child of Object.values(value)) {
        collect(child)
      }
    }
  }

  collect(manifest.exports)
  for (const key of ["main", "module", "types"]) {
    collect(manifest[key])
  }

  for (const target of targets) {
    if (target.includes("*")) {
      throw new Error(`暂不支持通配 exports 产物检查：${target}`)
    }

    if (!existsSync(path.join(context.root, directory, target))) {
      throw new Error(`导出产物不存在：${directory}/${target}`)
    }
  }

  // 当前执行边界返回的结果。
  const result = await preview(directory)

  if (result.code !== 0) {
    throw new Error(result.output || `打包预览失败：exit ${result.code}`)
  }

  // pnpm 实际打包文件清单。
  const packed = JSON.parse(result.stdout) as
    { files?: { path: string }[] } | { files?: { path: string }[] }[]

  // 当前包对应的打包预览记录。
  const record = Array.isArray(packed) ? packed[0] : packed

  if (!Array.isArray(record?.files)) {
    throw new Error("打包预览未返回 files 文件清单")
  }

  // 规范化后的实际发布路径。
  const files = new Set(record.files.map((file) => file.path.replace(/^\.\//, "")))

  for (const target of targets) {
    if (!files.has(target)) {
      throw new Error(`导出产物未纳入发布文件：${target}`)
    }
  }
}

/**
 * 按目标包筛选现有配置规则。
 * @param root - 仓库根目录。
 * @param directory - 单个目标包。
 * @example await checkQualityConfig(root, "packages/vue")
 */
export async function checkQualityConfig(root: string, directory: string): Promise<void> {
  // 当前执行边界返回的结果。
  const result = await checkPackageConfig(root, [directory])

  if (!result.ok) {
    throw new Error(result.failures.join("\n"))
  }
}

/**
 * 捕获 pnpm 的机器可读打包清单，不运行包生命周期脚本。
 * @param context - 当前仓库、终端与环境。
 * @param directory - 待预览包的相对目录。
 * @example const result = await previewQualityPackage(context, "packages/vue")
 */
export async function previewQualityPackage(
  context: Context,
  directory: string
): Promise<RunResult> {
  return await executeWorkflowCommand({
    terminal: context.terminal,
    command: "pnpm",
    args: ["--dir", directory, "pack", "--dry-run", "--json"],
    cwd: context.root,
    outputMode: "capture",
    env: { ...context.env, npm_config_ignore_scripts: "true" },
  })
}
