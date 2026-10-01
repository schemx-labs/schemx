/**
 * 发布反馈回归测试：外部发布与 Git 操作使用替身，计划及进度走真实临时文件。
 */
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { Writable } from "node:stream"

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { runRelease } from "../commands/release.ts"
import { createContext } from "../core/context.ts"
import { Ui } from "../ui/ui.ts"

import { assertPackageArtifacts } from "./adapters/artifacts.ts"
import * as git from "./adapters/git.ts"
import { createRelease } from "./adapters/github.ts"
import { publishPackage, writePackageVersion } from "./adapters/npm.ts"
import { verifyPlan } from "./operations.ts"
import { readPlan } from "./plan.ts"
import { createPlan } from "./planning.ts"
import * as preflight from "./preflight.ts"
import { readState, statePath } from "./state.ts"

import type { Context } from "../core/context.ts"
import type { RunResult } from "../core/exec.ts"

vi.mock("./inputs.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./inputs.ts")>()),
  confirmExecution: vi.fn().mockResolvedValue(true),
}))

vi.mock("./preflight.ts", () => ({
  assertCleanWorktree: vi.fn(),
  assertMainBranch: vi.fn(),
  assertRegistry: vi.fn(),
  assertNpmAuth: vi.fn(),
  assertGithubAuth: vi.fn(),
  assertVersionAvailable: vi.fn(),
  assertPrereleaseBaselineAvailable: vi.fn(),
  assertDependencyAvailable: vi.fn(),
}))

vi.mock("./adapters/npm.ts", () => ({
  publishPackage: vi.fn(),
  writePackageVersion: vi.fn(),
  nextPrereleaseSequence: vi.fn().mockResolvedValue(0),
}))

vi.mock("./adapters/artifacts.ts", () => ({
  assertPackageArtifacts: vi
    .fn()
    .mockResolvedValue({ code: 0, stdout: "", stderr: "", output: "" }),
  packPackage: vi.fn(),
}))

vi.mock("./adapters/git.ts", () => ({
  assertReleaseTagAvailable: vi.fn(),
  createReleaseTag: vi.fn(),
  pushReleaseTag: vi.fn(),
}))

vi.mock("./adapters/github.ts", () => ({
  assertReleaseAvailable: vi.fn(),
  createRelease: vi.fn(),
}))

vi.mock("./notes.ts", () => ({ writeReleaseNotes: vi.fn() }))

/** 外部命令的成功结果。 */
const SUCCESS: RunResult = { code: 0, stdout: "", stderr: "", output: "" }

/** 用于复现捕获错误被 live 模式遗漏的发布失败结果。 */
const DENIED: RunResult = {
  code: 1,
  stdout: "",
  stderr: "ERR_PNPM_E403 npm 发布被拒绝",
  output: "ERR_PNPM_E403 npm 发布被拒绝",
}

let root = ""

let output = ""

let context: Context

/**
 * 创建测试用 workspace 包。
 *
 * @param directory - 包目录名。
 * @param version - 初始正式版本。
 */
function writePackage(directory: string, version: string): void {
  const packageDirectory = path.join(root, "packages", directory)

  mkdirSync(packageDirectory, { recursive: true })
  writeFileSync(
    path.join(packageDirectory, "package.json"),
    JSON.stringify({
      name: `@schemx/${directory}`,
      version,
      scripts: {},
    })
  )
}

/** 返回失败后保留的计划路径。 */
function retainedPlan(): string {
  const directory = path.join(root, ".release", "plans")

  const file = readdirSync(directory).find((name) => !name.endsWith(".state.json"))

  if (!file) {
    throw new Error("未保留发布计划")
  }

  return path.join(directory, file)
}

beforeEach(() => {
  vi.clearAllMocks()
  root = mkdtempSync(path.join(tmpdir(), "schemx-release-feedback-"))
  output = ""
  writePackage("core", "1.0.0")
  writePackage("element-plus", "0.0.1")

  const out = new Writable({
    write(chunk, _encoding, done) {
      output += String(chunk)
      done()
    },
  })

  const env = {
    CI: "true",
    SCHEMX_RELEASE_SHA: "abc1234",
    SCHEMX_RELEASE_PRERELEASE_SEQUENCE: "0",
  }

  context = createContext(root, new Ui(out, env, { signals: false }), env)
  vi.mocked(publishPackage).mockReset().mockResolvedValue(SUCCESS)
  vi.mocked(writePackageVersion).mockReset().mockResolvedValue(SUCCESS)
  vi.mocked(createRelease).mockReset().mockResolvedValue(undefined)
})

