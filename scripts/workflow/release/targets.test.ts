/**
 * 发布目标解析测试。
 *
 * @remarks 覆盖内容与设计约束：
 * - `resolveTargets` 必须按 workspace 内部依赖做拓扑排序，被依赖的包先发布。原实现直接按
 *   目录名排序推送，`vant` 会在 `vue` 之前发布，导致发布后的包缺少可解析的依赖版本。
 * - 未知目标、重复目标、空串都要以用法错误终止，而不是静默发布一个子集。
 * - 标识符查找与交互选择器共享同一份 publishable 口径，private 包永远不是合法目标。
 * - 精确匹配：目录名互为前缀时不能误命中。
 *
 * 排序细节：orderByDependencies 逐轮推进，无依赖项在第一轮就产出，因此 plugins/ui 会排在
 * packages/vant 之前。这是当前实现的确切行为，依赖约束 core < vue < vant 仍然成立。
 *
 * 另一个确切行为：`dependencyVersion` 走 `catalog.find`，而 `find` 接受 relativeDir /
 * directory / npm 包名三种标识，因此传目录名 `vue` 也能取到版本；只有既不是三种标识之一、
 * 又不可发布的名字才返回空串。
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { Catalog } from "../core/catalog.ts"

import {
  dependencyVersion,
  findTarget,
  groupedOptions,
  isKnownTarget,
  resolveTargets,
} from "./targets.ts"

let root = ""

let catalog: Catalog

/**
 * 写入一个包的 package.json。
 */
function writePackage(relativeDir: string, manifest: unknown): void {
  const dir = path.join(root, relativeDir)

  mkdirSync(dir, { recursive: true })
  writeFileSync(path.join(dir, "package.json"), JSON.stringify(manifest, null, 2))
}

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), "targets-"))
  writePackage("packages/core", { name: "@schemx/core", version: "1.0.0" })
  writePackage("packages/vue", {
    name: "@schemx/vue",
    version: "1.0.0",
    dependencies: { "@schemx/core": "workspace:*" },
  })
  writePackage("packages/vant", {
    name: "@schemx/vant",
    version: "1.0.0",
    dependencies: { "@schemx/vue": "workspace:*" },
  })
  writePackage("plugins/ui", { name: "@schemx/ui", version: "1.0.0" })
  catalog = new Catalog(root)
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe("resolveTargets", () => {
  it("all 返回全部可发布目标，满足依赖约束 core < vue < vant", () => {
    // 逐轮推进：packages 目录名序为 core、vant、vue，plugins 的 ui 排最后。
    // 第 1 轮 core 产出后同轮内 vue 立即解除阻塞并产出，ui 无依赖也产出；vant 仍被 vue 阻塞。
    // 第 2 轮 vant 产出。因此 plugins/ui 会排在 packages/vant 之前，依赖约束仍成立。
    expect(resolveTargets(catalog, "all")).toEqual(["core", "vue", "ui", "vant"])
  })

  it("all 保证被依赖的包排在依赖它的包之前", () => {
    const resolved = resolveTargets(catalog, "all")

    expect(resolved.indexOf("core")).toBeLessThan(resolved.indexOf("vue"))
    expect(resolved.indexOf("vue")).toBeLessThan(resolved.indexOf("vant"))
  })

  it("逗号分隔多选也按拓扑排序，而不是按输入顺序或目录名顺序", () => {
    // chosen 按发现顺序（packages 的 core、vant，再 plugins 的 ui）排列，
    // 拓扑排序只在依赖被阻塞时重排，因此 vant 仍在 core 之后、ui 之前。
    expect(resolveTargets(catalog, "vant,core")).toEqual(["core", "vant"])
    expect(resolveTargets(catalog, "vant,core,ui")).toEqual(["core", "vant", "ui"])
  })

  it("单个目标原样返回", () => {
    expect(resolveTargets(catalog, "vue")).toEqual(["vue"])
    expect(resolveTargets(catalog, "vant")).toEqual(["vant"])
  })

  it("忽略尾随逗号产生的空片段", () => {
    expect(resolveTargets(catalog, "core,")).toEqual(["core"])
  })

  it("未知目标抛用法错误", () => {
    expect(() => resolveTargets(catalog, "nope")).toThrow(/无效发布目标/)
    expect(() => resolveTargets(catalog, "core,nope")).toThrow(/无效发布目标/)
  })

  it("重复目标抛用法错误", () => {
    expect(() => resolveTargets(catalog, "core,core")).toThrow(/无效发布目标/)
  })

  it("空串与只有分隔符都抛用法错误", () => {
    expect(() => resolveTargets(catalog, "")).toThrow(/发布目标不能为空/)
    expect(() => resolveTargets(catalog, ",")).toThrow(/发布目标不能为空/)
  })

  it("private 包不是合法目标，也不进入 all 结果", () => {
    writePackage("packages/secret", {
      name: "@schemx/secret",
      version: "1.0.0",
      private: true,
    })

    const fresh = new Catalog(root)

    expect(() => resolveTargets(fresh, "secret")).toThrow(/无效发布目标/)
    expect(resolveTargets(fresh, "all")).not.toContain("secret")
  })

  it("未被选中的包不会因为间接依赖被拉进来", () => {
    // vant 依赖 vue，但只选 vant 时不应自动补上 vue。
    expect(resolveTargets(catalog, "vant")).toEqual(["vant"])
  })

  it("npm 包名能通过校验但选不中目录，属于已知限制", () => {
    expect(() => resolveTargets(catalog, "@schemx/core")).not.toThrow()
    expect(resolveTargets(catalog, "@schemx/core")).toEqual([])
  })
})

