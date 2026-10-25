/**
 * 公共终端契约、组合行为、原生日志和资源生命周期的回归测试。
 */
import { spawn } from "node:child_process"
import { once } from "node:events"
import { Writable } from "node:stream"
import { stripVTControlCharacters } from "node:util"

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  expectTypeOf,
  it,
  vi,
} from "vite-plus/test"

import * as publicApi from "../index.ts"
import { createTerminal } from "../index.ts"
import { createRenderer } from "../renderer.ts"
import { visibleWidth } from "../text-layout.ts"

import type { ParentId, Terminal, TerminalOptions } from "../index.ts"

/**
 * 收集工作流输出，子进程原生流由独立父进程验证。
 */
class Capture extends Writable {
  // 保存完整字节解码内容，不折叠空行或重复输出。
  raw = ""
  // 默认禁用颜色，颜色场景按需开启。
  isTTY = false
  // 可覆盖列宽以验证窄终端自动换行。
  columns = 80
  // 捕获工作流写入，原生 stdout/stderr 由隔离进程验证。
  constructor() {
    super({
      /**
       * 同步记录输出，保证断言时不需要等待额外的刷新。
       * @param chunk - 当前写入的输出块。
       * @param _encoding - Writable 的编码信息，数据统一按字符串读取。
       * @param done - 完成本次写入。
       */
      write: (chunk, _encoding, done) => {
        this.raw += String(chunk)
        done()
      },
    })
  }
}

// 集中登记本场景资源，测试结束时统一释放。
const terminals: Terminal[] = []

/**
 * 创建可注入输入、输出和环境的实例。
 * @param options - 场景特有配置。
 */
function fixture(options: TerminalOptions = {}) {
  // 保留场景输出，验证文字、颜色及导轨的实际写入。
  const output = new Capture()

  // 独立实例使用场景配置，不修改全局输入输出。
  const terminal = createTerminal({ output, handleSignals: false, ...options })

  terminals.push(terminal)

  return { terminal, output }
}

afterEach(() => {
  // 释放登记的测试实例，防止监听泄漏。
  for (const terminal of terminals.splice(0)) {
    terminal.dispose()
  }

  vi.restoreAllMocks()
  vi.useRealTimers()
})
// 隔离进程使用绝对 URL 加载相同的公共入口。
const entry = new URL("../index.ts", import.meta.url).href

describe("公共入口与实例", () => {
  it("运行时仅导出工厂，方法可解构，布局和环境不外露", () => {
    expect(Object.keys(publicApi)).toEqual(["createTerminal"])
    // 本场景使用独立终端及其捕获或输入资源。
    const { terminal, output } = fixture()

    // 解构后直接调用，验证方法不依赖 this。
    const { text, status, formatText } = terminal

    text({ content: "说明" })
    status({ tone: "info", message: "反馈" })
    // 操作前快照，用于验证输出或监听没有额外变化。
    const before = output.raw

    expect(formatText({ content: "value", role: "value" })).toBe("value")
    expect(output.raw).toBe(before)
    // 确认内部状态和旧接口没有意外成为公共 API。
    for (const name of [
      "env",
      "out",
      "depth",
      "columns",
      "exec",
      "service",
      "cleanup",
      "task",
      "waitForIdle",
      "register",
      "check",
      "beginSignal",
      "reportError",
      "finishSignal",
    ]) {
      expect(terminal).not.toHaveProperty(name)
    }
  })
  it("不同实例的主题、NO_COLOR 和环境互不影响", () => {
    // 开启颜色的独立流，用于验证实例主题覆盖。
    const left = new Capture()

    left.isTTY = true
    // 对照输出流，用于验证 NO_COLOR 与主题相互隔离。
    const right = new Capture()

    right.isTTY = true
    // 第一个对照实例，用于验证主题或系统监听的实例归属。
    const a = fixture({
      output: left,
      env: { NO_COLOR: undefined },
      theme: { accent: "blue" },
    }).terminal

    // 第二个对照实例，用于验证其他实例不受释放或配置影响。
    const b = fixture({ output: right, env: { NO_COLOR: "1" } }).terminal

    expect(a.formatText({ content: "a", role: "accent" })).toBe("\u001B[34ma\u001B[39m")
    expect(b.formatText({ content: "a", role: "accent" })).toBe("a")
    expect(a.formatText({ content: "a", role: "success" })).toBe("\u001B[32ma\u001B[39m")
    expect(a.formatText({ content: "a", role: "error" })).toBe("\u001B[31ma\u001B[39m")
    expect(a.formatText({ content: "a", role: "warning" })).toBe("\u001B[33ma\u001B[39m")
    expect(a.formatText({ content: "│", role: "rail" })).toBe(
      "\u001B[90m\u001B[2m│\u001B[22m\u001B[39m"
    )
    expect(b.formatText({ content: "│", role: "rail" })).toBe("│")
  })
  it("销毁幂等、注销自身监听，销毁后不允许继续输出", () => {
    // 操作前快照，用于验证输出或监听没有额外变化。
    const before = process.listenerCount("SIGINT")

    // 第一个对照实例，用于验证主题或系统监听的实例归属。
    const a = fixture({ handleSignals: true }).terminal

    // 第二个对照实例，用于验证其他实例不受释放或配置影响。
    const b = fixture({ handleSignals: true }).terminal

    expect(process.listenerCount("SIGINT")).toBe(before + 1)
    a.dispose()
    a.dispose()
    expect(process.listenerCount("SIGINT")).toBe(before + 1)
    b.dispose()
    expect(process.listenerCount("SIGINT")).toBe(before)
    expect(() => a.text({ content: "late" })).toThrow("已释放")
  })
})