afterEach(() => {
  vi.restoreAllMocks()
  context.ui.cleanup()
  rmSync(root, { recursive: true, force: true })
})

describe("发布结果反馈", () => {
  it("发布适配器固定本次 Token，保留 registry、tag 并清理临时凭据", async () => {
    const adapter =
      await vi.importActual<typeof import("./adapters/npm.ts")>("./adapters/npm.ts")

    const env = {
      NPM_REGISTRY: "https://registry.npmjs.org/",
      NPM_TOKEN: "release-token",
    }

    const execute = vi
      .fn<typeof import("../core/exec.ts").run>()
      .mockResolvedValue(DENIED)

    expect(await adapter.publishPackage(env, root, "beta", execute)).toBe(DENIED)
    expect(execute).toHaveBeenCalledWith(
      "pnpm",
      expect.arrayContaining([
        "--dir",
        root,
        "--registry",
        env.NPM_REGISTRY,
        "--tag",
        "beta",
      ]),
      {
        env: expect.objectContaining({
          ...env,
          NPM_CONFIG_USERCONFIG: expect.any(String),
          "pnpm_config_//registry.npmjs.org/:_authToken": env.NPM_TOKEN,
        }),
      }
    )

    // 发布失败后也必须清理临时认证文件。
    const configFile = execute.mock.calls[0]?.[2]?.env?.NPM_CONFIG_USERCONFIG

    if (!configFile) {
      throw new Error("未生成临时认证文件")
    }

    expect(existsSync(configFile)).toBe(false)
  })

  it("首包失败时显示真实错误，不显示发布完成或不存在的发布进度", async () => {
    vi.mocked(publishPackage).mockResolvedValue(DENIED)

    const code = await runRelease(context, ["publish", "beta", "element-plus", "0.0.1"])

    expect(code).toBe(1)
    expect(output.match(/ERR_PNPM_E403/g)).toHaveLength(1)
    expect(output).toContain("发布中断")
    expect(output).not.toContain("发布完成")
    expect(output).not.toContain("发布结果")
    expect(output).not.toContain("已成功发布的包无法撤回")
    expect(output).toContain("已保留冻结计划：")
    expect(output).not.toContain("已保留冻结计划与发布进度")
    expect(existsSync(statePath(retainedPlan()))).toBe(false)
  })

  it("部分包成功时保留已发布记录和恢复提示，不显示整体成功", async () => {
    vi.mocked(publishPackage).mockResolvedValueOnce(SUCCESS).mockResolvedValueOnce(DENIED)

    const code = await runRelease(context, [
      "publish",
      "beta",
      "core,element-plus",
      "patch",
    ])

    expect(code).toBe(1)
    expect(output).toContain("已成功发布的包无法撤回")
    expect(output).toContain("release execute")
    expect(output).not.toContain("发布完成")
    expect(readState(retainedPlan())?.packages).toMatchObject([
      { package: "core", published: true },
    ])
  })

  it("npm 成功但 GitHub Release 失败时不显示整体完成", async () => {
    vi.mocked(createRelease).mockRejectedValue(new Error("GitHub Release 创建失败"))

    const code = await runRelease(context, ["publish", "beta", "element-plus", "0.0.1"])

    expect(code).toBe(1)
    expect(output).toContain("GitHub Release 创建失败")
    expect(output).not.toContain("发布完成")
    expect(readState(retainedPlan())?.packages).toMatchObject([
      { package: "element-plus", published: true, tagged: true, released: false },
    ])
  })

  it("scoped 包首次生成发布说明时创建全部输出目录", async () => {
    // 使用真实说明生成器，复现输出目录尚不存在的首次发布。
    const notes = await vi.importActual<typeof import("./notes.ts")>("./notes.ts")

    const outputFile = path.join(
      root,
      ".release",
      "notes",
      "@schemx",
      "element-plus@0.0.1-beta.0.md"
    )

    writeFileSync(
      path.join(root, "packages", "element-plus", "release-notes.md"),
      "修复表单渲染"
    )

    await notes.writeReleaseNotes({
      root,
      target: "element-plus",
      packageName: "@schemx/element-plus",
      version: "0.0.1-beta.0",
      tagName: "@schemx/element-plus@0.0.1-beta.0",
      targetRef: "HEAD",
      outputFile,
      env: {},
      relativeDir: "packages/element-plus",
    })

    expect(readFileSync(outputFile, "utf8")).toContain("修复表单渲染")
    expect(readFileSync(outputFile, "utf8")).toContain(
      "@schemx/element-plus@0.0.1-beta.0"
    )
  })

  it("Git Tag、npm 版本与预发布基线分别验证一次", async () => {
    await runRelease(context, ["publish", "beta", "element-plus", "0.0.1"])

    expect(git.assertReleaseTagAvailable).toHaveBeenCalledOnce()
    expect(preflight.assertVersionAvailable).toHaveBeenCalledOnce()
    expect(preflight.assertPrereleaseBaselineAvailable).toHaveBeenCalledOnce()
    expect(output).toContain("Git Tag 可用")
    expect(output).toContain("npm 版本可用")
  })

  it("多个发布包共享的未选中依赖只查询一次", async () => {
    writePackage("vant", "1.0.0")
    for (const directory of ["vant", "element-plus"]) {
      writeFileSync(
        path.join(root, "packages", directory, "package.json"),
        JSON.stringify({
          name: `@schemx/${directory}`,
          version: "1.0.0",
          dependencies: { "@schemx/core": "workspace:*" },
        })
      )
    }

    await runRelease(context, ["publish", "beta", "vant,element-plus", "patch"])

    expect(preflight.assertDependencyAvailable).toHaveBeenCalledOnce()
    expect(preflight.assertDependencyAvailable).toHaveBeenCalledWith(
      context.env,
      context.catalog,
      "@schemx/core"
    )
  })

  it("仅补 GitHub Release 的预发布续跑跳过 npm、版本写入及质量检查", async () => {
    vi.mocked(createRelease).mockRejectedValueOnce(new Error("Release 创建失败"))
    await runRelease(context, ["publish", "beta", "element-plus", "0.0.1"])

    const planFile = retainedPlan()

    vi.clearAllMocks()

    expect(await runRelease(context, ["execute", planFile])).toBe(0)
    expect(createRelease).toHaveBeenCalledOnce()
    expect(preflight.assertRegistry).not.toHaveBeenCalled()
    expect(preflight.assertNpmAuth).not.toHaveBeenCalled()
    expect(preflight.assertVersionAvailable).not.toHaveBeenCalled()
    expect(preflight.assertPrereleaseBaselineAvailable).not.toHaveBeenCalled()
    expect(preflight.assertDependencyAvailable).not.toHaveBeenCalled()
    expect(assertPackageArtifacts).not.toHaveBeenCalled()
    expect(publishPackage).not.toHaveBeenCalled()
    expect(writePackageVersion).not.toHaveBeenCalled()
    expect(git.createReleaseTag).not.toHaveBeenCalled()
    expect(git.pushReleaseTag).not.toHaveBeenCalled()
  })

  it("部分成功后的预发布续跑只验证和改写未发布包", async () => {
    vi.mocked(publishPackage).mockResolvedValueOnce(SUCCESS).mockResolvedValueOnce(DENIED)
    await runRelease(context, ["publish", "beta", "core,element-plus", "patch"])

    const planFile = retainedPlan()

    vi.clearAllMocks()

    expect(await runRelease(context, ["execute", planFile])).toBe(0)
    expect(assertPackageArtifacts).toHaveBeenCalledExactlyOnceWith("@schemx/element-plus")
    expect(publishPackage).toHaveBeenCalledOnce()
    expect(writePackageVersion).toHaveBeenCalledExactlyOnceWith(
      path.join(root, "packages", "element-plus"),
      "0.0.2-beta.0"
    )
  })

  it("keep-going 保留质量失败，即使后续产物检查通过", async () => {
    writeFileSync(
      path.join(root, "packages", "element-plus", "package.json"),
      JSON.stringify({
        name: "@schemx/element-plus",
        version: "0.0.1",
        scripts: { lint: "lint", "type-check": "types", test: "tests", build: "build" },
      })
    )

    const planFile = path.join(root, "quality-plan.json")

    await createPlan(context, "beta", "element-plus", "0.0.1", planFile)
    vi.spyOn(context.ui, "exec").mockImplementation(async (_command, args) =>
      args.at(-1) === "lint" ? DENIED : SUCCESS
    )

    expect(await verifyPlan(context, readPlan(planFile), planFile, true)).toBe(1)
    expect(assertPackageArtifacts).toHaveBeenCalledOnce()
    expect(output).toContain("质量与产物检查失败")
  })

  it("全部步骤成功后才显示发布完成", async () => {
    const code = await runRelease(context, ["publish", "beta", "element-plus", "0.0.1"])

    expect(code).toBe(0)
    expect(output).toContain("发布完成")
    expect(output.match(/发布结果/g)).toHaveLength(1)
    expect(output).not.toContain("发布中断")
  })
})
