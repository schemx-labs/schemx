/**
 * 本地 tarball 打包的行为测试。
 *
 * @remarks 覆盖内容与对应约束：
 * - 依赖闭包从 package.json 的 `workspace:` 声明推导。原实现把依赖图硬编码成
 *   「vue/vant/element-plus 依赖 core」等三条 `if`，新增任何内部依赖都必须改脚本；
 *   这里额外放一个历史实现完全不知道的 `packages/validator`（由 vant 依赖）来锁住该行为。
 * - 闭包顺序必须是被依赖者在前（`orderByDependencies`），否则 `pnpm pack` 解析
 *   `workspace:*` 时拿不到刚打好的产物。`validator` 的目录名排在 `vue` 之前，
 *   因此这条断言无法被「字典序恰好正确」蒙混过去。
 * - 目标标识同时接受 `scope/directory`、目录名与 npm 包名；未知或不可打包的目标抛用法错误。
 * - 可打包判定：workspace 包一律可打包，插件目录必须提供 `pack:local` script。
 * - 打包期间闭包内所有包统一追加同一个 `-dev.<时间戳>` 版本，供 `workspace:*` 解析。
 * - 回归：备份必须逐包独立。闭包内所有 manifest 都叫 `package.json`，一旦备份文件名
 *   退化成 basename，恢复时会把同一个文件写回全部 manifest，仓库里的包名与版本会被冲掉。
 *
 * `resolveRequested` 与 `expandClosure` 是模块内私有函数，因此这里只断言 `packLocal`
 * 的可观测行为：用假 Ui 捕获它依次渲染的任务标题，得到闭包成员与顺序。
 * 假 Ui 的 `task` 故意不执行回调，因此不会真的 fork pnpm。
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { Catalog } from "../core/catalog.ts"
import { WorkflowError } from "../core/errors.ts"
import { type PackageManifest, readManifestSafe } from "../core/package-json.ts"
import { type TaskOptions, type Ui } from "../ui/ui.ts"

import { packLocal, type PackResult, renderPackResult } from "./local-pack.ts"

/** 打包前的基线 manifest，用于断言恢复结果。 */
const BASELINE: Readonly<
  Record<string, { readonly name: string; readonly version: string }>
> = {
  "@schemx/core": { name: "@schemx/core", version: "1.0.0" },
  "@schemx/vue": { name: "@schemx/vue", version: "1.1.0" },
  "@schemx/validator": { name: "@schemx/validator", version: "0.3.0" },
  "@schemx/vant": { name: "@schemx/vant", version: "1.2.0" },
  "@schemx/plugin-with-script": { name: "@schemx/plugin-with-script", version: "2.0.0" },
  "@schemx/plugin-no-script": { name: "@schemx/plugin-no-script", version: "2.1.0" },
}

/** 一次假 Ui 运行期间收集到的可观测数据。 */
interface Recorder {
  readonly ui: Ui
  /** 依次渲染的任务标题。 */
  readonly tasks: string[]
  /** 每次任务执行时各包 manifest 的 version 快照。 */
  readonly versions: Map<string, string>
  /** 需要返回非 0 退出码的任务标题。 */
  readonly failing: Set<string>
}

let root = ""

let outputDir = ""

let catalog: Catalog

let manifestByName: Map<string, string>

let recorder: Recorder

/**
 * 构造只实现 `task` 的假 Ui。
 *
 * @remarks `task` 只记录标题与当前版本，不执行回调，因此不会 fork pnpm；
 * 但实现仍会因为返回非 0 而抛出「构建/打包失败」，失败路径同样可被覆盖。
 */
function createRecorder(): Recorder {
  const tasks: string[] = []

  const versions = new Map<string, string>()

  const failing = new Set<string>()

  const ui = {
    task: async (options: TaskOptions): Promise<number> => {
      tasks.push(options.title)
      const key = options.itemKey

      if (key !== undefined) {
        const manifestPath = manifestByName.get(key)

        if (manifestPath !== undefined) {
          versions.set(key, readManifestSafe(manifestPath)?.version ?? "")
        }
      }

      return failing.has(options.title) ? 1 : 0
    },
    groupEnd: (): void => {},
    summary: (): void => {},
  } as unknown as Ui

  return { ui, tasks, versions, failing }
}

/**
 * 写一个包。
 *
 * @param relativeDir - 相对仓库根的目录。
 * @param manifest - 清单内容。
 */