describe("输出组合与显式生命周期", () => {
  it("标题、正文、字段、列表、代码和摘要使用同一主线", () => {
    // 本场景使用独立终端及其捕获或输入资源。
    const { terminal, output } = fixture()

    // 显式流程标识，供结束反馈或边界校验使用。
    const flowId = terminal.startFlow({
      domain: "workspace",
      title: "检查",
      description: "流程说明",
    })

    // 关联逻辑阶段，验证视觉缩进不随分组深度增加。
    const groupId = terminal.startGroup({
      title: "阶段",
      description: "阶段说明",
      parentId: flowId,
    })

    terminal.heading({ title: "详情", parentId: groupId })
    terminal.text({ content: "第一行\n\n第二行", parentId: groupId })
    terminal.fields({ items: [{ label: "版本", value: "1.2.3" }], parentId: groupId })
    terminal.list({ items: ["core", "vue"], parentId: groupId })
    terminal.code({ content: "pnpm check", parentId: groupId })
    terminal.summary({
      title: "摘要",
      content: "完整内容",
      code: "pnpm build",
      parentId: groupId,
    })
    terminal.info({ message: "信息" })
    terminal.warning({ message: "警告" })
    terminal.error({ message: "错误" })
    terminal.success({ message: "成功" })
    terminal.endGroup({ groupId, outcome: "success", message: "阶段完成" })
    terminal.endFlow({ flowId, outcome: "success", message: "全部完成" })
    expect(output.raw).toContain("│  详情\n")
    expect(output.raw).toContain("│    版本：1.2.3\n")
    expect(output.raw).toContain("│    • core\n")
    expect(output.raw).toContain("│    pnpm check\n")
    expect(
      output.raw
        .trimEnd()
        .split("\n")
        .every(
          /**
           * 逐物理行验证主线位置或分组缩进。
           * @param line - 按换行符拆分后的单行输出。
           */
          (line) => /^[│╭╰]/.test(line)
        )
    ).toBe(true)
    expect(output.raw).not.toMatch(/[┌┐┘╮╯]/)
  })
  it("深层分组仍使用两档缩进，任务与阶段间隔不累加", async () => {
    // 本场景使用独立终端及其捕获或输入资源。
    const { terminal, output } = fixture()

    // 连续更新父级，验证深层嵌套仍保持两档视觉缩进。
    let parentId: ParentId = terminal.startFlow({
      title: "检查",
      description: "说明",
    })

    // 连续建立多层分组，验证视觉缩进保持两档。
    for (let index = 0; index < 6; index += 1) {
      parentId = terminal.startGroup({
        title: `阶段${index}`,
        description: "说明",
        parentId,
      })
    }

    await terminal.runTask({ title: "a", parentId, execute: async () => {} })
    await terminal.runTask({ title: "b", parentId, execute: async () => {} })
    expect(output.raw).toContain("│    说明\n│\n│\n│  ◆")
    expect(output.raw).toMatch(/✔ 完成 · a · \d+ms\n│\n│ {2}▶ 开始 · b/)
    expect(output.raw).not.toContain("\n│\n│\n│\n")
    expect(
      output.raw
        .split("\n")
        .filter(
          /**
           * 选出分组标题行以验证其视觉缩进。
           * @param line - 按换行符拆分后的单行输出。
           */
          (line) => line.includes("◆")
        )
        .every(
          /**
           * 逐物理行验证主线位置或分组缩进。
           * @param line - 按换行符拆分后的单行输出。
           */
          (line) => line.startsWith("│  ◆")
        )
    ).toBe(true)
  })
  it("任务通过标识定位，结束幂等，跨实例和跨种类标识报错", () => {
    // 本场景使用独立终端及其捕获或输入资源。
    const { terminal, output } = fixture()

    // 独立对照实例，用于验证标识归属和能力隔离。
    const other = fixture().terminal

    // 显式任务标识，用于验证结束定位和幂等性。
    const taskId = terminal.startTask({ title: "任务" })

    terminal.succeedTask({ taskId, message: "完成说明" })
    // 成功后的输出快照，后续重复结束不应追加内容。
    const completed = output.raw

    terminal.failTask({ taskId, error: new Error("late") })
    terminal.cancelTask({ taskId })
    expect(output.raw).toBe(completed)
    expect(() => other.succeedTask({ taskId })).toThrow("不属于")
    // 显式流程标识，供结束反馈或边界校验使用。
    const flowId = terminal.startFlow({ title: "流程" })

    // 运行时也校验类型，防止 JavaScript 消费端混用标识。
    expect(() =>
      Reflect.apply(terminal.succeedTask, undefined, [{ taskId: flowId }])
    ).toThrow("类型不匹配")
  })
  it("手动成功、失败、取消和未执行反馈均可独立组合", () => {
    // 本场景使用独立终端及其捕获或输入资源。
    const { terminal, output } = fixture()

    terminal.failTask({
      taskId: terminal.startTask({ title: "失败" }),
      error: new Error("实际错误"),
    })
    terminal.cancelTask({
      taskId: terminal.startTask({ title: "取消" }),
      reason: "用户取消",
    })
    terminal.skipTask({ title: "跳过", reason: "无脚本" })
    terminal.pendingTask({ target: "core", reason: "未执行" })
    expect(output.raw).toContain("│  ✖ 实际错误")
    expect(output.raw).toContain("✖ 失败 · 失败")
    expect(output.raw).toContain("■ 已取消 · 取消")
    expect(output.raw).toContain("跳过 · 无脚本")
    expect(output.raw).toContain("core · 未执行")
  })
  it("长文本只换行不截断，窄终端的每一行保留导轨", () => {
    // 本场景使用独立终端及其捕获或输入资源。
    const { terminal, output } = fixture()

    output.columns = 18
    // 显式流程标识，供结束反馈或边界校验使用。
    const flowId = terminal.startFlow({ title: "较长的流程标题用于换行" })

    terminal.text({ content: "中文说明👩‍💻".repeat(20) })
    terminal.error({ message: "错误说明".repeat(20) })
    terminal.endFlow({ flowId, outcome: "failed", message: "失败结果".repeat(10) })
    // 逐物理行验证宽度、续行导轨或颜色保留。
    const lines = stripVTControlCharacters(output.raw).trimEnd().split("\n")

    expect(
      lines.every(
        /**
         * 逐物理行检查终端可见列宽。
         * @param line - 按换行符拆分后的单行输出。
         */
        (line) => visibleWidth(line) <= 18
      )
    ).toBe(true)
    expect(
      lines.every(
        /**
         * 逐物理行验证主线位置或分组缩进。
         * @param line - 按换行符拆分后的单行输出。
         */
        (line) => /^[│╭╰]/.test(line)
      )
    ).toBe(true)
    expect(output.raw).not.toContain("…")
  })
  it("runTask 保留回调原值、异常身份且不解释 code 字段", async () => {
    // 本场景使用独立终端及其捕获或输入资源。
    const { terminal, output } = fixture()

    // 原始业务对象，用引用相等验证结果没有转换。
    const value = { code: 17, data: "业务值" }

    expect(await terminal.runTask({ title: "计算", execute: () => value })).toBe(value)
    expect(output.raw).toContain("✔ 完成 · 计算")
    // 保留原始异常引用，验证重新抛出的异常身份。
    const failure = new Error("失败原因")

    await expect(
      terminal.runTask({
        title: "失败操作",
        execute: async () => {
          throw failure
        },
      })
    ).rejects.toBe(failure)
    expect(output.raw.match(/失败原因/g)).toHaveLength(1)
    expect(output.raw).toContain("✖ 失败 · 失败操作")
    // 只检查任务返回值推导，不执行这段类型探针。
    const generic = () =>
      terminal.runTask({ title: "类型", execute: async () => ({ answer: 42 }) })

    expectTypeOf(generic).returns.toEqualTypeOf<
      Promise<{
        /**
         * 业务回调推导出的结果字段，保持原始数值类型。
         */
        answer: number
      }>
    >()
  })
})