describe("findTarget 与 isKnownTarget", () => {
  it("三种标识符都能命中", () => {
    expect(findTarget(catalog, "packages/core")?.name).toBe("@schemx/core")
    expect(findTarget(catalog, "core")?.name).toBe("@schemx/core")
    expect(findTarget(catalog, "@schemx/core")?.name).toBe("@schemx/core")
  })

  it("未知标识符返回 undefined 与 false", () => {
    expect(findTarget(catalog, "xcore")).toBeUndefined()
    expect(isKnownTarget(catalog, "xcore")).toBe(false)
  })

  it("已知标识符返回 true", () => {
    expect(isKnownTarget(catalog, "core")).toBe(true)
    expect(isKnownTarget(catalog, "packages/vant")).toBe(true)
    expect(isKnownTarget(catalog, "@schemx/ui")).toBe(true)
  })

  it("private 包不是已知目标", () => {
    writePackage("packages/secret", {
      name: "@schemx/secret",
      version: "1.0.0",
      private: true,
    })

    const fresh = new Catalog(root)

    expect(isKnownTarget(fresh, "secret")).toBe(false)
    expect(findTarget(fresh, "@schemx/secret")).toBeUndefined()
  })

  it("目录名互为前缀时只做精确匹配", () => {
    writePackage("packages/xcore", { name: "@schemx/xcore", version: "1.0.0" })

    const fresh = new Catalog(root)

    expect(findTarget(fresh, "core")?.name).toBe("@schemx/core")
    expect(findTarget(fresh, "xcore")?.name).toBe("@schemx/xcore")
    expect(isKnownTarget(fresh, "corex")).toBe(false)
  })
})

describe("groupedOptions", () => {
  it("按 packages、plugins 分组并跳过空分组", () => {
    expect(groupedOptions(catalog)).toEqual([
      {
        group: "Packages",
        options: [
          { value: "core", label: "@schemx/core · packages/core" },
          { value: "vant", label: "@schemx/vant · packages/vant" },
          { value: "vue", label: "@schemx/vue · packages/vue" },
        ],
      },
      {
        group: "Plugins",
        options: [{ value: "ui", label: "@schemx/ui · plugins/ui" }],
      },
    ])
  })

  it("没有插件时只返回 Packages 分组", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "targets-noplugin-"))

    try {
      mkdirSync(path.join(dir, "packages", "core"), { recursive: true })
      writeFileSync(
        path.join(dir, "packages", "core", "package.json"),
        JSON.stringify({ name: "@schemx/core", version: "1.0.0" })
      )

      const groups = groupedOptions(new Catalog(dir))

      expect(groups).toHaveLength(1)
      expect(groups[0]?.group).toBe("Packages")
      expect(groups[0]?.options).toEqual([
        { value: "core", label: "@schemx/core · packages/core" },
      ])
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it("空 workspace 返回空分组列表", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "targets-empty-"))

    try {
      expect(groupedOptions(new Catalog(dir))).toEqual([])
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it("private 包不出现在分组选项里", () => {
    writePackage("packages/secret", {
      name: "@schemx/secret",
      version: "1.0.0",
      private: true,
    })

    const values = groupedOptions(new Catalog(root)).flatMap((group) =>
      group.options.map((option) => option.value)
    )

    expect(values).not.toContain("secret")
  })
})

describe("dependencyVersion", () => {
  it("按 npm 包名返回 workspace 内部依赖的当前版本", () => {
    expect(dependencyVersion("@schemx/core", catalog)).toBe("1.0.0")
  })

  it("目录名与 relativeDir 也能命中，因为 find 接受三种标识符", () => {
    expect(dependencyVersion("vue", catalog)).toBe("1.0.0")
    expect(dependencyVersion("packages/vue", catalog)).toBe("1.0.0")
  })

  it("不存在于 workspace 的名字返回空串", () => {
    expect(dependencyVersion("@schemx/missing", catalog)).toBe("")
    expect(dependencyVersion("xcore", catalog)).toBe("")
    expect(dependencyVersion("react", catalog)).toBe("")
  })

  it("目录名互为前缀时不误命中", () => {
    expect(dependencyVersion("xcore", catalog)).toBe("")
  })

  it("private 包的版本不会泄露给发布流程", () => {
    writePackage("packages/secret", {
      name: "@schemx/secret",
      version: "9.9.9",
      private: true,
    })

    expect(dependencyVersion("@schemx/secret", new Catalog(root))).toBe("")
  })
})
