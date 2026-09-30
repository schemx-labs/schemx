/**
 * package.json 读写。替代原先每次调用都 fork 一次 jq 的做法。
 */
import { readFileSync, renameSync, writeFileSync } from "node:fs"
import path from "node:path"

/** package.json 中本工作流关心的字段。 */
export interface PackageManifest {
  name?: string
  version?: string
  private?: boolean
  scripts?: Record<string, string>
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  optionalDependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
  peerDependenciesMeta?: Record<string, { optional?: boolean }>
}

/**
 * 读取一个 package.json。
 *
 * @param manifestPath - package.json 绝对路径。
 * @returns 解析后的清单。
 * @throws {Error} 文件缺失或 JSON 非法时抛出。
 */
export function readManifest(manifestPath: string): PackageManifest {
  const source = readFileSync(manifestPath, "utf8")

  return JSON.parse(source) as PackageManifest
}

/**
 * 读取一个 package.json，文件缺失时返回 undefined。
 *
 * @param manifestPath - package.json 绝对路径。
 * @returns 解析后的清单，或 undefined。
 */
export function readManifestSafe(manifestPath: string): PackageManifest | undefined {
  try {
    return readManifest(manifestPath)
  } catch {
    return undefined
  }
}

/**
 * 原子写回一个 package.json，保持两空格缩进与末尾换行。
 *
 * @param manifestPath - package.json 绝对路径。
 * @param manifest - 待写入的清单。
 */
export function writeManifest(manifestPath: string, manifest: PackageManifest): void {
  const temporary = `${manifestPath}.${process.pid}.tmp`

  writeFileSync(temporary, `${JSON.stringify(manifest, null, 2)}\n`)
  renameSync(temporary, manifestPath)
}

/**
 * 读取原始文本，供只需要子串断言的检查使用。
 *
 * @param filePath - 文件绝对路径。
 * @returns 文件内容。
 * @throws {Error} 文件缺失时抛出。
 */
export function readText(filePath: string): string {
  return readFileSync(filePath, "utf8")
}

/**
 * 解析并返回文件绝对路径。
 *
 * @param root - 仓库根目录。
 * @param relativePath - 相对路径。
 * @returns 绝对路径。
 */
export function fromRoot(root: string, relativePath: string): string {
  return path.resolve(root, relativePath)
}

/**
 * 判断包是否具备公开发布条件：非私有且同时有包名与版本。
 *
 * @param manifest - 包清单。
 * @returns 是否可发布。
 */
export function isPublishable(manifest: PackageManifest): boolean {
  return manifest.private !== true && Boolean(manifest.name) && Boolean(manifest.version)
}

/**
 * 判断包是否定义了指定 npm script。
 *
 * @param manifest - 包清单。
 * @param scriptName - script 名称。
 * @returns 是否定义。
 */
export function hasScript(manifest: PackageManifest, scriptName: string): boolean {
  return manifest.scripts?.[scriptName] !== undefined
}

/**
 * 列出使用 workspace: 协议声明的内部依赖。
 *
 * @remarks 只统计 dependencies 与 optionalDependencies；devDependencies 不参与发布，
 * peerDependencies 在发布时不会被改写。
 *
 * @param manifest - 包清单。
 * @returns 按名称排序的 npm 依赖名列表。
 */
export function workspaceDependencyNames(manifest: PackageManifest): string[] {
  const specifiers = { ...manifest.dependencies, ...manifest.optionalDependencies }

  return Object.keys(specifiers)
    .filter((name) => String(specifiers[name]).startsWith("workspace:"))
    .sort()
}