describe("命令执行和输出模式", () => {
  it("capture 只采集，不显示正文或任务反馈，保留空白、颜色与回车", async () => {
    // 本场景使用独立终端及其捕获或输入资源。
    const { terminal, output } = fixture()

    // 保留标准输出或验证 spawn 的输出管道边界。
    const stdout = "\u001B[36mfirst\n\n" + "x".repeat(300) + "\rpartial\u001B[0m"

    // 分别断言命令原始退出状态、终止信号及输出。
    const result = await terminal.executeCommand({
      command: process.execPath,
      args: [
        "-e",
        `process.stdout.write(${JSON.stringify(stdout)}); process.stderr.write("warning"); process.exitCode = 2`,
      ],
      outputMode: "capture",
    })

    expect(result.exitCode).toBe(2)
    expect(result.signal).toBeNull()
    expect(result.stdout).toBe(stdout)
    expect(result.stderr).toBe("warning")
    expect(result.output).toContain(stdout)
    expect(result.output).toContain("warning")
    expect(output.raw).toBe("")
  })
  it("命令参数覆盖实例目录及环境，支持 stdin 文本", async () => {
    // 本场景使用独立终端及其捕获或输入资源。
    const { terminal } = fixture({ env: { TERMINAL_VALUE: "factory" }, cwd: "/" })

    // 分别断言命令原始退出状态、终止信号及输出。
    const result = await terminal.executeCommand({
      command: process.execPath,
      args: [
        "-e",
        'let text=""; process.stdin.on("data",c=>text+=c); process.stdin.on("end",()=>process.stdout.write(JSON.stringify([process.cwd(), process.env.TERMINAL_VALUE, text])))',
      ],
      env: { TERMINAL_VALUE: "command" },
      cwd: process.cwd(),
      input: "输入值",
      outputMode: "capture",
    })

    expect(JSON.parse(result.stdout)).toEqual([process.cwd(), "command", "输入值"])
  })
  it("runCommand 自动组合任务反馈，非零退出返回结果，不重复回放采集日志", async () => {
    // 本场景使用独立终端及其捕获或输入资源。
    const { terminal, output } = fixture()

    // 分别断言命令原始退出状态、终止信号及输出。
    const result = await terminal.runCommand({
      title: "build",
      target: "core",
      command: process.execPath,
      args: ["-e", 'process.stdout.write("captured"); process.exitCode = 3'],
      outputMode: "capture",
    })

    expect(result.exitCode).toBe(3)
    expect(result.stdout).toBe("captured")
    expect(output.raw).toContain("▶ 开始 · core · build")
    expect(output.raw).toContain("✖ 失败 · core · build")
    expect(output.raw).toContain("exit 3")
    expect(output.raw).not.toContain("captured")
  })
  it("命令无法启动时保留原始异常并显示失败", async () => {
    // 本场景使用独立终端及其捕获或输入资源。
    const { terminal, output } = fixture()

    await expect(
      terminal.runCommand({ title: "不存在", command: "/__terminal_missing_command__" })
    ).rejects.toMatchObject({ code: "ENOENT" })
    expect(output.raw).toContain("✖ 失败 · 不存在")
  })
  it("销毁时中止自有命令，保留 AbortError 且不在销毁后追加反馈", async () => {
    // 本场景使用独立终端及其捕获或输入资源。
    const { terminal, output } = fixture()

    // 保存运行中 Promise，再触发释放以检查取消传播。
    const operation = terminal.runCommand({
      title: "服务",
      command: process.execPath,
      args: ["-e", "setInterval(()=>{},1000)"],
      outputMode: "capture",
    })

    terminal.dispose()
    // 操作前快照，用于验证输出或监听没有额外变化。
    const before = output.raw

    await expect(operation).rejects.toMatchObject({ name: "AbortError" })
    expect(output.raw).toBe(before)
  })
  it("信号终止与退出码分开返回", async () => {
    // 本场景使用独立终端及其捕获或输入资源。
    const { terminal } = fixture()

    // 分别断言命令原始退出状态、终止信号及输出。
    const result = await terminal.executeCommand({
      command: process.execPath,
      args: ["-e", 'process.kill(process.pid,"SIGINT")'],
      outputMode: "capture",
    })

    expect(result.exitCode).toBeNull()
    expect(result.signal).toBe("SIGINT")
  })
  it.each(["inherit", "tee"] as const)(
    "%s 使用原始流且结束标记不粘连尾部半行",
    /**
     * 分别验证两种可见输出模式的原始透传和主线恢复。
     * @param mode - 当前场景使用的 inherit 或 tee 模式。
     */
    async (mode) => {
      // 原生日志样本包含颜色、空行、长行、回车和尾部半行。
      const native = "\u001B[36mfirst\n\n" + "x".repeat(300) + "\rpartial\u001B[0m"

      // 没有尾部换行的诊断样本，用于验证主线恢复边界。
      const diagnostic = "\u001B[31merror: original\u001B[0m"

      // 在隔离进程内运行原生输出和结果标记。
      const program = `import { createTerminal } from ${JSON.stringify(entry)};
const terminal=createTerminal({handleSignals:false});
const result=await terminal.runCommand({title:"build",command:process.execPath,args:["-e",${JSON.stringify(`process.stdout.write(${JSON.stringify(native)});process.stderr.write(${JSON.stringify(diagnostic)});process.exitCode=2`)}],outputMode:${JSON.stringify(mode)}});
process.stdout.write("\\nRESULT="+JSON.stringify(result));terminal.dispose();`

      // 仅捕获隔离进程输出，不接管测试宿主信号。
      const outer = createTerminal({ handleSignals: false })

      terminals.push(outer)
      // 分别断言命令原始退出状态、终止信号及输出。
      const result = await outer.executeCommand({
        command: process.execPath,
        args: ["--input-type=module", "-e", program],
        outputMode: "capture",
        env: { NO_COLOR: "1" },
      })

      expect(result.stdout.startsWith(native)).toBe(true)
      expect(result.stderr).toContain(`${diagnostic}\n│  ✖ 失败 · build`)
      expect(result.stderr.match(/error: original/g)).toHaveLength(1)
      // 从独立结果标记后解析采集数据，不将展示日志当作结果。
      const machine = JSON.parse(
        result.stdout.slice(result.stdout.indexOf("RESULT=") + 7)
      )

      expect(machine.stdout).toBe(mode === "tee" ? native : "")
      expect(machine.stderr).toBe(mode === "tee" ? diagnostic : "")
    }
  )
  it("服务运行中即可收到原生日志，退出后才出现结束标记", async () => {
    // 隔离实时输出或信号处理场景，避免影响测试宿主。
    const source = `import {createTerminal} from ${JSON.stringify(entry)};
const terminal=createTerminal({handleSignals:false});const release=new Promise(resolve=>process.once("message",resolve));
await terminal.runTask({title:"dev",execute:async()=>{await terminal.executeCommand({command:process.execPath,args:["-e",'process.stdout.write("ready")']});await release;}});terminal.dispose();`

    // 真实子进程承载事件及信号场景，finally 中负责结束。
    const child = spawn(process.execPath, ["--input-type=module", "-e", source], {
      stdio: ["ignore", "pipe", "pipe", "ipc"],
      env: { ...process.env, NO_COLOR: "1" },
    })

    // 收集子进程反馈，检查时机、顺序和重复次数。
    let stderr = ""

    // 保留运行期间收到的标准输出，等待完整就绪标记。
    let stdout = ""

    /**
     * 按到达顺序收集标准错误，验证清理日志与结束标记的先后。
     * @param chunk - 子进程当前发出的标准错误数据块。
     */
    const collectStderr = (chunk: Buffer): void => {
      stderr += String(chunk)
    }

    child.stderr?.on("data", collectStderr)
    // 发送结束请求前订阅 close，避免错过进程完成事件。
    const finished = once(child, "close")

    try {
      await new Promise<void>(
        /**
         * 将事件驱动的完成结果转换为可等待的 Promise。
         * @param resolve - 操作完成后结算当前等待。
         * @param reject - 将操作错误保留给调用方。
         */ (resolve, reject) => {
          child.once("error", reject)
          /**
           * 收到完整就绪标记时解除等待，服务此时仍保持运行。
           * @param chunk - 子进程当前发出的标准输出数据块。
           */
          const collectStdout = (chunk: Buffer): void => {
            stdout += String(chunk)
            if (stdout === "ready") {
              resolve()
            }
          }

          child.stdout?.on("data", collectStdout)
        }
      )
      expect(child.exitCode).toBeNull()
      expect(stderr).not.toContain("✔ 完成")
      child.send("finish")
      expect((await finished)[0]).toBe(0)
      expect(stderr).toContain("✔ 完成 · dev")
    } finally {
      if (child.exitCode === null) {
        child.kill("SIGKILL")
      }
    }
  })
})