function writePackage(relativeDir: string, manifest: unknown): void {
  const dir = path.join(root, relativeDir)

  mkdirSync(dir, { recursive: true })
  writeFileSync(path.join(dir, "package.json"), `${JSON.stringify(manifest, null, 2)}\n`)
}

/**
 * 读回某个包当前的 manifest。
 *
 * @param name - npm 包名。
 * @returns 解析后的清单。
 */
function readBack(name: string): PackageManifest {
  return readManifestSafe(manifestByName.get(name) ?? "") ?? {}
}

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), "local-pack-"))
  outputDir = path.join(root, ".packs")

  // core 无内部依赖；vue 依赖 core；vant 依赖 vue + core + validator。
  // validator 是新增的内部依赖，历史硬编码实现无法覆盖这条边。
  writePackage("packages/core", { ...BASELINE["@schemx/core"] })
  writePackage("packages/vue", {
    ...BASELINE["@schemx/vue"],
    dependencies: { "@schemx/core": "workspace:*" },
  })
  writePackage("packages/validator", { ...BASELINE["@schemx/validator"] })
  writePackage("packages/vant", {
    ...BASELINE["@schemx/vant"],
    dependencies: {
      "@schemx/core": "workspace:*",
      "@schemx/vue": "workspace:*",
      "@schemx/validator": "workspace:*",
    },
  })
  writePackage("plugins/with-script", {
    ...BASELINE["@schemx/plugin-with-script"],
    scripts: { "pack:local": "node scripts/pack.mjs" },
  })
  writePackage("plugins/no-script", { ...BASELINE["@schemx/plugin-no-script"] })

  catalog = new Catalog(root)
  manifestByName = new Map(
    catalog
      .discover(["packages", "plugins"])
      .map((item) => [item.name, item.manifestPath])
  )
  recorder = createRecorder()
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe("packLocal 依赖闭包推导", () => {
  it("从 package.json 的 workspace: 依赖推导闭包，并按被依赖者在前排序", async () => {
    await packLocal({ root, catalog, ui: recorder.ui, targets: "vant", outputDir })

    expect(recorder.tasks).toEqual([
      "构建 @schemx/core",
      "打包 @schemx/core",
      "构建 @schemx/validator",
      "打包 @schemx/validator",
      "构建 @schemx/vue",
      "打包 @schemx/vue",
      "构建 @schemx/vant",
      "打包 @schemx/vant",
    ])
  })

  it("只打包被点名的叶子包时不引入兄弟包", async () => {
    await packLocal({ root, catalog, ui: recorder.ui, targets: "core", outputDir })

    expect(recorder.tasks).toEqual(["构建 @schemx/core", "打包 @schemx/core"])
  })

  it("新增的内部依赖无需改实现即可进入闭包", async () => {
    await packLocal({ root, catalog, ui: recorder.ui, targets: "vant", outputDir })

    expect(recorder.tasks).toContain("构建 @schemx/validator")
    expect(recorder.tasks).not.toContain("构建 @schemx/plugin-with-script")
  })

  it("多个目标去重后只打包一次", async () => {
    await packLocal({
      root,
      catalog,
      ui: recorder.ui,
      targets: "vant,core,@schemx/vue",
      outputDir,
    })

    const builds = recorder.tasks.filter((title) => title.startsWith("构建 "))

    expect(builds).toEqual([
      "构建 @schemx/core",
      "构建 @schemx/validator",
      "构建 @schemx/vue",
      "构建 @schemx/vant",
    ])
  })

  it("闭包内的包在打包期间统一追加同一个 -dev 时间戳版本", async () => {
    await packLocal({ root, catalog, ui: recorder.ui, targets: "vant", outputDir })

    const stamps = new Set<string>()

    for (const version of recorder.versions.values()) {
      expect(version).toMatch(/^.+-dev\.\d{14}$/)
      stamps.add(version.slice(version.indexOf("-dev.")))
    }

    expect([...recorder.versions.keys()].sort()).toEqual([
      "@schemx/core",
      "@schemx/validator",
      "@schemx/vant",
      "@schemx/vue",
    ])
    expect(stamps.size).toBe(1)
  })

  it("all 覆盖全部可打包目标，插件先于 workspace 包处理", async () => {
    await packLocal({ root, catalog, ui: recorder.ui, targets: "all", outputDir })

    expect(recorder.tasks).toEqual([
      "打包 @schemx/plugin-with-script",
      "构建 @schemx/core",
      "打包 @schemx/core",
      "构建 @schemx/validator",
      "打包 @schemx/validator",
      "构建 @schemx/vue",
      "打包 @schemx/vue",
      "构建 @schemx/vant",
      "打包 @schemx/vant",
    ])
  })

  it("空目标串等价于 all", async () => {
    await packLocal({ root, catalog, ui: recorder.ui, targets: "", outputDir })

    expect(recorder.tasks).toHaveLength(9)
  })
})

