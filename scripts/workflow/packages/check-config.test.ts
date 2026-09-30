/**
 * workspace 包配置检查的规则测试。
 *
 * @remarks 覆盖内容与对应约束：
 * - 4 个 package.json、4 个 .env 与根 .gitignore 全部合规时 `ok: true`；
 * - 内部依赖必须声明在 `dependencies` 且使用 `workspace:*` 协议；
 * - 内部依赖不得同时出现在 `peerDependencies` / `devDependencies`（发布时会被二次改写）；
 * - 任何 script 都不得内联 `VITE_*` 环境变量（正则 `(?:^|\s)VITE_[A-Z0-9_]+=`），
 *   构建配置必须来自 .env，否则 CI 与本地行为不一致；
 * - .env 必须声明 `VITE_USE_SOURCE=` / `VITE_ANALYZE=`；
 * - standalone 产物链路已下线，因此 `packages/vant/package.json` 的 script、
 *   `packages/vant/.env` 的 `VITE_BUILD_STANDALONE` 与 `.gitignore` 的
 *   `packages/vant/.env.standalone` 条目都属于禁止文本（注意这条规则是「不得包含」，
 *   出现在文件里才报错，缺失不会报错）；
 * - 关键行为修正：任一 package.json 缺失时，**其余包**的依赖类规则仍要逐条报告
 *   （原实现在 manifest 缺失时会整体跳过依赖类检查，缺一个包就静默放过另外三个）。
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { checkPackageConfig } from "./check-config.ts"

/** 测试用清单，只声明本文件关心的字段。 */
interface TestManifest {
  name?: string
  version?: string
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
  scripts?: Record<string, string>
}

let root = ""

/**
 * 写一个文件，父目录自动创建。
 *
 * @param relativePath - 相对仓库根的路径。
 * @param content - 文件内容。
 */
function write(relativePath: string, content: string): void {
  const filePath = path.join(root, relativePath)

  mkdirSync(path.dirname(filePath), { recursive: true })
  writeFileSync(filePath, content)
}

/**
 * 写一个 package.json。
 *
 * @param relativePath - 相对仓库根的路径。
 * @param manifest - 清单内容。
 */
function writeManifest(relativePath: string, manifest: unknown): void {
  write(relativePath, `${JSON.stringify(manifest, null, 2)}\n`)
}

/**
 * 读回一个 package.json 并按 JSON 解析。
 *
 * @param relativePath - 相对仓库根的路径。
 * @returns 解析后的清单。
 */
function readManifest(relativePath: string): TestManifest {
  return JSON.parse(readFileSync(path.join(root, relativePath), "utf8")) as TestManifest
}

/**
 * 写入一套合规的 workspace 配置，作为逐条破坏规则的基线。
 */
function writeCompliantWorkspace(): void {
  writeManifest("packages/core/package.json", {
    name: "@schemx/core",
    version: "1.0.0",
    scripts: { build: "vp build", "build:analyze": "vp build --analyze" },
  })
  writeManifest("packages/vue/package.json", {
    name: "@schemx/vue",
    version: "1.0.0",
    scripts: { build: "vp build" },
    dependencies: { "@schemx/core": "workspace:*", classnames: "^2.5.1" },
    peerDependencies: { vue: "^3.0.0" },
  })
  writeManifest("packages/vant/package.json", {
    name: "@schemx/vant",
    version: "1.0.0",
    scripts: { build: "vp build", "pack:local": "node scripts/pack.mjs" },
    dependencies: {
      "@schemx/core": "workspace:*",
      "@schemx/vue": "workspace:*",
      dayjs: "^1.11.19",
    },
    peerDependencies: { vant: "^4.0.0", vue: "^3.0.0" },
  })
  writeManifest("packages/element-plus/package.json", {
    name: "@schemx/element-plus",
    version: "0.0.1",
    scripts: { build: "vp build" },
    dependencies: { "@schemx/core": "workspace:*", "@schemx/vue": "workspace:*" },
    peerDependencies: { "element-plus": "^2.14.0", vue: "^3.0.0" },
  })

  write("packages/core/.env", "VITE_USE_SOURCE=true\nVITE_ANALYZE=false\n")
  write("packages/vue/.env", "VITE_USE_SOURCE=true\nVITE_ANALYZE=false\n")
  write("packages/vant/.env", "VITE_USE_SOURCE=true\nVITE_ANALYZE=false\n")
  write("packages/element-plus/.env", "VITE_USE_SOURCE=true\nVITE_ANALYZE=false\n")

  write(".gitignore", "node_modules/\ndist/\n*.tgz\n")
}

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), "check-config-"))
  writeCompliantWorkspace()
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe("checkPackageConfig 合规基线", () => {
  it("全部规则满足时返回 ok", () => {
    expect(checkPackageConfig(root)).toEqual({ ok: true, failures: [] })
  })

  it(".env 缺少 VITE_USE_SOURCE 时报告缺少项", () => {
    write("packages/vue/.env", "VITE_ANALYZE=false\n")

    const result = checkPackageConfig(root)

    expect(result.ok).toBe(false)
    expect(result.failures).toContain("packages/vue/.env: 缺少 VITE_USE_SOURCE=")
  })
})

