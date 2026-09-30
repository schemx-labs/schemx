/**
 * 转圈动画与失败详情的行为测试。
 *
 * @remarks 这两处最容易出「看起来对、实际错位」的问题，因此断言落在字节层：
 *
 * - 动画帧必须以换行结尾。若省略，光标会停在本行行尾，下一帧的 `cursorUp(1)` 就再多
 *   退一行，逐帧累积后动画会在终端里铺成一条斜线而不是原地转动。
 * - 透传模式下子进程直接写终端，行重绘机制会与之冲突，因此必须完全禁用动画；
 *   捕获模式下子进程走管道，动画独占输出流，才可以安全启用。
 * - 非 TTY 下没有动画，占位行只会让同一个任务在 CI 日志里出现两次。
 * - 失败详情按「命令 → 其他输出 → 错误结论」重排，并去掉重复行；超长行截断。
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { classifyDetailLine, setColorSupport } from "./theme.ts"
import { Ui } from "./ui.ts"

/** 收集全部写入的假流。 */
class Capture {
  /** 原始写入内容。 */
  raw = ""

  /** 输出流形状。 */
  readonly stream = {
    isTTY: true,
    write: (chunk: string): boolean => {
      this.raw += chunk

      return true
    },
  }
}

/** 转义序列，用于断言。 */
const ESC = String.fromCharCode(27)

/** 去掉全部 ANSI 序列。 */
function strip(text: string): string {
  return text.replace(new RegExp(`${ESC}\\[[0-9;?]*[a-zA-Z]`, "g"), "")
}

/** 提取全部「上移一行 + 清行」的动画帧。 */
function frames(raw: string): readonly string[] {
  return raw.match(new RegExp(`${ESC}\\[1A${ESC}\\[2K[^\\n]*\\n`, "g")) ?? []
}

let capture: Capture

beforeEach(() => {
  capture = new Capture()
})

afterEach(() => {
  setColorSupport(false)
})

/**
 * 构造一个绑定到假流的 UI。
 *
 * @param options - 构造选项。
 * @param env - 环境变量。
 * @returns UI 实例。
 */
function makeUi(options: { isTTY: boolean }, env: NodeJS.ProcessEnv = {}): Ui {
  capture.stream.isTTY = options.isTTY

  return new Ui(capture.stream as never, env, { signals: false })
}

describe("转圈动画", () => {
  it("捕获模式的 TTY 下启用动画，且每帧都以换行结尾", async () => {
    const ui = makeUi({ isTTY: true })

    await ui.task({ title: "build" }, async () => {
      await new Promise((done) => setTimeout(done, 350))

      return { code: 0, stdout: "", stderr: "", output: "" }
    })

    const found = frames(capture.raw)

    expect(found.length).toBeGreaterThan(1)

    for (const frame of found) {
      expect(frame.endsWith("\n")).toBe(true)
      expect(frame.startsWith(`${ESC}[1A${ESC}[2K`)).toBe(true)
    }
  })

  it("结束时用最终结果替换动画行", async () => {
    const ui = makeUi({ isTTY: true })

    await ui.task({ title: "build", itemKey: "core" }, async () => ({
      code: 0,
      stdout: "",
      stderr: "",
      output: "",
    }))

    const last = frames(capture.raw).at(-1) ?? ""

    expect(strip(last)).toContain("core")
    expect(strip(last)).toContain("✔")
  })

  it("透传模式完全禁用动画，避免与子进程争抢终端", async () => {
    const ui = makeUi({ isTTY: true })

    await ui.task({ title: "build", log: "live" }, async () => {
      await new Promise((done) => setTimeout(done, 260))

      return { code: 0, stdout: "", stderr: "", output: "" }
    })

    expect(capture.raw).not.toContain(`${ESC}[1A`)
  })

  it("非 TTY 下不输出占位行，一个任务一行", async () => {
    const ui = makeUi({ isTTY: false }, { CI: "true" })

    await ui.task({ title: "a" }, async () => ({
      code: 0,
      stdout: "",
      stderr: "",
      output: "",
    }))
    await ui.task({ title: "b" }, async () => ({
      code: 0,
      stdout: "",
      stderr: "",
      output: "",
    }))

    expect(capture.raw).not.toContain(`${ESC}[1A`)
    expect(strip(capture.raw).trim().split("\n")).toHaveLength(2)
  })

  it("WORKFLOW_LOG=live 时即使 TTY 也不启用动画", async () => {
    const ui = makeUi({ isTTY: true }, { WORKFLOW_LOG: "live" })

    await ui.task({ title: "a" }, async () => {
      await new Promise((done) => setTimeout(done, 260))

      return { code: 0, stdout: "", stderr: "", output: "" }
    })

    expect(capture.raw).not.toContain(`${ESC}[1A`)
  })
})

