/**
 * workspace 包配置检查。
 *
 * @remarks 原实现把规则拆散在 8 次 jq 调用里，且在任一 package.json 缺失时整体跳过
 * 依赖相关规则；这里把规则表集中声明，缺文件时逐条报告，不再连带抑制。
 */
import { readFileSync } from "node:fs"
import path from "node:path"

import { type PackageManifest, readManifestSafe } from "../core/package-json.ts"

/** 必须存在且合法的 package.json。 */
const REQUIRED_MANIFESTS = [
  "packages/vue/package.json",
  "packages/vant/package.json",
  "packages/element-plus/package.json",
  "packages/core/package.json",
] as const

/** 内部依赖声明规则。 */
const INTERNAL_DEPENDENCIES: readonly (readonly [string, string])[] = [
  ["packages/vue/package.json", "@schemx/core"],
  ["packages/vant/package.json", "@schemx/core"],
  ["packages/vant/package.json", "@schemx/vue"],
  ["packages/element-plus/package.json", "@schemx/core"],
  ["packages/element-plus/package.json", "@schemx/vue"],
]

/** 不允许内联 VITE_* 环境变量的 script 所属包。 */
const VITE_SCRIPT_MANIFESTS = [
  "packages/core/package.json",
  "packages/vue/package.json",
  "packages/vant/package.json",
  "packages/element-plus/package.json",
] as const

/** 文件必须包含的文本。 */
const REQUIRED_TEXT: readonly (readonly [string, readonly string[]])[] = [
  ["packages/vue/.env", ["VITE_USE_SOURCE="]],
  ["packages/vant/.env", ["VITE_USE_SOURCE="]],
  ["packages/element-plus/.env", ["VITE_USE_SOURCE="]],
]

/** 文件不得包含的文本。 */
const FORBIDDEN_TEXT: readonly (readonly [string, readonly string[]])[] = [
  ["packages/vant/package.json", ["standalone normalize-vant-dts", "--mode standalone"]],
  ["packages/vant/.env", ["VITE_BUILD_STANDALONE"]],
  [".gitignore", ["packages/vant/.env.standalone"]],
]

/** 内联 VITE_* 环境变量的模式。 */
const INLINE_VITE_ENV = /(?:^|\s)VITE_[A-Z0-9_]+=/

/** 检查结果。 */
export interface ConfigCheckResult {
  /** 是否通过。 */
  readonly ok: boolean
  /** 失败原因列表。 */
  readonly failures: readonly string[]
}

/**
 * 读取文本文件，不存在或不可读时返回 undefined。
 *
 * @param filePath - 文件绝对路径。
 * @returns 文件内容。
 */
function readTextSafe(filePath: string): string | undefined {
  try {
    return readFileSync(filePath, "utf8")
  } catch {
    return undefined
  }
}

/**
 * 校验一个包的内部依赖声明。
 *
 * @param relativePath - 相对路径。
 * @param manifest - 包清单。
 * @param dependencyName - 依赖名。
 * @param failures - 失败累加器。
 */
function checkInternalDependency(
  relativePath: string,
  manifest: PackageManifest,
  dependencyName: string,
  failures: string[]
): void {
  const specifier = manifest.dependencies?.[dependencyName]

  if (specifier === undefined) {
    failures.push(`${relativePath}: dependencies 缺少 ${dependencyName}`)
  } else if (specifier !== "workspace:*") {
    failures.push(`${relativePath}: dependencies.${dependencyName} 必须为 workspace:*`)
  }

  if (manifest.peerDependencies?.[dependencyName] !== undefined) {
    failures.push(`${relativePath}: peerDependencies 不应声明 ${dependencyName}`)
  }

  if (manifest.devDependencies?.[dependencyName] !== undefined) {
    failures.push(`${relativePath}: devDependencies 不应重复声明 ${dependencyName}`)
  }
}

/**
 * 校验包的 script 不内联 VITE_* 环境变量。
 *
 * @param relativePath - 相对路径。
 * @param manifest - 包清单。
 * @param failures - 失败累加器。
 */
function checkViteScripts(
  relativePath: string,
  manifest: PackageManifest,
  failures: string[]
): void {
  for (const [name, value] of Object.entries(manifest.scripts ?? {})) {
    if (INLINE_VITE_ENV.test(value)) {
      failures.push(`${relativePath}: scripts.${name} 不应内联 VITE_* 环境变量`)
    }
  }
}

/**
 * 校验文件包含必需文本。
 *
 * @param root - 仓库根目录。
 * @param failures - 失败累加器。
 */
function checkRequiredText(root: string, failures: string[]): void {
  for (const [relativePath, needles] of REQUIRED_TEXT) {
    const text = readTextSafe(path.join(root, relativePath))

    if (text === undefined) {
      failures.push(`${relativePath}: 文件不存在`)
      continue
    }

    for (const needle of needles) {
      if (!text.includes(needle)) {
        failures.push(`${relativePath}: 缺少 ${needle}`)
      }
    }
  }
}

/**
 * 校验文件不包含禁止文本。
 *
 * @param root - 仓库根目录。
 * @param failures - 失败累加器。
 */
function checkForbiddenText(root: string, failures: string[]): void {
  for (const [relativePath, needles] of FORBIDDEN_TEXT) {
    const text = readTextSafe(path.join(root, relativePath))

    if (text === undefined) {
      failures.push(`${relativePath}: 文件不存在`)
      continue
    }

    for (const needle of needles) {
      if (text.includes(needle)) {
        failures.push(`${relativePath}: 不应包含 standalone 逻辑 ${needle}`)
      }
    }
  }
}

/**
 * 校验全部 workspace 包的发布配置边界。
 *
 * @param root - 仓库根目录。
 * @returns 检查结果。
 */
export function checkPackageConfig(root: string): ConfigCheckResult {
  const failures: string[] = []

  const manifests = new Map<string, PackageManifest>()

  for (const relativePath of REQUIRED_MANIFESTS) {
    const manifest = readManifestSafe(path.join(root, relativePath))

    if (!manifest) {
      failures.push(`${relativePath}: 文件不存在或不是有效 JSON`)
      continue
    }

    manifests.set(relativePath, manifest)
  }

  for (const [relativePath, dependencyName] of INTERNAL_DEPENDENCIES) {
    const manifest = manifests.get(relativePath)

    if (manifest) {
      checkInternalDependency(relativePath, manifest, dependencyName, failures)
    }
  }

  for (const relativePath of VITE_SCRIPT_MANIFESTS) {
    const manifest = manifests.get(relativePath)

    if (manifest) {
      checkViteScripts(relativePath, manifest, failures)
    }
  }

  checkRequiredText(root, failures)
  checkForbiddenText(root, failures)

  return { ok: failures.length === 0, failures }
}
