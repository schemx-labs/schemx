/**
 * 目标发现与选择测试。
 *
 * @remarks 覆盖内容与设计约束：
 * - `parseBatchArguments` 是所有 workspace 有限任务共用的参数入口。历史实现直接用 `$1`
 *   取 target，参数错位时会静默执行错误目标，因此未知 `-` 开头选项和多个位置参数必须报错。
 * - `--keep-going` 出现在任何位置都生效；`-h`、`--help`、`help` 三种写法都识别为帮助请求。
 * - `discoverTaskTargets` 的任务→script 映射保证 `build` 任务不会漏掉只定义了 `build:h5`
 *   的包；一个包只取第一个命中的 script，避免同一次任务把包跑两遍。
 * - `selectTaskTargets` 的过滤必须精确匹配 `relativeDir` / `directory` / npm 包名，
 *   目录名互为前缀时不能误命中（原 shell 实现用 `case $x in *core*` 匹配导致误选）。
 *
 * 测试只走 `ui.interactive === false` 的非交互路径，因此用结构化字面量伪造 Ui 实例，
 * 实际只依赖 `interactive` 与 `env` 两个成员。
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test"

import { dispatch } from "../../workflow.ts"
import { runWorkspaceTask } from "../commands/workspace.ts"
import { Catalog } from "../core/catalog.ts"

import {
  discoverTaskTargets,
  parseBatchArguments,
  selectTaskTargets,
  taskLabel,
} from "./target-selection.ts"

import type { TaskOptions, Ui } from "./ui.ts"
import type { RunResult } from "../core/exec.ts"

let root = ""

let catalog: Catalog

/**
 * 非交互环境的假 Ui。只用到 `interactive` 与 `env`。
 */
const nonInteractiveUi = { interactive: false, env: {} } as unknown as Ui

/**
 * 写入一个包的 package.json。
 */
function writePackage(relativeDir: string, manifest: unknown): void {
  const dir = path.join(root, relativeDir)

  mkdirSync(dir, { recursive: true })
  writeFileSync(path.join(dir, "package.json"), JSON.stringify(manifest, null, 2))
}

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), "target-selection-"))
  writePackage("packages/core", {
    name: "@schemx/core",
    version: "1.0.0",
    scripts: { build: "tsc -b", dev: "vite", check: "eslint ." },
  })
  writePackage("packages/vant", {
    name: "@schemx/vant",
    version: "1.0.0",
    scripts: { "build:h5": "vite build --h5", "dev:h5": "vite --h5" },
  })
  writePackage("packages/docs", {
    name: "@schemx/docs",
    version: "1.0.0",
    scripts: { build: "vite build", preview: "vite preview" },
  })
  catalog = new Catalog(root)
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe("parseBatchArguments", () => {
  it("无参数时返回空目标与默认开关", () => {
    expect(parseBatchArguments([])).toEqual({ target: "", keepGoing: false, help: false })
  })

  it("解析单个位置参数为 target", () => {
    expect(parseBatchArguments(["core"])).toEqual({
      target: "core",
      keepGoing: false,
      help: false,
    })
  })

  it("解析 --keep-going", () => {
    expect(parseBatchArguments(["--keep-going"])).toEqual({
      target: "",
      keepGoing: true,
      help: false,
    })
  })

  it("--keep-going 出现在 target 之前或之后都生效", () => {
    expect(parseBatchArguments(["--keep-going", "core"])).toEqual({
      target: "core",
      keepGoing: true,
      help: false,
    })
    expect(parseBatchArguments(["core", "--keep-going"])).toEqual({
      target: "core",
      keepGoing: true,
      help: false,
    })
  })

  it("-h、--help、help 三种写法都识别为帮助请求", () => {
    for (const flag of ["-h", "--help", "help"]) {
      expect(parseBatchArguments([flag])).toEqual({
        target: "",
        keepGoing: false,
        help: true,
      })
    }
  })

  it("帮助请求可以与 target 共存", () => {
    expect(parseBatchArguments(["core", "--help"])).toEqual({
      target: "core",
      keepGoing: false,
      help: true,
    })
  })

  it("未知短横线选项抛用法错误", () => {
    expect(() => parseBatchArguments(["--verbose"])).toThrow(/未知 workspace 选项/)
    expect(() => parseBatchArguments(["-x"])).toThrow(/未知 workspace 选项/)
    expect(() => parseBatchArguments(["core", "--target", "vue"])).toThrow(
      /未知 workspace 选项/
    )
  })

  it("两个位置参数抛用法错误", () => {
    expect(() => parseBatchArguments(["core", "vue"])).toThrow(/最多接受一个 target/)
  })
})

