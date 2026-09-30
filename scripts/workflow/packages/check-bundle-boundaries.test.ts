/**
 * 构建产物边界检查的规则测试。
 *
 * @remarks 覆盖内容与对应约束：
 * - JS 产物必须以裸依赖形式保留 externals，且不得泄漏被禁止的 externals，
 *   否则构建配置失效（该 external 会被打进包里）或把本该外部依赖的实现重复打包；
 * - externals 的子路径（如 `es-toolkit/compat`、`@schemx/core/dist`）同时满足父级目标；
 * - 只有 `import ... from`、`import(...)` 与 `require(...)` 三种写法被识别为引用；
 * - 产物文件缺失时报 `${file}: 文件不存在`，而不是静默跳过（缺产物时原实现会误判为通过）；
 * - 类型声明与样式产物按子串断言：必须出现指定 token，且不得出现内部源码相对路径
 *   （`../../vue/src`、`../../core/src`）或 UI 库专属标识（`vant`、`--van-`、`--el-`）。
 *
 * 文案与实现保持逐字一致：JS 规则用「缺少 / 泄漏」，声明与样式规则统一用
 * 「类型声明缺少 / 类型声明泄漏」。
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { checkBundleBoundaries } from "./check-bundle-boundaries.ts"

let root = ""

/**
 * 写一个产物文件，父目录自动创建。
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
 * 用 ESM import 语句渲染一个产物。
 *
 * @param specifiers - 裸依赖列表。
 * @returns 产物源码。
 */
function esm(...specifiers: readonly string[]): string {
  return [
    ...specifiers.map((name, index) => `import dep${index} from '${name}'`),
    "export { dep0 }",
    "",
  ].join("\n")
}

/**
 * 用 CommonJS require 渲染一个产物。
 *
 * @param specifiers - 裸依赖列表。
 * @returns 产物源码。
 */
function cjs(...specifiers: readonly string[]): string {
  return `${specifiers.map((name) => `require('${name}')`).join("\n")}\nmodule.exports = {}\n`
}

/**
 * 写出一套全部合规的产物，作为逐条破坏规则的基线。
 */
