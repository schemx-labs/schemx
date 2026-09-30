/**
 * Catalog 与 orderByDependencies 的行为测试。
 *
 * @remarks 覆盖内容与设计约束：
 * - scope 顺序与目录名排序必须稳定。原实现每次 `find | sort` 重新扫描，混合多个 scope 时
 *   结果顺序会漂移，导致交互选择列表在不同机器上不一致。
 * - 缺失 scope、scope 路径不是目录、package.json 非法或缺失都必须降级为空数组，
 *   而不是让整条工作流中断（原 shell 实现会在 `set -e` 下直接失败）。
 * - 可发布性过滤同时要求非 private、有 name、有 version。
 * - 标识符查找同时接受 `scope/directory`、目录名与 npm 包名，且必须精确匹配，
 *   目录名互为前缀时不能误命中。
 * - 拓扑排序要求：被依赖的包排在前面；同一层保持输入顺序；环依赖不丢元素。
 *
 * 排序细节：orderByDependencies 逐轮推进，无依赖项在第一轮就产出，因此"层级"只约束
 * 依赖关系本身，不保证无依赖包全部排在有依赖包之前。
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

import { afterEach, beforeEach, describe, expect, it } from "vitest"

import {
  Catalog,
  orderByDependencies,
  scopeLabel,
  type WorkspacePackage,
} from "./catalog.ts"
import { type PackageManifest } from "./package-json.ts"

let root = ""

/**
 * 写入一个包的 package.json。
 */
function writePackage(relativeDir: string, manifest: unknown): void {
  const dir = path.join(root, relativeDir)

  mkdirSync(dir, { recursive: true })
  writeFileSync(
    path.join(dir, "package.json"),
    typeof manifest === "string" ? manifest : JSON.stringify(manifest, null, 2)
  )
}

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), "catalog-"))
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

/**
 * 构造一个不落盘的 WorkspacePackage，用于单独验证拓扑排序。
 */