describe("taskLabel", () => {
  it("返回已知任务的中文名", () => {
    expect(taskLabel("dev")).toBe("启动开发服务")
    expect(taskLabel("build")).toBe("构建")
    expect(taskLabel("build:analyze")).toBe("构建分析")
    expect(taskLabel("check")).toBe("静态检查")
    expect(taskLabel("code-check")).toBe("静态检查")
    expect(taskLabel("type-check")).toBe("类型检查")
    expect(taskLabel("type-check:tests")).toBe("测试代码类型检查")
  })

  it("未知任务回退为“执行 <任务>”", () => {
    expect(taskLabel("nonsense")).toBe("执行 nonsense")
  })
})

describe("discoverTaskTargets", () => {
  it("build 同时接受 build 与 build:h5", () => {
    expect(discoverTaskTargets(catalog, "build")).toEqual([
      {
        scope: "packages",
        directory: "core",
        relativeDir: "packages/core",
        name: "@schemx/core",
        script: "build",
      },
      {
        scope: "packages",
        directory: "docs",
        relativeDir: "packages/docs",
        name: "@schemx/docs",
        script: "build",
      },
      {
        scope: "packages",
        directory: "vant",
        relativeDir: "packages/vant",
        name: "@schemx/vant",
        script: "build:h5",
      },
    ])
  })

  it("dev 同时接受 dev 与 dev:h5", () => {
    expect(discoverTaskTargets(catalog, "dev").map((item) => item.script)).toEqual([
      "dev",
      "dev:h5",
    ])
  })

  it("code-check 映射到 check script", () => {
    expect(
      discoverTaskTargets(catalog, "code-check").map((item) => item.relativeDir)
    ).toEqual(["packages/core"])
  })

  it("其他任务按同名 script 匹配", () => {
    expect(
      discoverTaskTargets(catalog, "preview").map((item) => item.relativeDir)
    ).toEqual(["packages/docs"])
  })

  it("没有包定义该 script 时返回空列表", () => {
    expect(discoverTaskTargets(catalog, "lint")).toEqual([])
  })

  it("同时定义 build 与 build:h5 时取第一个命中的 build", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "target-selection-both-"))

    try {
      mkdirSync(path.join(dir, "packages", "both"), { recursive: true })
      writeFileSync(
        path.join(dir, "packages", "both", "package.json"),
        JSON.stringify({
          name: "@schemx/both",
          version: "1.0.0",
          scripts: { build: "vite build", "build:h5": "vite build --h5" },
        })
      )

      const targets = discoverTaskTargets(new Catalog(dir), "build")

      expect(targets).toHaveLength(1)
      expect(targets[0]?.script).toBe("build")
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it("覆盖全部 scope，含 plugins", () => {
    writePackage("plugins/ui", {
      name: "@schemx/ui",
      version: "1.0.0",
      scripts: { build: "vite build" },
    })

    expect(
      discoverTaskTargets(new Catalog(root), "build").map((item) => item.scope)
    ).toEqual(["packages", "packages", "packages", "plugins"])
  })

  it("private 包同样参与任务发现，任务只看 script 不看可发布性", () => {
    writePackage("packages/secret", {
      name: "@schemx/secret",
      version: "1.0.0",
      private: true,
      scripts: { build: "vite build" },
    })

    expect(
      discoverTaskTargets(new Catalog(root), "build").map((item) => item.directory)
    ).toEqual(["core", "docs", "secret", "vant"])
  })
})