function writeCompliantArtifacts(): void {
  write(
    "packages/core/dist/index.mjs",
    esm("async-validator", "es-toolkit", "es-toolkit/compat", "@preact/signals-core")
  )
  write(
    "packages/core/dist/index.cjs",
    cjs("async-validator", "es-toolkit", "es-toolkit/compat", "@preact/signals-core")
  )

  write("packages/vue/dist/index.mjs", esm("@schemx/core", "classnames", "es-toolkit"))
  write("packages/vue/dist/index.cjs", cjs("@schemx/core", "classnames", "es-toolkit"))

  write(
    "packages/vant/dist/index.mjs",
    esm("@schemx/vue", "classnames", "dayjs", "es-toolkit")
  )
  write(
    "packages/vant/dist/index.cjs",
    cjs("@schemx/vue", "classnames", "dayjs", "es-toolkit")
  )

  write(
    "packages/element-plus/dist/index.mjs",
    esm("@schemx/vue", "element-plus", "@element-plus/icons-vue", "dayjs")
  )
  write(
    "packages/element-plus/dist/index.cjs",
    cjs("@schemx/vue", "element-plus", "@element-plus/icons-vue", "dayjs")
  )

  write("packages/vant/dist/index.d.ts", "export { SchemxForm } from '@schemx/vue'\n")
  write(
    "packages/vant/dist/types/schemx.d.ts",
    [
      "import type { SchemxForm } from '@schemx/vue'",
      "import type { FormSchema } from '@schemx/core'",
      "",
    ].join("\n")
  )
  write(
    "packages/element-plus/dist/index.d.ts",
    "export { SchemxForm } from '@schemx/vue'\n"
  )
  write(
    "packages/element-plus/dist/types/schemx.d.ts",
    [
      "import type { SchemxForm } from '@schemx/vue'",
      "import type { FormSchema } from '@schemx/core'",
      "import type { ElButton } from 'element-plus'",
      "",
    ].join("\n")
  )

  write(
    "packages/vue/dist/style.css",
    ".schemx-row { display: flex; }\n.schemx-field { display: block; }\n"
  )
  write(
    "packages/vant/dist/style.css",
    ":root { --van-primary-color: #1989fa; }\n.schemx-field-wrapper--first { margin-top: 0; }\n"
  )
  write(
    "packages/element-plus/dist/style.css",
    ":root { --el-color-primary: #409eff; }\n.schemx-group-wrapper { display: block; }\n"
  )
}

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), "check-bundle-boundaries-"))
  writeCompliantArtifacts()
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe("checkBundleBoundaries 合规基线", () => {
  it("全部产物合规时返回 ok", () => {
    expect(checkBundleBoundaries(root)).toEqual({ ok: true, failures: [] })
  })

  it("只导入子路径也算引用了父级 externals", () => {
    write(
      "packages/vue/dist/index.mjs",
      "import core from '@schemx/core/dist'\nimport cn from 'classnames'\n"
    )

    expect(checkBundleBoundaries(root).failures).toEqual([
      "packages/vue/dist/index.mjs: 缺少 es-toolkit",
    ])
  })

  it("副作用 import 不算引用", () => {
    write(
      "packages/vue/dist/index.mjs",
      ["import '@schemx/core'", "import 'classnames'", "import 'es-toolkit'", ""].join(
        "\n"
      )
    )

    expect(checkBundleBoundaries(root).failures).toEqual([
      "packages/vue/dist/index.mjs: 缺少 @schemx/core",
      "packages/vue/dist/index.mjs: 缺少 classnames",
      "packages/vue/dist/index.mjs: 缺少 es-toolkit",
    ])
  })

  it("动态 import 计入 externals 引用", () => {
    write(
      "packages/vue/dist/index.mjs",
      [
        "const core = await import('@schemx/core')",
        "const cn = await import('classnames')",
        "",
      ].join("\n")
    )

    expect(checkBundleBoundaries(root).failures).toEqual([
      "packages/vue/dist/index.mjs: 缺少 es-toolkit",
    ])
  })
})

describe("checkBundleBoundaries JS 产物规则", () => {
  it("缺少 required externals 时报告「缺少」", () => {
    write("packages/vant/dist/index.mjs", esm("@schemx/vue", "classnames", "dayjs"))

    const result = checkBundleBoundaries(root)

    expect(result.ok).toBe(false)
    expect(result.failures).toContain("packages/vant/dist/index.mjs: 缺少 es-toolkit")
  })

  it("cjs 产物同样参与 externals 断言", () => {
    write(
      "packages/core/dist/index.cjs",
      cjs("es-toolkit", "es-toolkit/compat", "@preact/signals-core")
    )

    const result = checkBundleBoundaries(root)

    expect(result.ok).toBe(false)
    expect(result.failures).toContain(
      "packages/core/dist/index.cjs: 缺少 async-validator"
    )
  })

  it("出现 forbidden externals 时报告「泄漏」", () => {
    write(
      "packages/vue/dist/index.mjs",
      esm("@schemx/core", "classnames", "es-toolkit", "simple-async-context")
    )

    const result = checkBundleBoundaries(root)

    expect(result.ok).toBe(false)
    expect(result.failures).toContain(
      "packages/vue/dist/index.mjs: 泄漏 simple-async-context"
    )
  })

  it("子路径也判定为对父级 externals 的泄漏", () => {
    write(
      "packages/element-plus/dist/index.mjs",
      esm(
        "@schemx/vue",
        "element-plus",
        "@element-plus/icons-vue",
        "dayjs",
        "vant/lib/util"
      )
    )

    expect(checkBundleBoundaries(root).failures).toContain(
      "packages/element-plus/dist/index.mjs: 泄漏 vant"
    )
  })

  it("core 产物泄漏 @schemx/validator 时报错", () => {
    write(
      "packages/core/dist/index.mjs",
      esm(
        "async-validator",
        "es-toolkit",
        "es-toolkit/compat",
        "@preact/signals-core",
        "@schemx/validator"
      )
    )

    expect(checkBundleBoundaries(root).failures).toContain(
      "packages/core/dist/index.mjs: 泄漏 @schemx/validator"
    )
  })

  it("产物文件缺失时报告「文件不存在」且不重复报告「缺少」", () => {
    rmSync(path.join(root, "packages/vant/dist/index.mjs"))

    const result = checkBundleBoundaries(root)

    expect(result.ok).toBe(false)
    expect(result.failures).toContain("packages/vant/dist/index.mjs: 文件不存在")
    expect(result.failures).not.toContain(
      "packages/vant/dist/index.mjs: 缺少 @schemx/vue"
    )
  })

  it("同一条规则缺多个 externals 时逐条报告", () => {
    write("packages/vant/dist/index.mjs", esm("@schemx/vue"))

    expect(checkBundleBoundaries(root).failures).toEqual([
      "packages/vant/dist/index.mjs: 缺少 classnames",
      "packages/vant/dist/index.mjs: 缺少 dayjs",
      "packages/vant/dist/index.mjs: 缺少 es-toolkit",
    ])
  })
})

