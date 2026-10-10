/**
 * 转圈动画与失败详情的行为测试。
 *
 * @remarks 这两处最容易出「看起来对、实际错位」的问题，因此断言落在字节层：
 *
 * - 动画帧必须以换行结尾。若省略，光标会停在本行行尾，下一帧的 `cursorUp(1)` 就再多
 *   退一行，逐帧累积后动画会在终端里铺成一条斜线而不是原地转动。
 * - 实时日志追加在动画上方，写入后恢复当前任务，防止覆盖日志。
 * - 非 TTY 使用静态进行中状态，等待期间也能知道当前任务。
 * - 失败详情按「命令 → 其他输出 → 错误结论」重排，并去掉重复行；超长行截断。
 */
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test"

import { usageError } from "../core/errors.ts"

import { classifyDetailLine, setColorSupport, visibleWidth } from "./theme.ts"
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

  it("实时模式在没有新日志时仍持续显示动画", async () => {
    const ui = makeUi({ isTTY: true })

    await ui.task({ title: "build", log: "live" }, async () => {
      await new Promise((done) => setTimeout(done, 260))

      return { code: 0, stdout: "", stderr: "", output: "" }
    })

    expect(frames(capture.raw).length).toBeGreaterThan(1)
  })

  it("非 TTY 下分别输出进行中与结果，不使用光标控制", async () => {
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
    expect(strip(capture.raw).trim().split("\n")).toHaveLength(4)
    expect(capture.raw.match(/执行中/g)).toHaveLength(2)
  })

  it("WORKFLOW_LOG=live 时同样启用动画", async () => {
    const ui = makeUi({ isTTY: true }, { WORKFLOW_LOG: "live" })

    await ui.task({ title: "a" }, async () => {
      await new Promise((done) => setTimeout(done, 260))

      return { code: 0, stdout: "", stderr: "", output: "" }
    })

    expect(frames(capture.raw).length).toBeGreaterThan(1)
  })

  it("长任务名在窄终端仍显示单行动画", async () => {
    const ui = makeUi({ isTTY: true })

    Object.assign(capture.stream, { columns: 32 })
    await ui.task({ title: "验证发布版本是否可用".repeat(8) }, async () => {
      await new Promise((done) => setTimeout(done, 120))
    })

    const first = capture.raw.split("\n")[0] ?? ""

    expect(visibleWidth(first)).toBeLessThan(32)
    expect(strip(first)).toContain("…")
    expect(frames(capture.raw).length).toBeGreaterThan(1)
  })

  it("内部说明写入后恢复正在生成计划的动画", async () => {
    const ui = makeUi({ isTTY: true }, { NO_COLOR: "1" })

    await ui.task({ title: "冻结发布计划" }, async () => {
      ui.note("正在查询 registry")
      await new Promise((done) => setTimeout(done, 120))
    })

    expect(capture.raw).toContain(
      `${ESC}[1A${ESC}[2K\r│  正在查询 registry\n│  ⠋ 冻结发布计划\n`
    )
    expect(strip(frames(capture.raw).at(-1) ?? "")).toContain("✔ 冻结发布计划")
  })

  it("实时输出追加在动画上方，stdout、stderr 和尾部半行都保留", async () => {
    const ui = makeUi({ isTTY: true }, { NO_COLOR: "1" })

    await ui.task(
      { title: "build", log: "live" },
      async () =>
        await ui.exec(process.execPath, [
          "-e",
          'process.stdout.write("first\\n"); process.stderr.write("warning\\n"); setTimeout(() => process.stdout.write("tail"), 220)',
        ])
    )

    expect(capture.raw.match(/│ {4}first\n/g)).toHaveLength(1)
    expect(capture.raw.match(/│ {4}warning\n/g)).toHaveLength(1)
    expect(capture.raw.match(/│ {4}tail\n/g)).toHaveLength(1)
    expect(capture.raw).toMatch(
      new RegExp(`${ESC}\\[1A${ESC}\\[2K\\r│    first\\n│  [^\\n]*build\\n`)
    )
    expect(strip(frames(capture.raw).at(-1) ?? "")).toContain("✔ build")
  })

  it("计划生成失败时停止动画并保留原有用法错误", async () => {
    const ui = makeUi({ isTTY: true })

    const error = usageError("无效发布通道")

    await expect(
      ui.task({ title: "冻结发布计划", throwOnError: true }, async () => {
        throw error
      })
    ).rejects.toBe(error)

    const finished = capture.raw

    await new Promise((done) => setTimeout(done, 120))
    expect(capture.raw).toBe(finished)
    expect(strip(frames(capture.raw).at(-1) ?? "")).toContain("✖")
  })

  it.each([1, 130])("退出码 %s 结束后不再输出动画帧", async (code) => {
    const ui = makeUi({ isTTY: true })

    expect(
      await ui.task({ title: "检查" }, async () => ({
        code,
        stdout: "",
        stderr: "",
        output: "",
      }))
    ).toBe(code)

    const finished = capture.raw

    await new Promise((done) => setTimeout(done, 120))
    expect(capture.raw).toBe(finished)
  })

  it("长驻服务持续显示运行状态并保留实时日志", async () => {
    const ui = makeUi({ isTTY: true }, { NO_COLOR: "1" })

    const code = await ui.service({ title: "运行服务" }, process.execPath, [
      "-e",
      'process.stdout.write("ready\\n"); setTimeout(() => {}, 220)',
    ])

    expect(code).toBe(0)
    expect(capture.raw).toContain("│    ready\n")
    expect(frames(capture.raw).length).toBeGreaterThan(1)
    expect(strip(frames(capture.raw).at(-1) ?? "")).toContain("✔ 运行服务")
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
    ["  25:27  error  Missing trailing comma  comma-dangle", "error"],
    ["src/a.ts:1:1: error eslint(no-unused-vars): x", "error"],
    ["src/a.ts:1:1: warning unicorn(no-useless-spread): array", "warning"],
    ["  92:3  warning  Expected blank line  padding-line-between-statements", "warning"],
    ["[Warning/no-unused-vars] x", "warning"],
    ["Warning: deprecated API", "warning"],
    ["WARN Unsupported engine", "warning"],
    ["✖ 3 problems (0 errors, 3 warnings)", "warning"],
    ["Found 0 warnings and 0 errors.", "plain"],
    ["0 warnings", "plain"],
    ["\u001b[33msrc/a.ts:1:1: warning eslint(no-unused-vars): x\u001b[0m", "warning"],
  ] as const)("%s → %s", (line, expected) => {
    expect(classifyDetailLine(line)).toBe(expected)
  })
})

