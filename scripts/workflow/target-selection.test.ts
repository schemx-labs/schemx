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
 * 测试只走 `terminal.isInteractive === false` 的非交互路径，终端实例只提供交互能力，业务环境变量通过参数显式传递。
 */
import { execFileSync } from "node:child_process"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { Writable } from "node:stream"

import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test"

import { dispatch } from "../workflow.ts"

import { runFix } from "./commands/fix.ts"
import { runWorkspaceTask } from "./commands/workspace.ts"
import { Catalog } from "./core/catalog.ts"
import {
  discoverTaskTargets,
  parseBatchArguments,
  selectTaskTargets,
  taskLabel,
} from "./target-selection.ts"
import { createTerminal } from "./ui/index.ts"

import type { RunOptions, RunResult } from "./core/exec.ts"
import type { Terminal } from "./ui/index.ts"

let root = ""

let catalog: Catalog

/**
 * 非交互选择只读取终端的 isInteractive。
 */
// 测试替身只执行回调，具体反馈行为由终端测试验证。
const runTask: Terminal["runTask"] = async ({ execute }) => await execute()

const nonInteractiveTerminal = { isInteractive: false, runTask } as Terminal

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
  execFileSync("git", ["init", "-q", root])
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
  it("无参数时返回空目标与默认开关", async () => {
    expect(parseBatchArguments([])).toEqual({ target: "", keepGoing: false, help: false })
  })

  it("解析单个位置参数为 target", async () => {
    expect(parseBatchArguments(["core"])).toEqual({
      target: "core",
      keepGoing: false,
      help: false,
    })
  })

  it("解析 --keep-going", async () => {
    expect(parseBatchArguments(["--keep-going"])).toEqual({
      target: "",
      keepGoing: true,
      help: false,
    })
  })

  it("--keep-going 出现在 target 之前或之后都生效", async () => {
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

  it("-h、--help、help 三种写法都识别为帮助请求", async () => {
    for (const flag of ["-h", "--help", "help"]) {
      expect(parseBatchArguments([flag])).toEqual({
        target: "",
        keepGoing: false,
        help: true,
      })
    }
  })

  it("帮助请求可以与 target 共存", async () => {
    expect(parseBatchArguments(["core", "--help"])).toEqual({
      target: "core",
      keepGoing: false,
      help: true,
    })
  })

  it("未知短横线选项抛用法错误", async () => {
    expect(() => parseBatchArguments(["--verbose"])).toThrow(/未知 workspace 选项/)
    expect(() => parseBatchArguments(["-x"])).toThrow(/未知 workspace 选项/)
    expect(() => parseBatchArguments(["core", "--target", "vue"])).toThrow(
      /未知 workspace 选项/
    )
  })

  it("两个位置参数抛用法错误", async () => {
    expect(() => parseBatchArguments(["core", "vue"])).toThrow(/最多接受一个 target/)
  })
})

describe("taskLabel", () => {
  it("返回已知任务的中文名", async () => {
    expect(taskLabel("dev")).toBe("启动开发服务")
    expect(taskLabel("build")).toBe("构建")
    expect(taskLabel("build:analyze")).toBe("构建分析")
    expect(taskLabel("check")).toBe("静态检查")
    expect(taskLabel("type-check")).toBe("类型检查")
    expect(taskLabel("type-check:tests")).toBe("测试代码类型检查")
  })

  it("未知任务回退为“执行 <任务>”", async () => {
    expect(taskLabel("nonsense")).toBe("执行 nonsense")
  })
})