describe("信号清理", () => {
  it("交互 raw mode 中的 Ctrl+C 也等待外部清理，并注销自有按键监听", async () => {
    // 隔离实时输出或信号处理场景，避免影响测试宿主。
    const source = `import {PassThrough} from "node:stream";
import {createTerminal} from ${JSON.stringify(entry)};
const input=new PassThrough();Object.assign(input,{isTTY:true,setRawMode:()=>{}});Object.assign(process.stderr,{isTTY:true});
const terminal=createTerminal({input,env:{CI:"false"}});
terminal.onSignal({listener:async()=>{await new Promise(resolve=>setTimeout(resolve,30));terminal.text({content:"prompt cleanup complete"});}});
const operation=terminal.select({title:"请选择",options:[{value:"core",label:"Core"}]});
input.emit("keypress","\\u0003",{name:"c",ctrl:true});await operation;`

    // 本场景使用独立终端及其捕获或输入资源。
    const { terminal } = fixture()

    // 分别断言命令原始退出状态、终止信号及输出。
    const result = await terminal.executeCommand({
      command: process.execPath,
      args: ["--input-type=module", "-e", source],
      env: { NO_COLOR: "1" },
      outputMode: "capture",
    })

    expect(result.exitCode).toBe(130)
    expect(result.stderr).toContain("prompt cleanup complete")
    expect(result.stderr).not.toContain("AbortError")
    expect(result.stderr.indexOf("prompt cleanup complete")).toBeLessThan(
      result.stderr.indexOf("╰─ ■ 已取消")
    )
  })

  it("真实子进程取消后等待外部清理，不让顶层 AbortError 提前退出", async () => {
    // 隔离实时输出或信号处理场景，避免影响测试宿主。
    const source = `import {createTerminal} from ${JSON.stringify(entry)};
const terminal=createTerminal();terminal.onSignal({listener:async()=>{await new Promise(resolve=>setTimeout(resolve,40));terminal.text({content:"native cleanup complete"});}});
const flowId=terminal.startFlow({title:"服务"});
await terminal.runCommand({title:"dev",parentId:flowId,command:process.execPath,args:["-e",'process.stdout.write("ready");setInterval(()=>{},1000)']});
terminal.endFlow({flowId,outcome:"success",message:"unexpected success"});terminal.dispose();`

    // 真实子进程承载事件及信号场景，finally 中负责结束。
    const child = spawn(process.execPath, ["--input-type=module", "-e", source], {
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, NO_COLOR: "1" },
    })

    // 收集子进程反馈，检查时机、顺序和重复次数。
    let stderr = ""

    /**
     * 按到达顺序收集标准错误，验证清理日志与结束标记的先后。
     * @param chunk - 子进程当前发出的标准错误数据块。
     */
    const collectStderr = (chunk: Buffer): void => {
      stderr += String(chunk)
    }

    child.stderr?.on("data", collectStderr)
    // 发送结束请求前订阅 close，避免错过进程完成事件。
    const finished = once(child, "close")

    try {
      // spawn 的 stdio 配置要求 stdout 为管道，在边界显式验证。
      const stdout = child.stdout

      if (stdout === null) {
        throw new Error("测试子进程未提供 stdout 管道。")
      }

      await once(stdout, "data")
      child.kill("SIGINT")
      expect((await finished)[0]).toBe(130)
      expect(stderr.indexOf("native cleanup complete")).toBeLessThan(
        stderr.indexOf("■ 已取消")
      )
      expect(stderr).toContain("服务已取消")
      expect(stderr).not.toContain("AbortError")
      expect(stderr).not.toContain("unexpected success")
      expect(stderr.match(/■ 已取消/g)).toHaveLength(1)
    } finally {
      if (child.exitCode === null) {
        child.kill("SIGKILL")
      }
    }
  })

  it("等待异步外部清理、忽略重复信号、容忍监听异常且只输出一次取消", async () => {
    // 隔离实时输出或信号处理场景，避免影响测试宿主。
    const source = `import {createTerminal} from ${JSON.stringify(entry)};
const terminal=createTerminal();const unsubscribe=terminal.onSignal({listener:()=>terminal.text({content:"should not run"})});unsubscribe();unsubscribe();
terminal.onSignal({listener:async()=>{process.send?.("cleaning");await new Promise(resolve=>setTimeout(resolve,40));terminal.text({content:"cleanup complete"});terminal.dispose();}});
terminal.onSignal({listener:()=>{throw new Error("cleanup failed")}});
terminal.onSignal({listener:()=>terminal.text({content:"last cleanup"})});
await terminal.runTask({title:"dev",execute:async()=>{process.stdout.write("ready");await new Promise(()=>setInterval(()=>{},1000));}});`

    // 真实子进程承载事件及信号场景，finally 中负责结束。
    const child = spawn(process.execPath, ["--input-type=module", "-e", source], {
      stdio: ["ignore", "pipe", "pipe", "ipc"],
      env: { ...process.env, NO_COLOR: "1" },
    })

    // 收集子进程反馈，检查时机、顺序和重复次数。
    let stderr = ""

    /**
     * 按到达顺序收集标准错误，验证清理日志与结束标记的先后。
     * @param chunk - 子进程当前发出的标准错误数据块。
     */
    const collectStderr = (chunk: Buffer): void => {
      stderr += String(chunk)
    }

    child.stderr?.on("data", collectStderr)
    // 发送结束请求前订阅 close，避免错过进程完成事件。
    const finished = once(child, "close")

    child.once("message", () => {
      child.kill("SIGTERM")
    })
    try {
      // spawn 的 stdio 配置要求 stdout 为管道，在边界显式验证。
      const stdout = child.stdout

      if (stdout === null) {
        throw new Error("测试子进程未提供 stdout 管道。")
      }

      await once(stdout, "data")
      child.kill("SIGINT")
      expect((await finished)[0]).toBe(130)
      expect(stderr).toContain("cleanup failed")
      expect(stderr).not.toContain("should not run")
      expect(stderr.indexOf("last cleanup")).toBeLessThan(stderr.indexOf("■ 已取消"))
      expect(stderr.match(/■ 已取消/g)).toHaveLength(1)
      expect(stderr).not.toContain("✔ 完成")
    } finally {
      if (child.exitCode === null) {
        child.kill("SIGKILL")
      }
    }
  })
})