describe("checkBundleBoundaries 类型声明与样式规则", () => {
  it("类型声明缺少 token 时报告「类型声明缺少」", () => {
    write(
      "packages/element-plus/dist/types/schemx.d.ts",
      "import type { S } from '@schemx/vue'\n"
    )

    expect(checkBundleBoundaries(root).failures).toContain(
      "packages/element-plus/dist/types/schemx.d.ts: 类型声明缺少 @schemx/core"
    )
  })

  it("类型声明泄漏内部源码相对路径时报「类型声明泄漏」", () => {
    write("packages/vant/dist/index.d.ts", "export * from '../../vue/src/index'\n")

    const result = checkBundleBoundaries(root)

    expect(result.ok).toBe(false)
    expect(result.failures).toContain(
      "packages/vant/dist/index.d.ts: 类型声明泄漏 ../../vue/src"
    )
  })

  it("element-plus 类型声明出现 vant 时报错", () => {
    write(
      "packages/element-plus/dist/index.d.ts",
      "export * from '@schemx/vue'\ndeclare const v: vant\n"
    )

    expect(checkBundleBoundaries(root).failures).toContain(
      "packages/element-plus/dist/index.d.ts: 类型声明泄漏 vant"
    )
  })

  it("样式产物缺少 token 时同样走「类型声明缺少」文案", () => {
    write("packages/vue/dist/style.css", ".schemx-row { display: flex; }\n")

    expect(checkBundleBoundaries(root).failures).toContain(
      "packages/vue/dist/style.css: 类型声明缺少 .schemx-field"
    )
  })

  it("样式产物混入另一套 UI 变量时报「类型声明泄漏」", () => {
    write(
      "packages/vant/dist/style.css",
      [
        ":root { --van-primary-color: #1989fa; --el-color-primary: #409eff; }",
        ".schemx-field-wrapper--first { margin-top: 0; }",
        "",
      ].join("\n")
    )

    const result = checkBundleBoundaries(root)

    expect(result.ok).toBe(false)
    expect(result.failures).toContain("packages/vant/dist/style.css: 类型声明泄漏 --el-")
  })

  it("样式产物文件缺失时报「文件不存在」", () => {
    rmSync(path.join(root, "packages/element-plus/dist/style.css"))

    expect(checkBundleBoundaries(root).failures).toContain(
      "packages/element-plus/dist/style.css: 文件不存在"
    )
  })
})