describe("selectTaskTargets", () => {
  it("非交互且无显式目标时返回全部候选", async () => {
    await expect(
      selectTaskTargets(nonInteractiveUi, catalog, "build", "")
    ).resolves.toEqual(discoverTaskTargets(catalog, "build"))
  })

  it("显式 all 返回全部候选", async () => {
    await expect(
      selectTaskTargets(nonInteractiveUi, catalog, "build", "all")
    ).resolves.toEqual(discoverTaskTargets(catalog, "build"))
  })

  it("按 relativeDir 精确匹配", async () => {
    const selected = await selectTaskTargets(
      nonInteractiveUi,
      catalog,
      "build",
      "packages/vant"
    )

    expect(selected.map((item) => item.relativeDir)).toEqual(["packages/vant"])
  })

  it("按 directory 精确匹配", async () => {
    const selected = await selectTaskTargets(nonInteractiveUi, catalog, "build", "vant")

    expect(selected.map((item) => item.directory)).toEqual(["vant"])
  })

  it("按 npm 包名精确匹配", async () => {
    const selected = await selectTaskTargets(
      nonInteractiveUi,
      catalog,
      "build",
      "@schemx/vant"
    )

    expect(selected.map((item) => item.name)).toEqual(["@schemx/vant"])
  })

  it("逗号分隔多选按候选顺序返回", async () => {
    const selected = await selectTaskTargets(
      nonInteractiveUi,
      catalog,
      "build",
      "vant, packages/core"
    )

    expect(selected.map((item) => item.directory)).toEqual(["core", "vant"])
  })

  it("目录名互为前缀时不误命中", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "target-selection-prefix-"))

    try {
      mkdirSync(path.join(dir, "packages", "core"), { recursive: true })
      writeFileSync(
        path.join(dir, "packages", "core", "package.json"),
        JSON.stringify({
          name: "@schemx/core",
          version: "1.0.0",
          scripts: { build: "x" },
        })
      )
      const fresh = new Catalog(dir)

      const selected = await selectTaskTargets(nonInteractiveUi, fresh, "build", "core")

      expect(selected.map((item) => item.relativeDir)).toEqual(["packages/core"])
      expect(selected).toHaveLength(1)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it("已知目标存在互为前缀的目录时只返回精确命中的那个", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "target-selection-prefix2-"))

    try {
      for (const [directory, name] of [
        ["core", "@schemx/core"],
        ["xcore", "@schemx/xcore"],
      ] as const) {
        mkdirSync(path.join(dir, "packages", directory), { recursive: true })
        writeFileSync(
          path.join(dir, "packages", directory, "package.json"),
          JSON.stringify({ name, version: "1.0.0", scripts: { build: "x" } })
        )
      }

      const fresh = new Catalog(dir)

      const selected = await selectTaskTargets(nonInteractiveUi, fresh, "build", "core")

      expect(selected.map((item) => item.directory)).toEqual(["core"])
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it("未知目标报错，不能误报成功", async () => {
    await expect(
      selectTaskTargets(nonInteractiveUi, catalog, "build", "nope")
    ).rejects.toThrow(/目标 nope 不存在或未定义 build script/)
  })

  it("多选中有未知目标时整体报错", async () => {
    await expect(
      selectTaskTargets(nonInteractiveUi, catalog, "build", "core,nope")
    ).rejects.toThrow(/目标 nope/)
  })

  it("显式目标未定义任务 script 时仍报错", async () => {
    await expect(
      selectTaskTargets(nonInteractiveUi, catalog, "lint", "core")
    ).rejects.toThrow(/未定义 lint script/)
  })

  it("没有候选包时返回空列表", async () => {
    await expect(
      selectTaskTargets(nonInteractiveUi, catalog, "lint", "all")
    ).resolves.toEqual([])
  })

  it("single 模式收到多值抛用法错误", async () => {
    await expect(
      selectTaskTargets(nonInteractiveUi, catalog, "build", "core,vant", "single")
    ).rejects.toThrow(/仅支持选择一个目标/)
  })

  it("single 模式单值正常返回", async () => {
    const selected = await selectTaskTargets(
      nonInteractiveUi,
      catalog,
      "build",
      "core",
      "single"
    )

    expect(selected.map((item) => item.directory)).toEqual(["core"])
  })

  it("环境变量可作为目标来源", async () => {
    const envUi = {
      interactive: false,
      env: { SCHEMX_WORKFLOW_TARGETS: "vant" },
    } as unknown as Ui

    const selected = await selectTaskTargets(envUi, catalog, "build", "")

    expect(selected.map((item) => item.directory)).toEqual(["vant"])
  })

  it("命令行目标优先于环境变量", async () => {
    const envUi = {
      interactive: false,
      env: { SCHEMX_WORKFLOW_TARGETS: "vant" },
    } as unknown as Ui

    const selected = await selectTaskTargets(envUi, catalog, "build", "core")

    expect(selected.map((item) => item.directory)).toEqual(["core"])
  })
})