describe("等待状态动画", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  /**
   * 使用真实输出能力判断动画，不伪造 stdin 的交互能力。
   * @param env - 本场景的终端和 CI 环境覆盖。
   */
  function animatedFixture(env: NodeJS.ProcessEnv = {}) {
    const output = new Capture()

    output.isTTY = true
    const terminal = createTerminal({
      output,
      env: { CI: "false", NO_COLOR: "1", TERM: "xterm-256color", ...env },
      handleSignals: false,
    })

    terminals.push(terminal)

    return { terminal, output }
  }

  it("短于 150ms 的任务不出现动画，长任务持续更新且完成后停止", async () => {
    const { terminal, output } = animatedFixture()

    const short = terminal.startTask({ title: "短任务" })

    vi.advanceTimersByTime(149)
    terminal.succeedTask({ taskId: short })
    vi.advanceTimersByTime(500)
    expect(output.raw).not.toContain("⠋")
    expect(vi.getTimerCount()).toBe(0)

    let finish = (): void => {}

    const operation = terminal.runTask({
      title: "等待查询",
      execute: () =>
        new Promise<void>((resolve) => {
          finish = resolve
        }),
    })

    vi.advanceTimersByTime(150)
    expect(output.raw).toContain("⠋ 等待查询")
    vi.advanceTimersByTime(80)
    expect(output.raw).toContain("⠙ 等待查询")
    finish()
    await operation

    const completed = output.raw

    vi.advanceTimersByTime(1000)
    expect(output.raw).toBe(completed)
    expect(output.raw).toContain("✔ 完成 · 等待查询")
    expect(output.raw).toContain("\u001B[?25h")
    expect(vi.getTimerCount()).toBe(0)
  })

  it("子任务拥有唯一动画，结束后恢复父任务，消息不会被覆盖", () => {
    const { terminal, output } = animatedFixture()

    const parent = terminal.startTask({ title: "父任务" })

    vi.advanceTimersByTime(150)
    const child = terminal.startTask({ title: "子任务", parentId: parent })

    vi.advanceTimersByTime(150)
    expect(output.raw).toContain("⠋ 子任务")
    terminal.succeedTask({ taskId: child })
    vi.advanceTimersByTime(150)
    expect(output.raw.slice(output.raw.lastIndexOf("\r"))).toContain("父任务")
    terminal.text({ content: "保持这条日志" })
    vi.advanceTimersByTime(80)
    expect(output.raw).toContain("保持这条日志\n")
    terminal.succeedTask({ taskId: parent })
    expect(vi.getTimerCount()).toBe(0)
  })

  it.each(["CI", "TERM"])("%s 禁用动画但保留任务状态", (name) => {
    const { terminal, output } = animatedFixture(
      name === "CI" ? { CI: "true" } : { TERM: "dumb" }
    )

    const taskId = terminal.startTask({ title: "检查" })

    vi.advanceTimersByTime(1000)
    terminal.succeedTask({ taskId })
    expect(output.raw).not.toContain("\u001B[")
    expect(output.raw).toContain("✔ 完成")
    expect(vi.getTimerCount()).toBe(0)
  })

  it("非 TTY 输出保持静态，失败、取消和释放均清理定时器", () => {
    const plain = fixture({ env: { CI: "false" } })

    const plainId = plain.terminal.startTask({ title: "静态" })

    vi.advanceTimersByTime(500)
    plain.terminal.succeedTask({ taskId: plainId })
    expect(plain.output.raw).not.toContain("\u001B[")

    for (const outcome of ["failure", "cancel", "dispose"]) {
      const { terminal, output } = animatedFixture()

      const taskId = terminal.startTask({ title: "等待" })

      vi.advanceTimersByTime(150)

      if (outcome === "failure") {
        terminal.failTask({ taskId, error: new Error("出错") })
      } else if (outcome === "cancel") {
        terminal.cancelTask({ taskId })
      } else {
        terminal.dispose()
        terminal.dispose()
      }

      const completed = output.raw

      vi.advanceTimersByTime(1000)
      expect(output.raw).toBe(completed)
      expect(output.raw).toContain("\u001B[?25h")
      expect(vi.getTimerCount()).toBe(0)
    }
  })

  it("异步回调异常保持原始错误并结束动画", async () => {
    const { terminal, output } = animatedFixture()

    const failure = new Error("原始错误")

    const operation = terminal.runTask({
      title: "失败查询",
      execute: async () => {
        await new Promise((resolve) => setTimeout(resolve, 300))
        throw failure
      },
    })

    const rejected = expect(operation).rejects.toBe(failure)

    await vi.advanceTimersByTimeAsync(300)
    await rejected
    expect(output.raw).toContain("✖ 失败 · 失败查询")
    expect(vi.getTimerCount()).toBe(0)
  })

  it("托管日志保留字节和通道，半行期间停止动画，换行后恢复", () => {
    const output = new Capture()

    output.isTTY = true
    const renderer = createRenderer({
      output,
      env: { CI: "false" },
      format: (content) => content,
    })

    const chunks: string[] = []

    vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      chunks.push(String(chunk))

      return true
    })
    renderer.setLoading("托管命令")
    vi.advanceTimersByTime(150)
    renderer.beginNative()
    renderer.writeNative("partial\rcolor", "stdout")
    const partial = output.raw

    vi.advanceTimersByTime(1000)
    expect(output.raw).toBe(partial)
    renderer.writeNative("\n", "stdout")
    vi.advanceTimersByTime(150)
    expect(output.raw.slice(output.raw.lastIndexOf("\r"))).toContain("托管命令")
    expect(chunks.join("")).toBe("partial\rcolor\n")
    renderer.endNative()
    renderer.dispose()
    expect(vi.getTimerCount()).toBe(0)
  })

  it("原生 TTY 和嵌套暂停不会被动画抢占，取消清理重新取得反馈", () => {
    const output = new Capture()

    output.isTTY = true
    const renderer = createRenderer({
      output,
      env: { CI: "false" },
      format: (content) => content,
    })

    renderer.setLoading("父任务")
    vi.advanceTimersByTime(150)
    const resumeParent = renderer.pauseLoading()

    const resumeChild = renderer.pauseLoading()

    const paused = output.raw

    vi.advanceTimersByTime(1000)
    resumeChild()
    vi.advanceTimersByTime(500)
    expect(output.raw).toBe(paused)
    resumeParent()
    vi.advanceTimersByTime(150)
    expect(output.raw).toContain("⠋ 父任务")
    renderer.pauseLoading()
    renderer.beginCleanup()
    vi.advanceTimersByTime(150)
    expect(output.raw.slice(output.raw.lastIndexOf("\r"))).toContain("正在取消，等待清理")
    renderer.dispose()
    expect(vi.getTimerCount()).toBe(0)
  })

  it("原生 TTY 的半行日志保留完整，恢复父任务前先建立新行", () => {
    const output = new Capture()

    output.isTTY = true
    const renderer = createRenderer({
      output,
      env: { CI: "false" },
      format: (content) => content,
    })

    renderer.setLoading("父任务")
    const resume = renderer.pauseLoading()

    renderer.beginNative()
    const before = output.raw

    renderer.endNative(true)
    expect(output.raw.slice(before.length)).toBe("\n")
    resume()
    vi.advanceTimersByTime(150)
    expect(output.raw.slice(output.raw.lastIndexOf("\r"))).toContain("父任务")
    renderer.dispose()
    expect(vi.getTimerCount()).toBe(0)
  })

  it("窄终端内动画只占一行，尺寸变化后按新宽度绘制", () => {
    const { terminal, output } = animatedFixture()

    output.columns = 16
    const taskId = terminal.startTask({ title: "中文说明👩‍💻".repeat(10) })

    vi.advanceTimersByTime(150)
    expect(
      visibleWidth(
        stripVTControlCharacters(output.raw.slice(output.raw.lastIndexOf("\r")))
      )
    ).toBeLessThanOrEqual(16)
    output.columns = 10
    vi.advanceTimersByTime(80)
    expect(
      visibleWidth(
        stripVTControlCharacters(output.raw.slice(output.raw.lastIndexOf("\r")))
      )
    ).toBeLessThanOrEqual(10)
    terminal.succeedTask({ taskId })
  })
})