describe("packLocal 版本备份与恢复", () => {
  it("多包闭包打包结束后每个包各自恢复自己的 manifest", async () => {
    await packLocal({ root, catalog, ui: recorder.ui, targets: "vant", outputDir })

    // 备份文件名若退化成 basename，闭包内全部 manifest 会塌缩成一个备份文件，
    // 恢复时把最后一个包的内容写回所有 manifest。
    expect(readBack("@schemx/core").name).toBe("@schemx/core")
    expect(readBack("@schemx/core").version).toBe("1.0.0")
    expect(readBack("@schemx/validator").name).toBe("@schemx/validator")
    expect(readBack("@schemx/validator").version).toBe("0.3.0")
    expect(readBack("@schemx/vue").name).toBe("@schemx/vue")
    expect(readBack("@schemx/vue").version).toBe("1.1.0")
    expect(readBack("@schemx/vant").name).toBe("@schemx/vant")
    expect(readBack("@schemx/vant").version).toBe("1.2.0")
  })

  it("恢复的是各包自己的完整清单，而不是最后一个包的副本", async () => {
    await packLocal({ root, catalog, ui: recorder.ui, targets: "vant", outputDir })

    // 每个包的 dependencies 各不相同，若备份互相覆盖，这里必然出现串包。
    expect(readBack("@schemx/core").dependencies).toBeUndefined()
    expect(readBack("@schemx/validator").dependencies).toBeUndefined()
    expect(readBack("@schemx/vue").dependencies).toEqual({
      "@schemx/core": "workspace:*",
    })
    expect(readBack("@schemx/vant").dependencies).toEqual({
      "@schemx/core": "workspace:*",
      "@schemx/vue": "workspace:*",
      "@schemx/validator": "workspace:*",
    })
  })

  it("单包闭包同样恢复原版本", async () => {
    await packLocal({ root, catalog, ui: recorder.ui, targets: "core", outputDir })

    expect(readBack("@schemx/core").version).toBe("1.0.0")
    expect(readBack("@schemx/core").name).toBe("@schemx/core")
  })

  it("未进入闭包的包不被改写", async () => {
    await packLocal({ root, catalog, ui: recorder.ui, targets: "core", outputDir })

    expect(readBack("@schemx/vant").version).toBe("1.2.0")
    expect(readBack("@schemx/vue").version).toBe("1.1.0")
  })

  it("构建失败后仍然恢复全部 manifest", async () => {
    recorder.failing.add("构建 @schemx/vue")

    await packLocal({ root, catalog, ui: recorder.ui, targets: "vant", outputDir }).catch(
      (): void => {}
    )

    for (const [name, expected] of Object.entries(BASELINE)) {
      const restored = readBack(name)

      expect({ name: restored.name, version: restored.version }).toEqual({
        name,
        version: expected.version,
      })
    }
  })
})

describe("packLocal 目标解析", () => {
  it("未知目标抛用法错误", async () => {
    await expect(
      packLocal({ root, catalog, ui: recorder.ui, targets: "nope", outputDir })
    ).rejects.toThrow(/存在未知或不可打包的目标：nope/)
  })

  it("未知目标携带用法退出码", async () => {
    const error = await packLocal({
      root,
      catalog,
      ui: recorder.ui,
      targets: "packages/nope",
      outputDir,
    }).catch((reason: unknown) => reason)

    expect(error).toBeInstanceOf(WorkflowError)
    expect((error as WorkflowError).exitCode).toBe(2)
  })

  it("多目标中任意一个未知即整体失败", async () => {
    await expect(
      packLocal({ root, catalog, ui: recorder.ui, targets: "core,nope", outputDir })
    ).rejects.toThrow(/存在未知或不可打包的目标：nope/)
  })

  it("三个标识符都能命中同一个包", async () => {
    for (const identifier of ["packages/core", "core", "@schemx/core"]) {
      const current = createRecorder()

      await packLocal({ root, catalog, ui: current.ui, targets: identifier, outputDir })
      expect(current.tasks).toEqual(["构建 @schemx/core", "打包 @schemx/core"])
    }
  })
})