describe("失败详情的语义分类", () => {
  it.each([
    ["$ pnpm run build", "command"],
    ["$ eslint .", "command"],
    ["> vite build", "command"],
    ["src/a.ts:1:1 - error TS2322: x", "error"],
    ["  error TS2345: y", "error"],
    ["[ELIFECYCLE] Command failed with exit code 1.", "error"],
    ["ERR_PNPM_NO_MATCHING_VERSION", "error"],
    ["✗ 3 problems", "error"],
    ["All matched files use the correct format.", "plain"],
    ["0 errors found", "plain"],
  ] as const)("%s → %s", (line, expected) => {
    expect(classifyDetailLine(line)).toBe(expected)
  })
})

describe("失败详情块", () => {
  /**
   * 运行一次失败任务并返回渲染出的行。
   *
   * @param output - 模拟的子进程合并输出。
   * @returns 渲染行。
   */
  async function renderFailure(output: string): Promise<readonly string[]> {
    const ui = makeUi({ isTTY: false }, { CI: "true" })

    await ui.task({ title: "check", itemKey: "vue" }, async () => ({
      code: 1,
      stdout: "",
      stderr: "",
      output,
    }))

    const lines = strip(capture.raw)
      .split("\n")
      .filter((line) => line.trim() !== "")

    // 第一行是任务结果行，其后才是失败详情块。
    return lines.slice(1)
  }

  it("按命令、其他输出、错误结论的顺序重排", async () => {
    const lines = await renderFailure(
      [
        "src/a.ts:1:1 - error TS2322: boom",
        "All matched files use the correct format.",
        "$ tsc -p .",
      ].join("\n")
    )

    expect(lines[0]).toContain("┌")
    expect(lines[0]).toContain("$ tsc -p .")
    expect(lines.at(-1)).toContain("error TS2322")
  })

  it("去掉重复行", async () => {
    const lines = await renderFailure(
      ["[ELIFECYCLE] Command failed.", "[ELIFECYCLE] Command failed."].join("\n")
    )

    expect(lines.filter((line) => line.includes("ELIFECYCLE"))).toHaveLength(1)
  })

  it("超长行被截断以免在终端折行", async () => {
    const lines = await renderFailure(`error TS2322: ${"x".repeat(400)}`)

    expect(lines[0]?.length).toBeLessThanOrEqual(146)
    expect(lines[0]).toContain("…")
  })

  it("行数超预算时先保留错误结论", async () => {
    const noise = Array.from({ length: 60 }, (_, index) => `plain line ${index}`)

    const errors = ["error TS1: a", "error TS2: b", "error TS3: c"]

    const lines = await renderFailure([...noise, ...errors].join("\n"))

    expect(lines.length).toBeLessThan(46)
    expect(capture.raw).toContain("error TS3")
    expect(capture.raw).toContain("WORKFLOW_LOG=live")
  })

  it("成功后不渲染任何详情", async () => {
    const ui = makeUi({ isTTY: false }, { CI: "true" })

    await ui.task({ title: "ok" }, async () => ({
      code: 0,
      stdout: "",
      stderr: "",
      output: "",
    }))

    expect(strip(capture.raw)).not.toContain("┌")
  })
})