describe("原生终端能力", () => {
  it.skipIf(process.platform === "win32")(
    "工作流默认继承原始输入输出句柄，并保持颜色和日志布局",
    async () => {
      const { terminal } = fixture()

      const presentation = new URL("../../presentation.ts", import.meta.url).href

      const native =
        "\u001B[32mnative-color\u001B[39m\n\n  native-column\nnative-progress\rdone\n"

      const childSource = `const { fstatSync } = require("node:fs");
const expected = JSON.parse(process.argv[1]);
const matches = [0, 1, 2].every(fd => {
  const actual = fstatSync(fd);
  return ["dev", "ino", "rdev", "mode"].every(key => actual[key] === expected[fd][key]);
});
if (!matches) process.exit(2);
process.stdout.write(${JSON.stringify(native)});`

      const source = `import { fstatSync } from "node:fs";
import { createTerminal } from ${JSON.stringify(entry)};
import { runWorkflowCommand } from ${JSON.stringify(presentation)};
const terminal = createTerminal({ handleSignals: false });
const descriptors = [0, 1, 2].map(fd => {
  const stats = fstatSync(fd);
  return { dev: stats.dev, ino: stats.ino, rdev: stats.rdev, mode: stats.mode };
});
try {
  process.exitCode = await runWorkflowCommand({
    terminal, title: "原生命令", command: process.execPath,
    args: ["-e", ${JSON.stringify(childSource)}, JSON.stringify(descriptors)],
  });
} finally { terminal.dispose(); }`

      const result = await terminal.executeCommand({
        command: process.execPath,
        args: ["--input-type=module", "-e", source],
        outputMode: "capture",
      })

      expect(result.exitCode, result.output).toBe(0)
      expect(result.stdout).toBe(native)
      expect(result.stderr).toContain("✔ 完成 · 原生命令")
    }
  )
})