describe("失败详情块", () => {
  it("实时任务返回适配器捕获的错误时仍展示失败原因", async () => {
    const ui = makeUi({ isTTY: false })

    const output = "ERR_PNPM_E403 npm 发布被拒绝"

    const code = await ui.task({ title: "发布", log: "live" }, async () => ({
      code: 1,
      stdout: "",
      stderr: output,
      output,
    }))

    expect(code).toBe(1)
    expect(capture.raw).toContain(output)
  })

  it("实际流式输出的错误不重复渲染", async () => {
    const ui = makeUi({ isTTY: false })

    const code = await ui.task(
      { title: "发布", log: "live" },
      async () =>
        await ui.exec(process.execPath, [
          "-e",
          'process.stderr.write("ERR_PNPM_E403 npm 发布被拒绝\\n"); process.exitCode = 1',
        ])
    )

    expect(code).toBe(1)
    expect(capture.raw.match(/ERR_PNPM_E403/g)).toHaveLength(1)
  })

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

    // 前两行分别是进行中和任务结果，其后才是失败详情块。
    return lines.slice(2)
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

    expect(lines[0]?.length).toBeLessThanOrEqual(148)
    expect(lines.join("\n")).toContain("…")
  })

  it("行数超预算时先保留错误结论", async () => {
    const noise = Array.from({ length: 60 }, (_, index) => `plain line ${index}`)

    const errors = ["error TS1: a", "error TS2: b", "error TS3: c"]

    const lines = await renderFailure([...noise, ...errors].join("\n"))

    expect(lines.length).toBeLessThan(46)
    expect(capture.raw).toContain("error TS3")
    expect(capture.raw).toContain("WORKFLOW_LOG=live")
  })

  it("成功任务展示 Oxc warning 并保留 0 退出码", async () => {
    const ui = makeUi({ isTTY: false })

    const output =
      "src/store.ts:888:29: warning unicorn(no-useless-spread): unnecessary array"

    const code = await ui.task({ title: "oxlint" }, async () => ({
      code: 0,
      stdout: output,
      stderr: "",
      output,
    }))

    expect(code).toBe(0)
    expect(capture.raw).toContain("warning unicorn(no-useless-spread)")
    expect(strip(capture.raw)).toContain("✔ oxlint")
  })

  it("成功任务的普通输出仍静默", async () => {
    const ui = makeUi({ isTTY: false })

    const code = await ui.task({ title: "check" }, async () => ({
      code: 0,
      stdout: "All matched files use the correct format.",
      stderr: "",
      output: "All matched files use the correct format.",
    }))

    expect(code).toBe(0)
    expect(capture.raw).not.toContain("correct format")
    expect(capture.raw).not.toContain("┌")
  })

  it("实时 warning 不重复渲染", async () => {
    const ui = makeUi({ isTTY: false })

    const code = await ui.task({ title: "oxlint", log: "live" }, async () =>
      ui.exec(process.execPath, [
        "-e",
        'process.stderr.write("src/a.ts:1:1: warning eslint(no-unused-vars): x\\n")',
      ])
    )

    expect(code).toBe(0)
    expect(capture.raw.match(/no-unused-vars/g)).toHaveLength(1)
  })

  it("普通输出很多时仍保留 warning", async () => {
    const ui = makeUi({ isTTY: false })

    const warning = "src/store.ts:888:29: warning unicorn(no-useless-spread): array"

    const output = [
      ...Array.from({ length: 60 }, (_, index) => `plain line ${index}`),
      warning,
    ].join("\n")

    await ui.task({ title: "oxlint" }, async () => ({
      code: 0,
      stdout: output,
      stderr: "",
      output,
    }))

    expect(capture.raw).toContain("warning unicorn(no-useless-spread)")
    expect(capture.raw).toContain("WORKFLOW_LOG=live")
  })

  it("大量 ESLint warning 不会挤掉真正的 error", async () => {
    const warnings = Array.from(
      { length: 60 },
      (_, index) =>
        `  ${index + 1}:1  warning  blank line  padding-line-between-statements`
    )

    await renderFailure(
      [...warnings, "  689:63  error  Missing trailing comma  comma-dangle"].join("\n")
    )

    expect(capture.raw).toContain("689:63")
    expect(capture.raw).toContain("Missing trailing comma")
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

describe("流程反馈布局", () => {
  it("长中文说明与错误详情换行后，每行仍保留导轨", async () => {
    const ui = makeUi({ isTTY: false })

    Object.assign(capture.stream, { columns: 40 })
    ui.flowBegin({
      domain: "release",
      title: "检查",
      description: "这是较长的中文说明。".repeat(5),
    })
    ui.groupBegin({ title: "发布前检查", description: "这是较长的分组说明。".repeat(5) })
    await ui.task({ title: "验证凭据" }, async () => {
      throw new Error("凭据无效，请重新登录。".repeat(5))
    })

    const lines = strip(capture.raw).split("\n").filter(Boolean)

    expect(lines.every((line) => visibleWidth(line) <= 40)).toBe(true)
    expect(lines.slice(1).every((line) => line.startsWith("│"))).toBe(true)
  })

  it("实时日志按流缓冲半行，无结尾换行的内容也只输出一次", async () => {
    const ui = makeUi({ isTTY: false })

    await ui.task(
      { title: "build", log: "live" },
      async () =>
        await ui.exec(process.execPath, [
          "-e",
          'process.stdout.write("first\\npar"); process.stderr.write("warning\\n"); setTimeout(() => process.stdout.write("tial"), 10)',
        ])
    )

    const lines = strip(capture.raw).trimEnd().split("\n")

    expect(lines.filter((line) => line.includes("partial"))).toEqual(["│    partial"])
    expect(lines).toContain("│    first")
    expect(lines).toContain("│    warning")
    expect(lines.every((line) => line.startsWith("│"))).toBe(true)
  })

  it("标题、说明、任务、摘要与结束反馈共用导轨，阶段之间留白", () => {
    const ui = makeUi({ isTTY: false })

    ui.flowBegin({ domain: "release", title: "发布检查", description: "检查说明" })
    ui.groupBegin({ title: "生成计划", description: "分组说明" })
    ui.note("第一行\n第二行")
    ui.taskRow({ status: "success", label: "校验配置" })
    ui.summary({ title: "发布计划", tone: "neutral", content: "通道：beta\n目标：core" })
    ui.groupEnd("success", "计划已冻结")
    ui.groupBegin({ title: "发布前检查" })
    ui.status("error", "凭据无效\n请重新登录")
    ui.flowEnd("failed", "检查失败")

    const lines = strip(capture.raw).split("\n").filter(Boolean)

    expect(lines[0]).toBe("╭─ release · 发布检查")
    expect(lines.at(-1)).toBe("╰─ ✖ 检查失败")
    expect(lines.slice(1, -1).every((line) => line.startsWith("│"))).toBe(true)
    expect(capture.raw).toContain("计划已冻结\n│\n│  ◆ 发布前检查")
    expect(capture.raw).toContain("│    第一行\n│    第二行")
    expect(capture.raw).toContain("│    ╭")
    expect(capture.raw).not.toContain("│\n│\n")
  })

  it("失败后开始下一流程时不继承未闭合的分组", () => {
    const ui = makeUi({ isTTY: false })

    ui.flowBegin({ domain: "release", title: "发布检查" })
    ui.groupBegin({ title: "发布前检查" })
    ui.flowEnd("failed", "检查失败")
    ui.flowBegin({ domain: "workspace", title: "构建" })
    ui.groupBegin({ title: "执行构建" })

    expect(ui.depth).toBe(1)
  })

  it("TTY 下结果和导轨分别着色，NO_COLOR 下仍保留符号与层级", () => {
    const ui = makeUi({ isTTY: true })

    ui.flowBegin({ domain: "workspace", title: "检查" })
    ui.status("warning", "跳过产物")
    ui.groupBegin({ title: "质量检查" })
    ui.groupEnd("success", "检查通过")
    ui.flowEnd("failed", "流程失败")

    expect(capture.raw).toContain(`${ESC}[33m`)
    expect(capture.raw).toContain(`${ESC}[32m`)
    expect(capture.raw).toContain(`${ESC}[31m`)
    expect(capture.raw).toContain(`${ESC}[90m`)

    capture.raw = ""
    const plainUi = makeUi({ isTTY: true }, { NO_COLOR: "1" })

    plainUi.status("error", "凭据无效")
    expect(capture.raw).toBe("│  ✖ 凭据无效\n")
  })

  it("摘要按目标流的列数收敛宽度，移除 Clack 自带的重复导轨", () => {
    const ui = makeUi({ isTTY: false })

    Object.assign(capture.stream, { columns: 50 })
    ui.summary({ title: "摘要", tone: "info", content: "x".repeat(150) })

    const lines = strip(capture.raw).split("\n").filter(Boolean)

    expect(lines.every((line) => line.length <= 50)).toBe(true)
    expect(lines.filter((line) => line.includes("╭"))).toHaveLength(1)
    expect(lines.every((line) => !line.startsWith("│  │ ╭"))).toBe(true)
  })
})
