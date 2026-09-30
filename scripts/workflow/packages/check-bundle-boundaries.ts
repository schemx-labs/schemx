/**
 * 构建产物边界检查。
 *
 * @remarks 断言构建后的 dist 产物保留了 externals，且不泄漏内部源码路径。
 * 原实现用 `rg --pcre2` 拼正则；这里直接读文件内容匹配，避免额外进程与 rg 依赖。
 */
import { readFileSync } from "node:fs"
import path from "node:path"

/** 一条产物断言：必需与禁止的裸依赖。 */
interface BundleRule {
  /** 产物相对路径。 */
  readonly file: string
  /** 必须保留的 externals。 */
  readonly required?: readonly string[]
  /** 不得出现的 externals。 */
  readonly forbidden?: readonly string[]
}

/** 构建产物的 external 断言表。 */
const BUNDLE_RULES: readonly BundleRule[] = [
  {
    file: "packages/core/dist/index.mjs",
    required: ["async-validator"],
    forbidden: ["@schemx/validator"],
  },
  {
    file: "packages/core/dist/index.cjs",
    required: ["async-validator"],
    forbidden: ["@schemx/validator"],
  },
  {
    file: "packages/core/dist/index.mjs",
    required: ["es-toolkit", "es-toolkit/compat", "@preact/signals-core"],
  },
  {
    file: "packages/core/dist/index.cjs",
    required: ["es-toolkit", "es-toolkit/compat", "@preact/signals-core"],
  },
  {
    file: "packages/vue/dist/index.mjs",
    required: ["@schemx/core", "classnames", "es-toolkit"],
    forbidden: ["simple-async-context", "@preact/signals-core"],
  },
  {
    file: "packages/vue/dist/index.cjs",
    required: ["@schemx/core", "classnames", "es-toolkit"],
    forbidden: ["simple-async-context", "@preact/signals-core"],
  },
  {
    file: "packages/vant/dist/index.mjs",
    required: ["@schemx/vue", "classnames", "dayjs", "es-toolkit"],
    forbidden: ["simple-async-context", "@preact/signals-core"],
  },
  {
    file: "packages/vant/dist/index.cjs",
    required: ["@schemx/vue", "classnames", "dayjs", "es-toolkit"],
    forbidden: ["simple-async-context", "@preact/signals-core"],
  },
  {
    file: "packages/element-plus/dist/index.mjs",
    required: ["@schemx/vue", "element-plus", "@element-plus/icons-vue", "dayjs"],
    forbidden: ["vant", "simple-async-context", "@preact/signals-core"],
  },
  {
    file: "packages/element-plus/dist/index.cjs",
    required: ["@schemx/vue", "element-plus", "@element-plus/icons-vue", "dayjs"],
    forbidden: ["vant", "simple-async-context", "@preact/signals-core"],
  },
]

/** 一条类型声明或样式产物断言。 */
interface DeclarationRule {
  /** 文件相对路径。 */
  readonly file: string
  /** 必须出现的 token。 */
  readonly required?: readonly string[]
  /** 不得出现的 token。 */
  readonly forbidden?: readonly string[]
}

/** 类型声明的 token 断言表。 */
const DECLARATION_RULES: readonly DeclarationRule[] = [
  {
    file: "packages/vant/dist/index.d.ts",
    required: ["@schemx/vue"],
    forbidden: ["../../vue/src", "../../core/src"],
  },
  {
    file: "packages/vant/dist/types/schemx.d.ts",
    required: ["@schemx/vue", "@schemx/core"],
    forbidden: ["../../vue/src", "../../core/src"],
  },
  {
    file: "packages/element-plus/dist/index.d.ts",
    required: ["@schemx/vue"],
    forbidden: ["../../vue/src", "../../core/src", "vant"],
  },
  {
    file: "packages/element-plus/dist/types/schemx.d.ts",
    required: ["@schemx/vue", "@schemx/core", "element-plus"],
    forbidden: ["../../vue/src", "../../core/src", "vant"],
  },
]

/** 样式产物的 token 断言表。 */
const ASSET_RULES: readonly DeclarationRule[] = [
  {
    file: "packages/vue/dist/style.css",
    required: [".schemx-row", ".schemx-field"],
    forbidden: ["--van-", "--el-"],
  },
  {
    file: "packages/vant/dist/style.css",
    required: ["--van-primary-color", ".schemx-field-wrapper--first"],
    forbidden: ["--el-"],
  },
  {
    file: "packages/element-plus/dist/style.css",
    required: ["--el-color-primary", ".schemx-group-wrapper"],
    forbidden: ["--van-"],
  },
]

/** 检查结果。 */
export interface BoundaryCheckResult {
  /** 是否通过。 */
  readonly ok: boolean
  /** 失败原因列表。 */
  readonly failures: readonly string[]
}

/** 任意 import/require 声明的匹配器。 */
const IMPORT_PATTERN = /(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*)["']([^"']+)["']/g

/**
 * 收集产物中实际引用的裸依赖。
 *
 * @param source - 产物源码。
 * @returns 依赖名集合。
 */
function collectSpecifiers(source: string): ReadonlySet<string> {
  const found = new Set<string>()

  for (const match of source.matchAll(IMPORT_PATTERN)) {
    const specifier = match[1]

    if (specifier !== undefined) {
      found.add(specifier)
    }
  }

  return found
}

/**
 * 判断产物是否引用了某个 externals 及其子路径。
 *
 * @param specifiers - 产物引用的依赖集合。
 * @param target - 目标依赖名。
 * @returns 是否引用。
 */
function references(specifiers: ReadonlySet<string>, target: string): boolean {
  for (const specifier of specifiers) {
    if (specifier === target || specifier.startsWith(`${target}/`)) {
      return true
    }
  }

  return false
}

/**
 * 读取文本文件；缺失时记录失败并返回 undefined。
 *
 * @param root - 仓库根目录.
 * @param relativePath - 相对路径。
 * @param failures - 失败累加器。
 * @returns 文件内容。
 */
function readArtifact(
  root: string,
  relativePath: string,
  failures: string[]
): string | undefined {
  try {
    return readFileSync(path.join(root, relativePath), "utf8")
  } catch {
    failures.push(`${relativePath}: 文件不存在`)

    return undefined
  }
}

/**
 * 校验构建产物的 external 边界。
 *
 * @param root - 仓库根目录。
 * @returns 检查结果。
 */
export function checkBundleBoundaries(root: string): BoundaryCheckResult {
  const failures: string[] = []

  for (const rule of BUNDLE_RULES) {
    const source = readArtifact(root, rule.file, failures)

    if (source === undefined) {
      continue
    }

    const specifiers = collectSpecifiers(source)

    for (const target of rule.required ?? []) {
      if (!references(specifiers, target)) {
        failures.push(`${rule.file}: 缺少 ${target}`)
      }
    }

    for (const target of rule.forbidden ?? []) {
      if (references(specifiers, target)) {
        failures.push(`${rule.file}: 泄漏 ${target}`)
      }
    }
  }

  for (const rule of [...DECLARATION_RULES, ...ASSET_RULES]) {
    const source = readArtifact(root, rule.file, failures)

    if (source === undefined) {
      continue
    }

    for (const target of rule.required ?? []) {
      if (!source.includes(target)) {
        failures.push(`${rule.file}: 类型声明缺少 ${target}`)
      }
    }

    for (const target of rule.forbidden ?? []) {
      if (source.includes(target)) {
        failures.push(`${rule.file}: 类型声明泄漏 ${target}`)
      }
    }
  }

  return { ok: failures.length === 0, failures }
}
