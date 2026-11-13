/** 共享质量任务图测试：范围、依赖、失败阻断和实际发布文件。 */
import { execFileSync } from "node:child_process"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { Writable } from "node:stream"

import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test"

import { runCheck } from "../commands/check.ts"
import { Catalog } from "../core/catalog.ts"
import { createTerminal } from "../ui/index.ts"

import { checkQualityArtifacts, previewQualityPackage } from "./artifacts.ts"
import { createQualityPlan } from "./plan.ts"
import { runQualityPlan } from "./run.ts"
import { resolveQualityScope } from "./scope.ts"

import type { QualityTask } from "./plan.ts"
import type { Context } from "../core/context.ts"

/** 本例隔离仓库。 */
let root = ""

/** 只记录汇总，不启动真实终端。 */
const summary = vi.fn()

/** 当前测试上下文。 */
let context: Context

/**
 * 写入最小可构建包。
 * @param directory - 包目录。
 * @param name - workspace 包名。
 * @param dependencies - 本地依赖。
 */
function writePackage(
  directory: string,
  name: string,
  dependencies: Record<string, string> = {}
): void {
  mkdirSync(path.join(root, directory), { recursive: true })
  writeFileSync(
    path.join(root, directory, "package.json"),
    JSON.stringify({
      name,
      version: "1.0.0",
      scripts: {
        lint: "lint",
        "format:check": "format",
        "type-check": "types",
        test: "test",
        build: "build",
        "build:only": "build",
      },
      dependencies,
    })
  )
  writeFileSync(path.join(root, directory, "index.ts"), "export {}\n")
}

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), "schemx-quality-"))
  execFileSync("git", ["init", "-q", root])
  context = {
    root,
    catalog: new Catalog(root),
    terminal: { summary } as unknown as Context["terminal"],
    env: {},
  }
  summary.mockClear()
})
afterEach(() => rmSync(root, { recursive: true, force: true }))

describe("质量范围与任务图", () => {
  it("Vue 包扩展下游，Core 只构建；多个入口去重，scripts 自检只执行一次", async () => {
    writePackage("packages/core", "@schemx/core")
    writePackage("packages/vue", "@schemx/vue", { "@schemx/core": "workspace:*" })
    writePackage("packages/vant", "@schemx/vant", { "@schemx/vue": "workspace:*" })
    writePackage("packages/element-plus", "@schemx/element-plus", {
      "@schemx/vue": "workspace:*",
    })
    writePackage("examples/vant", "vant-demo", { "@schemx/vant": "workspace:*" })
    writePackage("examples/element-plus", "element-demo", {
      "@schemx/element-plus": "workspace:*",
    })
    mkdirSync(path.join(root, "scripts"))
    writeFileSync(path.join(root, "scripts/tsconfig.json"), "{}")
    const scope = await resolveQualityScope(context.catalog, root, "vue,vant")

    expect(scope.checked.map((item) => item.name).sort()).toEqual([
      "@schemx/element-plus",
      "@schemx/vant",
      "@schemx/vue",
      "element-demo",
      "vant-demo",
    ])
    const plan = createQualityPlan(scope)

    const calls: string[] = []

    const result = await runQualityPlan(context, plan, {
      execute: async (task) => {
        calls.push(task.id)

        return 0
      },
    })

    expect(result.code).toBe(0)
    expect(new Set(calls).size).toBe(calls.length)
    expect(calls.indexOf("packages/core:build")).toBeLessThan(
      calls.indexOf("packages/vue:type-check")
    )
    expect(calls.indexOf("packages/core:build")).toBeLessThan(
      calls.indexOf("packages/vue:lint")
    )
    expect(calls).not.toContain("packages/core:test")
    expect(calls.filter((id) => id === "scripts:test")).toHaveLength(1)
    expect(createQualityPlan(await resolveQualityScope(context.catalog, root))).toEqual(
      createQualityPlan(await resolveQualityScope(context.catalog, root, "all"))
    )
  })
  it("接受路径、包名及未跟踪目录，拒绝未知或歧义目标", async () => {
    writePackage("packages/vue", "@schemx/vue")
    expect(
      (await resolveQualityScope(context.catalog, root, "packages/vue")).checked
    ).toHaveLength(1)
    expect(
      (await resolveQualityScope(context.catalog, root, "@schemx/vue")).checked
    ).toHaveLength(1)
    await expect(resolveQualityScope(context.catalog, root, "missing")).rejects.toThrow(
      "不存在"
    )
    writePackage("examples/other", "demo")
    writePackage("plugins/other", "other-demo")
    await expect(resolveQualityScope(new Catalog(root), root, "other")).rejects.toThrow(
      "歧义"
    )
  })
  it("默认 check 全仓且不进入选择器，help 不执行任务", async () => {
    mkdirSync(path.join(root, "src"))
    writeFileSync(path.join(root, "src/main.ts"), "export {}")
    const terminal = createTerminal({
      output: new Writable({
        write(_chunk, _encoding, done) {
          done()
        },
      }),
      handleSignals: false,
      env: { CI: "true" },
    })

    const run = vi.spyOn(terminal, "runCommand").mockResolvedValue({
      exitCode: 0,
      signal: null,
      stdout: "",
      stderr: "",
      output: "",
    })

    const current = { ...context, terminal }

    try {
      expect(await runCheck(current, ["--help"])).toBe(0)
      expect(run).not.toHaveBeenCalled()
      expect(await runCheck(current, [])).toBe(0)
      const defaultCalls = run.mock.calls.map(([options]) => options.args)

      run.mockClear()
      expect(await runCheck(current, ["all"])).toBe(0)
      expect(run.mock.calls.map(([options]) => options.args)).toEqual(defaultCalls)
    } finally {
      terminal.dispose()
    }
  })
  it("dev、peer 和 optional 依赖均传播下游影响", async () => {
    writePackage("packages/base", "base")
    for (const kind of ["devDependencies", "peerDependencies", "optionalDependencies"]) {
      const directory = `plugins/${kind}`

      writePackage(directory, kind)
      writeFileSync(
        path.join(root, directory, "package.json"),
        JSON.stringify({ name: kind, [kind]: { base: "workspace:*" } })
      )
    }

    expect(
      (await resolveQualityScope(new Catalog(root), root, "base")).checked
    ).toHaveLength(4)
  })
  it("实际循环路径在执行之前报错", async () => {
    writePackage("packages/a", "a", { b: "workspace:*" })
    writePackage("packages/b", "b", { a: "workspace:*" })
    await expect(resolveQualityScope(context.catalog, root, "a")).rejects.toThrow(
      "a → b → a"
    )
  })
  it("缺少发布包必须脚本生成配置失败，普通目录的缺失测试单列", async () => {
    writePackage("packages/a", "a")
    writeFileSync(
      path.join(root, "packages/a/package.json"),
      JSON.stringify({ name: "a", version: "1.0.0", scripts: { build: "build" } })
    )
    const plan = createQualityPlan(await resolveQualityScope(context.catalog, root))

    expect(plan.find((task) => task.error)?.error).toContain("test")
    expect(plan.find((task) => task.id === "packages/a:test")?.skip).toContain("未配置")
  })
})