describe("真实异步操作的 loading 生命周期", () => {
  it("采集子进程等待时显示动画，机器输出保持原值", async () => {
    const output = new Capture()

    output.isTTY = true
    const terminal = createTerminal({
      output,
      env: { CI: "false", TERM: "xterm-256color", NO_COLOR: "1" },
      handleSignals: false,
    })

    terminals.push(terminal)
    const result = await terminal.runCommand({
      title: "等待子进程",
      command: process.execPath,
      args: [
        "-e",
        `setTimeout(()=>process.stdout.write(${JSON.stringify("machine-data\n")}),350)`,
      ],
      outputMode: "capture",
    })

    expect(result.stdout).toBe("machine-data\n")
    expect(result.stderr).toBe("")
    expect(output.raw).toContain("⠋ 等待子进程")
    expect(output.raw).toContain("✔ 完成 · 等待子进程")
    expect(output.raw).not.toContain("machine-data")
  })

  it("系统取消清理期间持续反馈，最后恢复光标并返回信号退出码", async () => {
    const source = `import {createTerminal} from ${JSON.stringify(entry)};
Object.defineProperty(process.stderr,"isTTY",{value:true});
const terminal=createTerminal({env:{CI:"false",TERM:"xterm-256color",NO_COLOR:"1"}});
const keepAlive=setInterval(()=>{},1000);
terminal.onSignal({listener:async()=>{terminal.text({content:"cleanup-start"});await new Promise(resolve=>setTimeout(resolve,260));terminal.text({content:"cleanup-done"});}});
await terminal.runTask({title:"等待操作",execute:async()=>{process.stdout.write("ready");await new Promise(()=>{});}});`

    const child = spawn(process.execPath, ["--input-type=module", "-e", source], {
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, NO_COLOR: "1" },
    })

    let stderr = ""

    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString()
    })
    const finished = once(child, "close")

    try {
      const stdout = child.stdout

      if (!stdout) {
        throw new Error("测试进程没有标准输出管道。")
      }

      await once(stdout, "data")
      child.kill("SIGTERM")
      const [code] = await finished

      expect(code).toBe(143)
      expect(stderr.indexOf("正在取消，等待清理")).toBeGreaterThan(
        stderr.indexOf("cleanup-start")
      )
      expect(stderr.indexOf("cleanup-done")).toBeGreaterThan(
        stderr.indexOf("正在取消，等待清理")
      )
      expect(stderr.indexOf("■ 已取消")).toBeGreaterThan(stderr.indexOf("cleanup-done"))
      expect(stderr.split("\u001B[?25l").length).toBe(stderr.split("\u001B[?25h").length)
    } finally {
      if (child.exitCode === null) {
        child.kill("SIGKILL")
      }
    }
  })
})