describe("checkPackageConfig 内部依赖规则", () => {
  it("dependencies 缺少内部依赖时报错", () => {
    const manifest = readManifest("packages/vue/package.json")

    delete manifest.dependencies
    writeManifest("packages/vue/package.json", manifest)

    const result = checkPackageConfig(root)

    expect(result.ok).toBe(false)
    expect(result.failures).toContain(
      "packages/vue/package.json: dependencies 缺少 @schemx/core"
    )
  })

  it("dependencies 使用非 workspace 协议时报错", () => {
    const manifest = readManifest("packages/vue/package.json")

    writeManifest("packages/vue/package.json", {
      ...manifest,
      dependencies: { ...manifest.dependencies, "@schemx/core": "^1.0.0" },
    })

    const result = checkPackageConfig(root)

    expect(result.ok).toBe(false)
    expect(result.failures).toContain(
      "packages/vue/package.json: dependencies.@schemx/core 必须为 workspace:*"
    )
  })

  it("peerDependencies 重复声明内部依赖时报错", () => {
    const manifest = readManifest("packages/vant/package.json")

    writeManifest("packages/vant/package.json", {
      ...manifest,
      peerDependencies: { ...manifest.peerDependencies, "@schemx/vue": "^1.0.0" },
    })

    const result = checkPackageConfig(root)

    expect(result.ok).toBe(false)
    expect(result.failures).toContain(
      "packages/vant/package.json: peerDependencies 不应声明 @schemx/vue"
    )
  })

  it("devDependencies 重复声明内部依赖时报错", () => {
    const manifest = readManifest("packages/element-plus/package.json")

    writeManifest("packages/element-plus/package.json", {
      ...manifest,
      devDependencies: { "@schemx/core": "workspace:*" },
    })

    const result = checkPackageConfig(root)

    expect(result.ok).toBe(false)
    expect(result.failures).toContain(
      "packages/element-plus/package.json: devDependencies 不应重复声明 @schemx/core"
    )
  })

  it("一个包的多条依赖问题一次性全部报告", () => {
    const manifest = readManifest("packages/vant/package.json")

    writeManifest("packages/vant/package.json", {
      ...manifest,
      dependencies: { "@schemx/vue": "workspace:*" },
    })

    const result = checkPackageConfig(root)

    expect(result.ok).toBe(false)
    expect(result.failures).toContain(
      "packages/vant/package.json: dependencies 缺少 @schemx/core"
    )
  })
})

describe("checkPackageConfig script 规则", () => {
  it("script 内联 VITE_FOO= 时报错", () => {
    const manifest = readManifest("packages/core/package.json")

    writeManifest("packages/core/package.json", {
      ...manifest,
      scripts: { build: "VITE_FOO=bar vp build" },
    })

    const result = checkPackageConfig(root)

    expect(result.ok).toBe(false)
    expect(result.failures).toContain(
      "packages/core/package.json: scripts.build 不应内联 VITE_* 环境变量"
    )
  })

  it("变量出现在赋值之前也命中正则", () => {
    const manifest = readManifest("packages/vue/package.json")

    writeManifest("packages/vue/package.json", {
      ...manifest,
      scripts: { build: "cross-env VITE_USE_SOURCE=false vp build" },
    })

    expect(checkPackageConfig(root).failures).toContain(
      "packages/vue/package.json: scripts.build 不应内联 VITE_* 环境变量"
    )
  })

  it("引用 VITE_ 字样但没有赋值不报错", () => {
    const manifest = readManifest("packages/core/package.json")

    writeManifest("packages/core/package.json", {
      ...manifest,
      scripts: { build: "node scripts/build.mjs --flag vite" },
    })

    expect(checkPackageConfig(root).ok).toBe(true)
  })
})