describe("失败与取消", () => {
  /** 一条失败构建、消费者和独立任务组成的图。 */
  const plan: QualityTask[] = [
    { id: "a:build", directory: "a", title: "build", needs: [] },
    { id: "b:test", directory: "b", title: "test", needs: ["a:build"] },
    { id: "a:artifacts", directory: "a", title: "artifacts", needs: ["a:build"] },
    { id: "c:test", directory: "c", title: "test", needs: [] },
  ]

  it.each([false, true])("构建失败阻断消费者；keep-going=%s", async (keepGoing) => {
    const calls: string[] = []

    const result = await runQualityPlan(context, plan, {
      keepGoing,
      execute: async (task) => {
        calls.push(task.id)

        return task.id === "a:build" ? 2 : 0
      },
    })

    expect(result.code).toBe(2)
    expect(calls).toEqual(keepGoing ? ["a:build", "c:test"] : ["a:build"])
    expect(result.tasks.find((task) => task.id === "a:artifacts")?.status).toBe("blocked")
  })
  it.each(["lint", "test", "artifacts"])("%s 失败保留原始退出码", async (kind) => {
    const tasks: QualityTask[] = [
      { id: `a:${kind}`, directory: "a", title: kind, needs: [] },
    ]

    expect((await runQualityPlan(context, tasks, { execute: async () => 3 })).code).toBe(
      3
    )
  })
  it("执行前拒绝缺失依赖及任务环，不启动无关任务", async () => {
    const execute = vi.fn().mockResolvedValue(0)

    await expect(
      runQualityPlan(
        context,
        [...plan, { id: "broken", directory: "x", title: "test", needs: ["missing"] }],
        { execute }
      )
    ).rejects.toThrow("缺少前置")
    expect(execute).not.toHaveBeenCalled()
    await expect(
      runQualityPlan(
        context,
        [{ id: "x", directory: "x", title: "test", needs: ["x"] }],
        { execute }
      )
    ).rejects.toThrow("循环")
  })
  it("中断固定 130，keep-going 也不继续执行", async () => {
    const execute = vi.fn().mockResolvedValue(130)

    expect((await runQualityPlan(context, plan, { keepGoing: true, execute })).code).toBe(
      130
    )
    expect(execute).toHaveBeenCalledTimes(1)
  })
})

describe("发布文件检查", () => {
  it("打包预览必须捕获 JSON 且禁用生命周期脚本", async () => {
    const executeCommand = vi.fn().mockResolvedValue({
      exitCode: 0,
      signal: null,
      stdout: '{"files":[]}',
      stderr: "",
      output: "",
    })

    const terminal = { executeCommand } as unknown as Context["terminal"]

    expect(
      (await previewQualityPackage({ ...context, terminal }, "packages/vue")).stdout
    ).toBe('{"files":[]}')
    expect(executeCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        outputMode: "capture",
        env: { npm_config_ignore_scripts: "true" },
        args: ["--dir", "packages/vue", "pack", "--dry-run", "--json"],
      })
    )
  })
  it("exports 文件不存在或未打包时失败，局部检查不读取其他包 dist", async () => {
    writePackage("plugins/custom", "custom")
    writeFileSync(
      path.join(root, "plugins/custom/package.json"),
      JSON.stringify({ exports: { ".": "./index.js", "./style.css": "./style.css" } })
    )
    const preview = vi.fn().mockResolvedValue({
      code: 0,
      stdout: JSON.stringify({ files: [{ path: "index.js" }] }),
      output: "",
      stderr: "",
    })

    await expect(
      checkQualityArtifacts(context, "plugins/custom", preview)
    ).rejects.toThrow("不存在")
    writeFileSync(path.join(root, "plugins/custom/index.js"), "export {}")
    writeFileSync(path.join(root, "plugins/custom/style.css"), "")
    await expect(
      checkQualityArtifacts(context, "plugins/custom", preview)
    ).rejects.toThrow("未纳入")
    preview.mockResolvedValue({
      code: 0,
      stdout: JSON.stringify({ files: [{ path: "index.js" }, { path: "style.css" }] }),
      output: "",
      stderr: "",
    })
    await expect(
      checkQualityArtifacts(context, "plugins/custom", preview)
    ).resolves.toBeUndefined()
  })
})