describe("workspace 检查链", () => {
  const success: RunResult = { code: 0, stdout: "", stderr: "", output: "" }

  let exec = vi.fn<Ui["exec"]>()

  let ui: Ui

  beforeEach(() => {
    exec = vi.fn<Ui["exec"]>().mockResolvedValue(success)
    // 只替代终端渲染和外部进程，目标发现与检查链仍走真实实现。
    ui = {
      ...nonInteractiveUi,
      exec,
      async task(_options: TaskOptions, execute: () => Promise<RunResult | void>) {
        return (await execute())?.code ?? 0
      },
      flowBegin: vi.fn(),
      flowEndFromExitCode: vi.fn(),
      groupBegin: vi.fn(),
      groupEnd: vi.fn(),
      taskPending: vi.fn(),
      status: vi.fn(),
      note: vi.fn(),
      columns: undefined,
    } as unknown as Ui
    writePackage("packages/core", {
      name: "@schemx/core",
      version: "1.0.0",
      scripts: {
        build: "vite build",
        lint: "eslint src",
        "lint:fix": "eslint src --fix",
        check: "pnpm lint && pnpm type-check",
        "type-check": "tsc --noEmit",
        "type-check:tests": "tsc -p tsconfig.test.json --noEmit",
        test: "vitest run",
      },
    })
  })

  it.each(["lint", "lint:fix", "check", "code-check"])(
    "%s 委托包脚本执行统一检查，工作流不重复叠加 Oxc",
    async (task) => {
      const code = await runWorkspaceTask({ root, catalog, ui, env: {} }, task, ["core"])

      expect(code).toBe(0)
      expect(exec).toHaveBeenCalledTimes(1)
      expect(exec).toHaveBeenCalledWith(
        "pnpm",
        ["--dir", "packages/core", "run", task === "code-check" ? "check" : task],
        { cwd: root }
      )
    }
  )

  it("包检查 warning 保留 0 退出码", async () => {
    exec.mockResolvedValueOnce({
      ...success,
      stdout: "src/store.ts:888:29: warning unicorn(no-useless-spread): array",
      output: "src/store.ts:888:29: warning unicorn(no-useless-spread): array",
    })
    await expect(
      runWorkspaceTask({ root, catalog, ui, env: {} }, "code-check", ["core"])
    ).resolves.toBe(0)
    expect(exec).toHaveBeenCalledTimes(1)
  })

  it("包检查失败保留退出码", async () => {
    exec.mockResolvedValueOnce({
      ...success,
      code: 2,
      output: "src/a.ts:1:1: error rule",
    })
    await expect(
      runWorkspaceTask({ root, catalog, ui, env: {} }, "check", ["core"])
    ).resolves.toBe(2)
    expect(exec).toHaveBeenCalledTimes(1)
  })

  it("静态检查失败不会被工作流覆盖", async () => {
    exec.mockResolvedValueOnce({ ...success, code: 1 })
    await expect(
      runWorkspaceTask({ root, catalog, ui, env: {} }, "check", ["core"])
    ).resolves.toBe(1)
    expect(exec).toHaveBeenCalledTimes(1)
  })

  it.each(["build", "type-check"])("%s 保留原有检查链", async (task) => {
    await expect(
      runWorkspaceTask({ root, catalog, ui, env: {} }, task, ["core"])
    ).resolves.toBe(0)
    expect(exec).toHaveBeenCalledTimes(1)
    expect(exec).toHaveBeenCalledWith("pnpm", ["--dir", "packages/core", "run", task], {
      cwd: root,
    })
  })

  it.each(["type-check", "test"])("%s 先检查指定包，再执行项目脚本自检", async (task) => {
    await expect(dispatch({ root, catalog, ui, env: {} }, [task, "core"])).resolves.toBe(
      0
    )
    expect(exec).toHaveBeenCalledTimes(2)
    expect(exec).toHaveBeenNthCalledWith(
      1,
      "pnpm",
      ["--dir", "packages/core", "run", task],
      { cwd: root }
    )
    expect(exec).toHaveBeenNthCalledWith(
      2,
      "pnpm",
      task === "type-check"
        ? ["exec", "tsc", "-p", "scripts/tsconfig.json", "--noEmit"]
        : ["exec", "vitest", "run", "scripts"],
      { cwd: root }
    )
  })

  it.each([
    "type-check",
    "test",
    "type-check:scripts",
    "test:scripts",
    "pack-local",
    "check:packages",
  ])("%s --help 只显示帮助，不执行检查或打包", async (task) => {
    await expect(
      dispatch({ root, catalog, ui, env: {} }, [task, "--help"])
    ).resolves.toBe(0)
    expect(exec).not.toHaveBeenCalled()
    expect(ui.note).toHaveBeenCalled()
  })

  it.each(["type-check", "test"])("%s 失败后不继续项目脚本自检", async (task) => {
    exec.mockResolvedValueOnce({ ...success, code: 1 })
    await expect(dispatch({ root, catalog, ui, env: {} }, [task, "core"])).resolves.toBe(
      1
    )
    expect(exec).toHaveBeenCalledTimes(1)
  })

  it("code-check 与 check 使用相同的静态检查入口", async () => {
    await expect(
      dispatch({ root, catalog, ui, env: {} }, ["code-check", "core"])
    ).resolves.toBe(0)
    expect(exec).toHaveBeenCalledWith(
      "pnpm",
      ["--dir", "packages/core", "run", "check"],
      { cwd: root }
    )
  })

  it("release:test 兼容别名运行项目脚本测试", async () => {
    await expect(
      dispatch({ root, catalog, ui, env: {} }, ["release:test"])
    ).resolves.toBe(0)
    expect(exec).toHaveBeenCalledWith("pnpm", ["exec", "vitest", "run", "scripts"], {
      cwd: root,
    })
  })

  it.each(["type-check:scripts", "test:scripts", "check:packages"])(
    "%s 拒绝被忽略的额外目标",
    async (task) => {
      await expect(
        dispatch({ root, catalog, ui, env: {} }, [task, "core"])
      ).rejects.toThrow(/不接受目标或额外参数/)
      expect(exec).not.toHaveBeenCalled()
    }
  )
})