describe("packLocal 插件可打包判定", () => {
  it("定义了 pack:local 的插件目录可打包", async () => {
    await packLocal({
      root,
      catalog,
      ui: recorder.ui,
      targets: "plugins/with-script",
      outputDir,
    })

    expect(recorder.tasks).toEqual(["打包 @schemx/plugin-with-script"])
  })

  it("没有 pack:local 的插件目录不可打包", async () => {
    await expect(
      packLocal({
        root,
        catalog,
        ui: recorder.ui,
        targets: "plugins/no-script",
        outputDir,
      })
    ).rejects.toThrow(/存在未知或不可打包的目标：plugins\/no-script/)
  })

  it("all 不会包含没有 pack:local 的插件", async () => {
    await packLocal({ root, catalog, ui: recorder.ui, targets: "all", outputDir })

    expect(recorder.tasks).toContain("打包 @schemx/plugin-with-script")
    expect(recorder.tasks).not.toContain("打包 @schemx/plugin-no-script")
  })

  it("只请求插件时不改写任何 workspace 包的版本", async () => {
    await packLocal({
      root,
      catalog,
      ui: recorder.ui,
      targets: "plugins/with-script",
      outputDir,
    })

    expect(readBack("@schemx/core").version).toBe("1.0.0")
    expect(readBack("@schemx/vant").version).toBe("1.2.0")
    expect([...recorder.versions.keys()]).toEqual(["@schemx/plugin-with-script"])
  })

  it("插件与 workspace 包混合请求时两类产物都进 tarballs", async () => {
    const result = await packLocal({
      root,
      catalog,
      ui: recorder.ui,
      targets: "plugins/with-script,core",
      outputDir,
    })

    // 假 Ui 不执行回调，因此 tarball 路径为空；这里只断言产物数量与归属。
    expect(result.tarballs).toHaveLength(2)
    expect(result.directory).toBe(outputDir)
  })
})

describe("packLocal 失败传播", () => {
  it("构建失败时抛出带包名的错误", async () => {
    recorder.failing.add("构建 @schemx/vue")

    await expect(
      packLocal({ root, catalog, ui: recorder.ui, targets: "vant", outputDir })
    ).rejects.toThrow("构建 @schemx/vue 失败。")
  })

  it("打包失败时抛出带包名的错误", async () => {
    recorder.failing.add("打包 @schemx/vant")

    await expect(
      packLocal({ root, catalog, ui: recorder.ui, targets: "vant", outputDir })
    ).rejects.toThrow("打包 @schemx/vant 失败。")
  })

  it("失败后不再构建依赖链上更靠后的包", async () => {
    recorder.failing.add("构建 @schemx/vue")

    await packLocal({ root, catalog, ui: recorder.ui, targets: "vant", outputDir }).catch(
      (): void => {}
    )

    expect(recorder.tasks).toContain("构建 @schemx/validator")
    expect(recorder.tasks).not.toContain("构建 @schemx/vant")
  })
})

describe("renderPackResult", () => {
  it("渲染 tarball 安装命令摘要", () => {
    const calls: unknown[] = []

    const ui = {
      summary: (options: unknown): void => {
        calls.push(options)
      },
    } as unknown as Ui

    const result: PackResult = {
      directory: "/tmp/out",
      tarballs: ["/tmp/out/a.tgz", "/tmp/out/b.tgz"],
    }

    renderPackResult(ui, result)

    expect(calls).toEqual([
      {
        title: "全部 tarball 安装命令",
        tone: "success",
        content: "已生成 2 个 tarball。\n产物目录：/tmp/out",
        copy: 'pnpm i "/tmp/out/a.tgz" "/tmp/out/b.tgz"',
      },
    ])
  })

  it("没有 tarball 时仍渲染摘要，数量为 0", () => {
    const calls: unknown[] = []

    const ui = {
      summary: (options: unknown): void => void calls.push(options),
    } as unknown as Ui

    renderPackResult(ui, { directory: "/tmp/out", tarballs: [] })

    expect(calls).toHaveLength(1)
    expect(JSON.stringify(calls[0])).toContain("已生成 0 个 tarball。")
  })
})