describe("checkPackageConfig 文件内容规则", () => {
  it(".env 缺少 VITE_ANALYZE= 时报错", () => {
    write("packages/element-plus/.env", "VITE_USE_SOURCE=true\n")

    const result = checkPackageConfig(root)

    expect(result.ok).toBe(false)
    expect(result.failures).toContain("packages/element-plus/.env: 缺少 VITE_ANALYZE=")
  })

  it(".gitignore 出现 packages/vant/.env.standalone 时报错", () => {
    write(".gitignore", "node_modules/\ndist/\n*.tgz\npackages/vant/.env.standalone\n")

    const result = checkPackageConfig(root)

    expect(result.ok).toBe(false)
    expect(result.failures).toContain(
      ".gitignore: 不应包含 standalone 逻辑 packages/vant/.env.standalone"
    )
  })

  it(".env 出现 VITE_BUILD_STANDALONE 时报错", () => {
    write("packages/vant/.env", "VITE_USE_SOURCE=true\nVITE_BUILD_STANDALONE=true\n")

    expect(checkPackageConfig(root).failures).toContain(
      "packages/vant/.env: 不应包含 standalone 逻辑 VITE_BUILD_STANDALONE"
    )
  })

  it("vant 的 script 重新引入 standalone 模式时报错", () => {
    const manifest = readManifest("packages/vant/package.json")

    writeManifest("packages/vant/package.json", {
      ...manifest,
      scripts: { build: "vp build", "normalize-vant-dts": "dts --mode standalone" },
    })

    const result = checkPackageConfig(root)

    expect(result.ok).toBe(false)
    expect(result.failures).toContain(
      "packages/vant/package.json: 不应包含 standalone 逻辑 --mode standalone"
    )
  })

  it("文件缺失时报「文件不存在」而不是「缺少」", () => {
    rmSync(path.join(root, "packages/core/.env"))

    expect(checkPackageConfig(root).failures).toContain("packages/core/.env: 文件不存在")
  })
})

describe("checkPackageConfig manifest 缺失时的行为", () => {
  it("缺失的 package.json 单独报告", () => {
    rmSync(path.join(root, "packages/core/package.json"))

    const result = checkPackageConfig(root)

    expect(result.ok).toBe(false)
    expect(result.failures).toContain(
      "packages/core/package.json: 文件不存在或不是有效 JSON"
    )
  })

  it("一个 package.json 缺失时，其余包的依赖规则仍然逐条检查", () => {
    rmSync(path.join(root, "packages/vant/package.json"))
    const vue = readManifest("packages/vue/package.json")

    writeManifest("packages/vue/package.json", {
      ...vue,
      dependencies: { classnames: "^2.5.1" },
      devDependencies: { "@schemx/core": "workspace:*" },
    })

    const result = checkPackageConfig(root)

    expect(result.ok).toBe(false)
    expect(result.failures).toContain(
      "packages/vant/package.json: 文件不存在或不是有效 JSON"
    )
    expect(result.failures).toContain(
      "packages/vue/package.json: dependencies 缺少 @schemx/core"
    )
    expect(result.failures).toContain(
      "packages/vue/package.json: devDependencies 不应重复声明 @schemx/core"
    )
    // 缺失的包自身的规则被跳过，其余包不被牵连。
    expect(result.failures).not.toContain(
      "packages/vant/package.json: dependencies 缺少 @schemx/core"
    )
  })

  it("JSON 非法的 package.json 同样按缺失处理，且不影响其他包", () => {
    write("packages/element-plus/package.json", "{ not json")
    const vant = readManifest("packages/vant/package.json")

    writeManifest("packages/vant/package.json", {
      ...vant,
      dependencies: { ...vant.dependencies, "@schemx/core": "1.0.0" },
    })

    const result = checkPackageConfig(root)

    expect(result.ok).toBe(false)
    expect(result.failures).toContain(
      "packages/element-plus/package.json: 文件不存在或不是有效 JSON"
    )
    expect(result.failures).toContain(
      "packages/vant/package.json: dependencies.@schemx/core 必须为 workspace:*"
    )
  })
})