function fakePackage(
  name: string,
  dependencies: readonly string[] = []
): WorkspacePackage {
  const manifest: PackageManifest = {
    name,
    version: "1.0.0",
    ...(dependencies.length > 0
      ? {
          dependencies: Object.fromEntries(
            dependencies.map((item) => [item, "workspace:*"])
          ),
        }
      : {}),
  }

  const directory = name.replace(/^@[^/]+\//, "")

  return {
    scope: "packages",
    directory,
    relativeDir: `packages/${directory}`,
    name,
    manifestPath: path.join(root, "packages", directory, "package.json"),
    manifest,
  }
}

/**
 * 取内部 workspace 依赖名，与发布流程使用的判定保持一致。
 */
function dependenciesOf(item: WorkspacePackage): readonly string[] {
  return Object.keys(item.manifest.dependencies ?? {}).filter((name) =>
    String(item.manifest.dependencies?.[name]).startsWith("workspace:")
  )
}

describe("scopeLabel", () => {
  it("已知 scope 返回显示名", () => {
    expect(scopeLabel("packages")).toBe("Packages")
    expect(scopeLabel("plugins")).toBe("Plugins")
    expect(scopeLabel("examples")).toBe("Examples")
  })

  it("未知 scope 原样返回", () => {
    expect(scopeLabel("whatever")).toBe("whatever")
  })
})

describe("Catalog.discover", () => {
  it("按传入的 scope 顺序返回结果，且目录名升序稳定", () => {
    writePackage("packages/vue", { name: "@schemx/vue", version: "1.0.0" })
    writePackage("packages/core", { name: "@schemx/core", version: "1.0.0" })
    writePackage("plugins/plugin-b", { name: "@schemx/plugin-b", version: "1.0.0" })
    writePackage("plugins/plugin-a", { name: "@schemx/plugin-a", version: "1.0.0" })

    const catalog = new Catalog(root)

    expect(catalog.discover().map((item) => item.relativeDir)).toEqual([
      "packages/core",
      "packages/vue",
      "plugins/plugin-a",
      "plugins/plugin-b",
    ])
    expect(catalog.discover(["plugins", "packages"]).map((item) => item.scope)).toEqual([
      "plugins",
      "plugins",
      "packages",
      "packages",
    ])
  })

  it("默认 scope 顺序为 packages、plugins、examples", () => {
    writePackage("examples/demo", { name: "@schemx/demo", version: "1.0.0" })
    writePackage("plugins/ui", { name: "@schemx/ui", version: "1.0.0" })
    writePackage("packages/core", { name: "@schemx/core", version: "1.0.0" })

    const catalog = new Catalog(root)

    expect(catalog.discover().map((item) => item.scope)).toEqual([
      "packages",
      "plugins",
      "examples",
    ])
  })

  it("返回的包携带已解析的 manifest 与绝对 manifestPath", () => {
    writePackage("packages/core", {
      name: "@schemx/core",
      version: "2.1.0",
      scripts: { build: "tsc -b" },
    })

    const catalog = new Catalog(root)

    const first = catalog.discover()[0]

    expect(first?.manifest).toEqual({
      name: "@schemx/core",
      version: "2.1.0",
      scripts: { build: "tsc -b" },
    })
    expect(first?.manifestPath).toBe(path.join(root, "packages", "core", "package.json"))
    expect(first?.relativeDir).toBe("packages/core")
    expect(first?.directory).toBe("core")
    expect(first?.scope).toBe("packages")
  })

  it("缺失的 scope 返回空数组", () => {
    writePackage("packages/core", { name: "@schemx/core", version: "1.0.0" })

    const catalog = new Catalog(root)

    expect(catalog.discover(["plugins"])).toEqual([])
    expect(catalog.discover(["examples"])).toEqual([])
  })

  it("readdir 失败（scope 路径存在但不是目录）时返回空数组", () => {
    mkdirSync(root, { recursive: true })
    writeFileSync(path.join(root, "examples"), "not a directory")

    const catalog = new Catalog(root)

    expect(catalog.discover(["examples"])).toEqual([])
  })

  it("空 workspace 返回空数组", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "catalog-empty-"))

    try {
      expect(new Catalog(dir).discover()).toEqual([])
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it("跳过没有 name、package.json 非法以及没有 package.json 的目录", () => {
    writePackage("packages/core", { name: "@schemx/core", version: "1.0.0" })
    writePackage("packages/nameless", { version: "1.0.0" })
    writePackage("packages/broken", "{ not json")
    mkdirSync(path.join(root, "packages", "empty"), { recursive: true })

    const catalog = new Catalog(root)

    expect(catalog.discover().map((item) => item.directory)).toEqual(["core"])
  })

  it("忽略 scope 下的普通文件", () => {
    writePackage("packages/core", { name: "@schemx/core", version: "1.0.0" })
    writeFileSync(path.join(root, "packages", "README.md"), "# hi")

    const catalog = new Catalog(root)

    expect(catalog.discover().map((item) => item.directory)).toEqual(["core"])
  })

  it("重复调用 discover 命中实例缓存，结果一致", () => {
    writePackage("packages/core", { name: "@schemx/core", version: "1.0.0" })

    const catalog = new Catalog(root)

    const first = catalog.discover()

    const second = catalog.discover()

    expect(second).toEqual(first)
    expect(second[0]).toBe(first[0])
  })
})

describe("Catalog.publishable", () => {
  it("过滤 private、缺少 name 与缺少 version 的包", () => {
    writePackage("packages/core", { name: "@schemx/core", version: "1.0.0" })
    writePackage("packages/secret", {
      name: "@schemx/secret",
      version: "1.0.0",
      private: true,
    })
    writePackage("packages/unversioned", { name: "@schemx/unversioned" })
    writePackage("packages/nameless", { version: "1.0.0" })

    const catalog = new Catalog(root)

    expect(catalog.publishable().map((item) => item.directory)).toEqual(["core"])
  })

  it("只扫描 packages 与 plugins，忽略 examples", () => {
    writePackage("packages/core", { name: "@schemx/core", version: "1.0.0" })
    writePackage("plugins/ui", { name: "@schemx/ui", version: "1.0.0" })
    writePackage("examples/demo", { name: "@schemx/demo", version: "1.0.0" })

    const catalog = new Catalog(root)

    expect(catalog.publishable().map((item) => item.relativeDir)).toEqual([
      "packages/core",
      "plugins/ui",
    ])
  })
})

describe("Catalog.find", () => {
  it("支持 relativeDir、directory 与 npm 包名三种标识符", () => {
    writePackage("packages/core", { name: "@schemx/core", version: "1.0.0" })

    const catalog = new Catalog(root)

    expect(catalog.find("packages/core")?.name).toBe("@schemx/core")
    expect(catalog.find("core")?.name).toBe("@schemx/core")
    expect(catalog.find("@schemx/core")?.name).toBe("@schemx/core")
  })

  it("未知标识符返回 undefined", () => {
    writePackage("packages/core", { name: "@schemx/core", version: "1.0.0" })

    const catalog = new Catalog(root)

    expect(catalog.find("xcore")).toBeUndefined()
    expect(catalog.find("packages/xcore")).toBeUndefined()
    expect(catalog.find("@schemx/xcore")).toBeUndefined()
  })

  it("只查询可发布包，private 包无法被找到", () => {
    writePackage("packages/core", { name: "@schemx/core", version: "1.0.0" })
    writePackage("packages/secret", {
      name: "@schemx/secret",
      version: "1.0.0",
      private: true,
    })

    const catalog = new Catalog(root)

    expect(catalog.find("secret")).toBeUndefined()
  })

  it("目录名互为前缀时只做精确匹配", () => {
    writePackage("packages/core", { name: "@schemx/core", version: "1.0.0" })
    writePackage("packages/xcore", { name: "@schemx/xcore", version: "1.0.0" })

    const catalog = new Catalog(root)

    expect(catalog.find("core")?.name).toBe("@schemx/core")
    expect(catalog.find("xcore")?.name).toBe("@schemx/xcore")
    expect(catalog.find("corex")).toBeUndefined()
  })

  it("可以在自定义候选集里查找", () => {
    writePackage("packages/core", { name: "@schemx/core", version: "1.0.0" })
    writePackage("plugins/ui", { name: "@schemx/ui", version: "1.0.0" })

    const catalog = new Catalog(root)

    expect(catalog.find("ui", [])).toBeUndefined()
    expect(catalog.find("ui", catalog.discover())?.name).toBe("@schemx/ui")
  })
})

describe("Catalog.withScript", () => {
  it("只保留满足判定函数的包", () => {
    writePackage("packages/core", {
      name: "@schemx/core",
      version: "1.0.0",
      scripts: { build: "x" },
    })
    writePackage("packages/vue", {
      name: "@schemx/vue",
      version: "1.0.0",
      scripts: { "build:h5": "x" },
    })
    writePackage("packages/ui", {
      name: "@schemx/ui",
      version: "1.0.0",
      scripts: { dev: "x" },
    })

    const catalog = new Catalog(root)

    const all = catalog.discover()

    expect(
      Catalog.withScript(
        all,
        (manifest) => manifest.scripts?.["build"] !== undefined
      ).map((item) => item.directory)
    ).toEqual(["core"])
    expect(
      Catalog.withScript(
        all,
        (manifest) =>
          manifest.scripts?.["build"] !== undefined ||
          manifest.scripts?.["build:h5"] !== undefined
      ).map((item) => item.directory)
    ).toEqual(["core", "vue"])
  })

  it("没有包满足时返回空数组", () => {
    writePackage("packages/core", { name: "@schemx/core", version: "1.0.0" })

    const catalog = new Catalog(root)

    expect(Catalog.withScript(catalog.discover(), () => false)).toEqual([])
  })
})

describe("orderByDependencies", () => {
  it("空输入返回空数组", () => {
    expect(orderByDependencies([], dependenciesOf)).toEqual([])
  })

  it("被依赖的包排在前面", () => {
    const ordered = orderByDependencies(
      [
        fakePackage("@schemx/vant", ["@schemx/vue"]),
        fakePackage("@schemx/vue", ["@schemx/core"]),
        fakePackage("@schemx/core"),
      ],
      dependenciesOf
    )

    expect(ordered.map((item) => item.directory)).toEqual(["core", "vue", "vant"])
  })

  it("输入顺序与目录名顺序不同时仍满足依赖约束", () => {
    const ordered = orderByDependencies(
      [
        fakePackage("@schemx/vant", ["@schemx/vue"]),
        fakePackage("@schemx/core"),
        fakePackage("@schemx/vue", ["@schemx/core"]),
      ],
      dependenciesOf
    )

    expect(ordered.map((item) => item.directory)).toEqual(["core", "vue", "vant"])
  })

  it("同一层保持输入顺序", () => {
    const ordered = orderByDependencies(
      [
        fakePackage("@schemx/d", ["@schemx/b", "@schemx/c"]),
        fakePackage("@schemx/c", ["@schemx/a"]),
        fakePackage("@schemx/b", ["@schemx/a"]),
        fakePackage("@schemx/a"),
      ],
      dependenciesOf
    )

    expect(ordered.map((item) => item.directory)).toEqual(["a", "c", "b", "d"])
  })

  it("逐轮推进：同轮内先被解除阻塞的包立即产出，不保证全部排在有依赖项之前", () => {
    // 第 1 轮：vant 被 vue 阻塞；core 产出后同轮内 vue 立即解除阻塞；ui 无依赖直接产出。
    // 第 2 轮：vant 产出。因此 plugins/ui 会排在 packages/vant 之前。
    const ordered = orderByDependencies(
      [
        fakePackage("@schemx/vant", ["@schemx/vue"]),
        fakePackage("@schemx/core"),
        fakePackage("@schemx/vue", ["@schemx/core"]),
        fakePackage("@schemx/ui"),
      ],
      dependenciesOf
    )

    expect(ordered.map((item) => item.directory)).toEqual(["core", "vue", "ui", "vant"])
  })

  it("依赖不在集合内时视为已满足", () => {
    const ordered = orderByDependencies(
      [fakePackage("@schemx/vant", ["@schemx/external"]), fakePackage("@schemx/core")],
      dependenciesOf
    )

    expect(ordered.map((item) => item.directory)).toEqual(["vant", "core"])
  })

  it("非 workspace 协议依赖不参与排序", () => {
    const ordered = orderByDependencies(
      [
        {
          ...fakePackage("@schemx/vant"),
          manifest: {
            name: "@schemx/vant",
            version: "1.0.0",
            dependencies: { "@schemx/core": "1.0.0" },
          },
        },
        fakePackage("@schemx/core"),
      ],
      dependenciesOf
    )

    expect(ordered.map((item) => item.directory)).toEqual(["vant", "core"])
  })

  it("环依赖按输入顺序兜底，不丢元素", () => {
    const ordered = orderByDependencies(
      [fakePackage("@schemx/a", ["@schemx/b"]), fakePackage("@schemx/b", ["@schemx/a"])],
      dependenciesOf
    )

    expect(ordered.map((item) => item.directory)).toEqual(["a", "b"])
  })

  it("环依赖与正常节点混合时仍返回全部元素", () => {
    const ordered = orderByDependencies(
      [
        fakePackage("@schemx/x", ["@schemx/y"]),
        fakePackage("@schemx/y", ["@schemx/x"]),
        fakePackage("@schemx/app", ["@schemx/x"]),
      ],
      dependenciesOf
    )

    expect(ordered.map((item) => item.directory).sort()).toEqual(["app", "x", "y"])
    expect(ordered).toHaveLength(3)
  })

  it("自依赖不会导致死循环", () => {
    const ordered = orderByDependencies(
      [fakePackage("@schemx/a", ["@schemx/a"])],
      dependenciesOf
    )

    expect(ordered.map((item) => item.directory)).toEqual(["a"])
  })

  it("无依赖时保持输入顺序", () => {
    const ordered = orderByDependencies(
      [fakePackage("@schemx/z"), fakePackage("@schemx/a"), fakePackage("@schemx/m")],
      dependenciesOf
    )

    expect(ordered.map((item) => item.directory)).toEqual(["z", "a", "m"])
  })

  it("不修改传入的数组", () => {
    const input = [
      fakePackage("@schemx/vant", ["@schemx/core"]),
      fakePackage("@schemx/core"),
    ]

    orderByDependencies(input, dependenciesOf)

    expect(input.map((item) => item.directory)).toEqual(["vant", "core"])
  })
})