describe("discoverTaskTargets", () => {
  it("build 同时接受 build 与 build:h5", async () => {
    expect(await discoverTaskTargets(catalog, "build")).toEqual([
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

  it("dev 同时接受 dev 与 dev:h5", async () => {
    expect(
      (await discoverTaskTargets(catalog, "dev")).map((item) => item.script)
    ).toEqual(["dev", "dev:h5"])
  })

  it("check 按实际目录发现目标，无需声明 check script", async () => {
    expect(
      (await discoverTaskTargets(catalog, "check")).map((item) => item.relativeDir)
    ).toEqual(["packages/core", "packages/docs", "packages/vant"])
  })

  it("其他任务按同名 script 匹配", async () => {
    expect(
      (await discoverTaskTargets(catalog, "preview")).map((item) => item.relativeDir)
    ).toEqual(["packages/docs"])
  })

  it("没有代码文件时 lint 返回空列表", async () => {
    expect(await discoverTaskTargets(catalog, "lint")).toEqual([])
  })

  it("自动包含脚本、新目录、根目录和包内 src 以外的代码，忽略未跟踪的输出", async () => {
    writeFileSync(path.join(root, ".gitignore"), "generated/\n")
    for (const file of [
      "scripts/workflow.ts",
      "tools/new-task.mjs",
      "index.ts",
      "packages/core/vite.plugins.ts",
      "examples/demo/src/App.vue",
      "generated/output.ts",
      ".hidden/tool.ts",
    ]) {
      mkdirSync(path.dirname(path.join(root, file)), { recursive: true })
      writeFileSync(path.join(root, file), "export const value = 1\n")
    }

    expect(
      (await discoverTaskTargets(catalog, "lint")).map((item) => item.relativeDir)
    ).toEqual([".", "examples", "packages/core", "scripts", "tools"])
    expect(
      (await selectTaskTargets(nonInteractiveTerminal, catalog, "lint", "scripts"))[0]
        ?.files
    ).toEqual(["scripts/workflow.ts"])
    expect(
      (await selectTaskTargets(nonInteractiveTerminal, catalog, "lint", "."))[0]?.files
    ).toEqual(["index.ts"])
  })

  it("任意层级的新包都会自动成为目标，删除的文件不会传给工具", async () => {
    writePackage("custom/group/new-lib", { name: "@custom/new-lib" })
    writeFileSync(path.join(root, "custom/group/new-lib/task.ts"), "export {}\n")
    writeFileSync(path.join(root, "removed.ts"), "export {}\n")
    execFileSync("git", ["add", "removed.ts"], { cwd: root })
    rmSync(path.join(root, "removed.ts"))

    expect(await discoverTaskTargets(catalog, "lint")).toEqual([
      {
        scope: "custom",
        directory: "new-lib",
        relativeDir: "custom/group/new-lib",
        name: "@custom/new-lib",
        script: "lint",
        files: ["custom/group/new-lib/task.ts"],
      },
    ])
  })

  it("格式化目标不依赖 format script，也支持仅有样式文件的目录", async () => {
    mkdirSync(path.join(root, "styles"))
    writeFileSync(path.join(root, "styles/theme.scss"), "$color: red;\n")
    expect(
      (await discoverTaskTargets(catalog, "format")).map((item) => item.relativeDir)
    ).toEqual(["packages/core", "packages/docs", "packages/vant", "styles"])
  })

  it("自动发现的目录会显示在交互选择中", async () => {
    mkdirSync(path.join(root, "tools"))
    writeFileSync(path.join(root, "tools/task.ts"), "export {}\n")
    const groupMultiselect = vi.fn().mockResolvedValue(["tools"])

    const interactive = {
      isInteractive: true,
      runTask,
      groupMultiselect,
    } as unknown as Terminal

    await selectTaskTargets(interactive, catalog, "lint", "")
    expect(groupMultiselect.mock.calls[0]?.[0].groups).toEqual([
      { title: "tools", options: [{ value: "tools", label: "tools" }] },
    ])
  })

  it("同时定义 build 与 build:h5 时取第一个命中的 build", async () => {
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

      const targets = await discoverTaskTargets(new Catalog(dir), "build")

      expect(targets).toHaveLength(1)
      expect(targets[0]?.script).toBe("build")
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it("覆盖全部 scope，含 plugins", async () => {
    writePackage("plugins/ui", {
      name: "@schemx/ui",
      version: "1.0.0",
      scripts: { build: "vite build" },
    })

    expect(
      (await discoverTaskTargets(new Catalog(root), "build")).map((item) => item.scope)
    ).toEqual(["packages", "packages", "packages", "plugins"])
  })

  it("private 包同样参与任务发现，任务只看 script 不看可发布性", async () => {
    writePackage("packages/secret", {
      name: "@schemx/secret",
      version: "1.0.0",
      private: true,
      scripts: { build: "vite build" },
    })

    expect(
      (await discoverTaskTargets(new Catalog(root), "build")).map(
        (item) => item.directory
      )
    ).toEqual(["core", "docs", "secret", "vant"])
  })
})

describe("selectTaskTargets", () => {
  it("非交互且无显式目标时返回全部候选", async () => {
    await expect(
      selectTaskTargets(nonInteractiveTerminal, catalog, "build", "")
    ).resolves.toEqual(await discoverTaskTargets(catalog, "build"))
  })

  it("显式 all 返回全部候选", async () => {
    await expect(
      selectTaskTargets(nonInteractiveTerminal, catalog, "build", "all")
    ).resolves.toEqual(await discoverTaskTargets(catalog, "build"))
  })

  it("按 relativeDir 精确匹配", async () => {
    const selected = await selectTaskTargets(
      nonInteractiveTerminal,
      catalog,
      "build",
      "packages/vant"
    )

    expect(selected.map((item) => item.relativeDir)).toEqual(["packages/vant"])
  })

  it("按 directory 精确匹配", async () => {
    const selected = await selectTaskTargets(
      nonInteractiveTerminal,
      catalog,
      "build",
      "vant"
    )

    expect(selected.map((item) => item.directory)).toEqual(["vant"])
  })

  it("按 npm 包名精确匹配", async () => {
    const selected = await selectTaskTargets(
      nonInteractiveTerminal,
      catalog,
      "build",
      "@schemx/vant"
    )

    expect(selected.map((item) => item.name)).toEqual(["@schemx/vant"])
  })

  it("逗号分隔多选按候选顺序返回", async () => {
    const selected = await selectTaskTargets(
      nonInteractiveTerminal,
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

      const selected = await selectTaskTargets(
        nonInteractiveTerminal,
        fresh,
        "build",
        "core"
      )

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

      const selected = await selectTaskTargets(
        nonInteractiveTerminal,
        fresh,
        "build",
        "core"
      )

      expect(selected.map((item) => item.directory)).toEqual(["core"])
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it("未知目标报错，不能误报成功", async () => {
    await expect(
      selectTaskTargets(nonInteractiveTerminal, catalog, "build", "nope")
    ).rejects.toThrow(/目标 nope 不存在/)
  })

  it("多选中有未知目标时整体报错", async () => {
    await expect(
      selectTaskTargets(nonInteractiveTerminal, catalog, "build", "core,nope")
    ).rejects.toThrow(/目标 nope/)
  })

  it("显式目标未定义任务 script 时仍报错", async () => {
    await expect(
      selectTaskTargets(nonInteractiveTerminal, catalog, "lint", "core")
    ).rejects.toThrow(/未定义 lint script/)
  })

  it("没有候选包时返回空列表", async () => {
    await expect(
      selectTaskTargets(nonInteractiveTerminal, catalog, "lint", "all")
    ).resolves.toEqual([])
  })

  it("single 模式收到多值抛用法错误", async () => {
    await expect(
      selectTaskTargets(nonInteractiveTerminal, catalog, "build", "core,vant", "single")
    ).rejects.toThrow(/仅支持选择一个目标/)
  })

  it("single 模式单值正常返回", async () => {
    const selected = await selectTaskTargets(
      nonInteractiveTerminal,
      catalog,
      "build",
      "core",
      "single"
    )

    expect(selected.map((item) => item.directory)).toEqual(["core"])
  })

  it("环境变量可作为目标来源", async () => {
    const envTerminal = {
      isInteractive: false,
      runTask,
      env: { SCHEMX_WORKFLOW_TARGETS: "vant" },
    } as unknown as Terminal

    const selected = await selectTaskTargets(envTerminal, catalog, "build", "", "multi", {
      SCHEMX_WORKFLOW_TARGETS: "vant",
    })

    expect(selected.map((item) => item.directory)).toEqual(["vant"])
  })

  it("命令行目标优先于环境变量", async () => {
    const envTerminal = {
      isInteractive: false,
      runTask,
      env: { SCHEMX_WORKFLOW_TARGETS: "vant" },
    } as unknown as Terminal

    const selected = await selectTaskTargets(
      envTerminal,
      catalog,
      "build",
      "core",
      "multi",
      {
        SCHEMX_WORKFLOW_TARGETS: "vant",
      }
    )

    expect(selected.map((item) => item.directory)).toEqual(["core"])
  })
})

describe("workspace 检查链", () => {
  afterEach(() => {
    terminal.dispose()
  })
  const success: RunResult = { code: 0, stdout: "", stderr: "", output: "" }

  type RecordedCommand = (
    command: string,
    args: readonly string[],
    options?: RunOptions
  ) => Promise<RunResult>
  let exec = vi.fn<RecordedCommand>()

  let terminal: Terminal

  beforeEach(() => {
    exec = vi.fn<RecordedCommand>().mockResolvedValue(success)
    terminal = createTerminal({
      output: new Writable({
        write(_chunk, _encoding, done) {
          done()
        },
      }),
      env: { CI: "true" },
      handleSignals: false,
    })
    vi.spyOn(terminal, "runCommand").mockImplementation(async (request) => {
      const result = await exec(
        request.command,
        request.args ?? [],
        request.cwd === undefined ? {} : { cwd: request.cwd }
      )

      return {
        exitCode: result.code,
        signal: null,
        stdout: result.stdout,
        stderr: result.stderr,
        output: result.output,
      }
    })
    vi.spyOn(terminal, "text")
    writeFileSync(path.join(root, "packages/core/index.ts"), "export const value = 1\n")
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

  it.each(["lint", "lint:fix", "check"])(
    "%s 对自动发现的文件执行工具，check 保留包的类型检查",
    async (task) => {
      const code = await runWorkspaceTask({ root, catalog, terminal, env: {} }, task, [
        "core",
      ])

      expect(code).toBe(0)
      expect(exec).toHaveBeenCalledTimes(task.startsWith("lint") ? 1 : 3)
      expect(exec).toHaveBeenNthCalledWith(
        1,
        "pnpm",
        [
          "exec",
          "eslint",
          ...(task === "lint:fix" ? ["--fix"] : []),
          "--",
          "packages/core/index.ts",
        ],
        { cwd: root }
      )
      if (!task.startsWith("lint")) {
        expect(exec).toHaveBeenNthCalledWith(
          2,
          "pnpm",
          [
            "exec",
            "prettier",
            "--check",
            "--",
            "packages/core/index.ts",
            "packages/core/package.json",
          ],
          { cwd: root }
        )
        expect(exec).toHaveBeenNthCalledWith(
          3,
          "pnpm",
          ["--dir", "packages/core", "run", "type-check"],
          { cwd: root }
        )
      }
    }
  )

  it.each(["lint", "lint:fix"])("%s 跳过 ESLint 忽略的配置文件", async (task) => {
    for (const file of ["eslint.config.js", "vite.config.ts", "vitest.config.ts"]) {
      writeFileSync(path.join(root, file), "export {}\n")
    }

    writeFileSync(path.join(root, "index.ts"), "export {}\n")

    await expect(
      runWorkspaceTask({ root, catalog, terminal, env: {} }, task, ["."])
    ).resolves.toBe(0)
    expect(exec).toHaveBeenCalledTimes(1)
    expect(exec).toHaveBeenNthCalledWith(
      1,
      "pnpm",
      ["exec", "eslint", ...(task === "lint:fix" ? ["--fix"] : []), "--", "index.ts"],
      { cwd: root }
    )
  })

  it.each(["format", "format:check"])(
    "%s 直接处理发现的文件，不调用包内脚本",
    async (task) => {
      await expect(
        runWorkspaceTask({ root, catalog, terminal, env: {} }, task, ["core"])
      ).resolves.toBe(0)
      expect(exec).toHaveBeenCalledTimes(1)
      expect(exec).toHaveBeenCalledWith(
        "pnpm",
        [
          "exec",
          "prettier",
          task === "format" ? "--write" : "--check",
          "--",
          "packages/core/index.ts",
          "packages/core/package.json",
        ],
        { cwd: root }
      )
    }
  )

  it("scripts 没有 package.json 也能检查，ESLint 失败后停止后续步骤", async () => {
    mkdirSync(path.join(root, "scripts"))
    writeFileSync(path.join(root, "scripts/task.ts"), "export {}\n")
    exec.mockResolvedValueOnce({ ...success, code: 1 })
    await expect(
      runWorkspaceTask({ root, catalog, terminal, env: {} }, "check", ["scripts"])
    ).resolves.toBe(1)
    expect(exec).toHaveBeenCalledTimes(1)
    expect(exec).toHaveBeenLastCalledWith(
      "pnpm",
      ["exec", "eslint", "--", "scripts/task.ts"],
      { cwd: root }
    )
  })

  it("Prettier 检查失败后不执行类型检查", async () => {
    exec.mockResolvedValueOnce(success).mockResolvedValueOnce({ ...success, code: 1 })

    await expect(
      runWorkspaceTask({ root, catalog, terminal, env: {} }, "check", ["core"])
    ).resolves.toBe(1)
    expect(exec).toHaveBeenCalledTimes(2)
    expect(exec.mock.calls[1]?.[1]).toContain("prettier")
  })

  it.each([0, 1, 2])("暂存修复按顺序执行工具，失败步骤 %s 后停止", async (failedStep) => {
    writeFileSync(path.join(root, "vite.config.ts"), "export default {}\n")
    // 只模拟暂存文件清单和工具调用，不读取或修改真实暂存区。
    vi.spyOn(terminal, "executeCommand").mockResolvedValue({
      exitCode: 0,
      signal: null,
      stdout:
        "packages/core/index.ts\0packages/core/package.json\0README.md\0vite.config.ts\0.eslintrc.cjs\0",
      stderr: "",
      output: "",
    })
    if (failedStep === 1) {
      exec.mockResolvedValueOnce({ ...success, code: 1 })
    } else if (failedStep === 2) {
      exec.mockResolvedValueOnce(success).mockResolvedValueOnce({ ...success, code: 1 })
    }

    await expect(
      runFix({ root, catalog, terminal, env: {} }, ["--staged"])
    ).resolves.toBe(failedStep === 0 ? 0 : 1)
    expect(exec.mock.calls.map(([command, args]) => [command, args])).toEqual(
      [
        ["pnpm", ["exec", "eslint", "--fix", "--", "packages/core/index.ts"]],
        [
          "pnpm",
          [
            "exec",
            "prettier",
            "--write",
            "--",
            "packages/core/index.ts",
            "packages/core/package.json",
            "vite.config.ts",
          ],
        ],
        [
          "git",
          [
            "add",
            "--",
            "packages/core/index.ts",
            "vite.config.ts",
            "packages/core/package.json",
          ],
        ],
      ].slice(0, failedStep === 0 ? 3 : failedStep)
    )
  })

  it("包检查 warning 保留 0 退出码", async () => {
    exec.mockResolvedValueOnce({
      ...success,
      stdout: "src/store.ts:888:29: warning @typescript-eslint/no-unused-vars: value",
      output: "src/store.ts:888:29: warning @typescript-eslint/no-unused-vars: value",
    })
    await expect(
      runWorkspaceTask({ root, catalog, terminal, env: {} }, "check", ["core"])
    ).resolves.toBe(0)
    expect(exec).toHaveBeenCalledTimes(3)
  })

  it("包检查失败保留退出码", async () => {
    exec.mockResolvedValueOnce({
      ...success,
      code: 2,
      output: "src/a.ts:1:1: error rule",
    })
    await expect(
      runWorkspaceTask({ root, catalog, terminal, env: {} }, "check", ["core"])
    ).resolves.toBe(2)
    expect(exec).toHaveBeenCalledTimes(1)
  })

  it("静态检查失败不会被工作流覆盖", async () => {
    exec.mockResolvedValueOnce({ ...success, code: 1 })
    await expect(
      runWorkspaceTask({ root, catalog, terminal, env: {} }, "check", ["core"])
    ).resolves.toBe(1)
    expect(exec).toHaveBeenCalledTimes(1)
  })

  it.each(["build", "type-check"])("%s 保留原有检查链", async (task) => {
    await expect(
      runWorkspaceTask({ root, catalog, terminal, env: {} }, task, ["core"])
    ).resolves.toBe(0)
    expect(exec).toHaveBeenCalledTimes(1)
    expect(exec).toHaveBeenCalledWith("pnpm", ["--dir", "packages/core", "run", task], {
      cwd: root,
    })
  })

  it.each(["type-check", "test"])("%s 先检查指定包，再执行项目脚本自检", async (task) => {
    await expect(
      dispatch({ root, catalog, terminal, env: {} }, [task, "core"])
    ).resolves.toBe(0)
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
        : ["exec", "vp", "test", "run", "scripts"],
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
      dispatch({ root, catalog, terminal, env: {} }, [task, "--help"])
    ).resolves.toBe(0)
    expect(exec).not.toHaveBeenCalled()
    expect(terminal.text).toHaveBeenCalled()
  })

  it.each(["type-check", "test"])("%s 失败后不继续项目脚本自检", async (task) => {
    exec.mockResolvedValueOnce({ ...success, code: 1 })
    await expect(
      dispatch({ root, catalog, terminal, env: {} }, [task, "core"])
    ).resolves.toBe(1)
    expect(exec).toHaveBeenCalledTimes(1)
  })

  it.each(["code-check", "release:test"])("已移除的别名 %s 拒绝执行", async (command) => {
    await expect(
      dispatch({ root, catalog, terminal, env: {} }, [command])
    ).rejects.toMatchObject({ message: `未知工作流命令：${command}`, exitCode: 2 })
    expect(exec).not.toHaveBeenCalled()
  })

  it("包配置和产物检查不通过时，任务按失败收尾", async () => {
    const runTask = vi.spyOn(terminal, "runTask")

    await expect(
      dispatch({ root, catalog, terminal, env: {} }, ["check:packages"])
    ).resolves.toBe(1)
    expect(runTask.mock.calls.map(([options]) => options.title)).toEqual([
      "检查包配置",
      "检查构建产物边界",
    ])
    expect(
      (await Promise.allSettled(runTask.mock.results.map((result) => result.value))).map(
        (result) => result.status
      )
    ).toEqual(["rejected", "rejected"])
  })

  it("test:scripts 运行项目脚本测试", async () => {
    await expect(
      dispatch({ root, catalog, terminal, env: {} }, ["test:scripts"])
    ).resolves.toBe(0)
    expect(exec).toHaveBeenCalledWith("pnpm", ["exec", "vp", "test", "run", "scripts"], {
      cwd: root,
    })
  })

  it.each(["type-check:scripts", "test:scripts", "check:packages"])(
    "%s 拒绝被忽略的额外目标",
    async (task) => {
      await expect(
        dispatch({ root, catalog, terminal, env: {} }, [task, "core"])
      ).rejects.toThrow(/不接受目标或额外参数/)
      expect(exec).not.toHaveBeenCalled()
    }
  )
})
