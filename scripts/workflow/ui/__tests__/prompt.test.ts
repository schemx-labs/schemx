/**
 * 公开交互 API 的值推导、输入绑定、取消与主题隔离。
 */
import { PassThrough, Writable } from "node:stream"

import * as clack from "@clack/prompts"
import { afterEach, describe, expect, expectTypeOf, it, vi } from "vite-plus/test"

import { createTerminal } from "../index.ts"

import type { Terminal } from "../index.ts"

// 在模块 mock 提升阶段创建统一取消哨兵。
const { cancel } = vi.hoisted(() => ({ cancel: Symbol("cancel") }))

vi.mock("@clack/prompts", () => ({
  select: vi.fn(),
  multiselect: vi.fn(),
  groupMultiselect: vi.fn(),
  text: vi.fn(),
  confirm: vi.fn(),
  /**
   * 模拟 Clack 的取消哨兵，避免实际读取终端。
   * @param value - 控件返回的选择值或取消哨兵。
   */
  isCancel: (value: unknown) => value === cancel,
}))
// 集中登记测试实例，在 afterEach 中释放监听和适配流。
const instances: Terminal[] = []

/**
 * 创建独立的可交互输入和输出，不修改 process.stdin。
 * @param interactive - 是否模拟输入与输出均为 TTY 的交互环境。
 */
function fixture(interactive = true) {
  // 保留完整输出，断言控制序列、物理换行和导轨连接。
  let raw = ""

  // 独立模拟交互输入，避免改变进程自身的 stdin。
  const input = new PassThrough()

  // 收集适配后的完整控件输出，便于检查控制序列。
  const output = new Writable({
    /**
     * 收集控件经适配后的完整输出。
     * @param chunk - 控件写入的当前数据块。
     * @param _encoding - Writable 编码参数，统一按字符串读取。
     * @param done - 完成本次写入。
     */
    write(chunk, _encoding, done) {
      raw += String(chunk)
      done()
    },
  })

  Object.assign(input, { isTTY: interactive })
  Object.assign(output, { isTTY: interactive, columns: 42, rows: 24 })
  // 将场景配置绑定到独立实例，并交由统一清理处理。
  const terminal = createTerminal({
    input,
    output,
    env: { NO_COLOR: "1", CI: "false", TERM: "xterm-256color" },
    handleSignals: false,
  })

  instances.push(terminal)
  // 读取当前捕获内容，供控件重绘后的同步断言使用。
  const read = (): string => raw

  return { terminal, input, output, read }
}

afterEach(() => {
  // 每个测试释放自身创建的实例，避免流监听泄漏到后续场景。
  for (const terminal of instances.splice(0)) {
    terminal.dispose()
  }

  vi.clearAllMocks()
  vi.useRealTimers()
})

describe("交互绑定", () => {
  it("所有控件共用本实例的输入、适配输出和取消信号", async () => {
    // 当前场景使用独立终端及其输入或捕获资源。
    const { terminal, input } = fixture()

    // 保留原始业务对象，用引用相等验证终端未转换结果。
    const value = { key: "core" }

    vi.mocked(clack.select).mockResolvedValue(value)
    vi.mocked(clack.multiselect).mockResolvedValue([value])
    vi.mocked(clack.groupMultiselect).mockResolvedValue([value])
    vi.mocked(clack.text).mockResolvedValue("beta")
    vi.mocked(clack.confirm).mockResolvedValue(true)
    expect(
      await terminal.select({ title: "目标", options: [{ value, label: "Core" }] })
    ).toBe(value)
    expect(
      await terminal.multiselect({ title: "目标", options: [{ value, label: "Core" }] })
    ).toEqual([value])
    expect(
      await terminal.groupMultiselect({
        title: "目标",
        groups: [{ title: "Packages", options: [{ value, label: "Core" }] }],
      })
    ).toEqual([value])
    expect(await terminal.input({ title: "版本", placeholder: "beta" })).toBe("beta")
    expect(await terminal.confirm({ title: "继续" })).toBe(true)
    // 取得单选控件实际绑定的输出，作为其他控件的共享资源基准。
    const output = vi.mocked(clack.select).mock.calls[0]?.[0].output

    // 逐个验证控件共用同一实例的输入、输出和取消信号。
    for (const control of [
      clack.select,
      clack.multiselect,
      clack.groupMultiselect,
      clack.text,
      clack.confirm,
    ]) {
      expect(control).toHaveBeenCalledWith(
        expect.objectContaining({
          input,
          output,
          withGuide: true,
          signal: expect.any(AbortSignal),
        })
      )
    }

    expect(output).toMatchObject({ isTTY: true, columns: 42, rows: 24 })
    // 只通过类型断言验证候选字面量与返回值的关联，不实际启动控件。
    const selectLiteral = () =>
      terminal.select({
        title: "类型",
        options: [
          { value: 1, label: "one" },
          { value: 2, label: "two" },
        ] as const,
      })

    expectTypeOf(selectLiteral).returns.toEqualTypeOf<Promise<1 | 2>>()
  })
  it("取消使用通用 AbortError；非交互确认只有显式 assumeYes 才通过", async () => {
    // 当前场景使用独立终端及其输入或捕获资源。
    const { terminal } = fixture()

    vi.mocked(clack.select).mockResolvedValue(cancel)
    await expect(terminal.select({ title: "目标", options: [] })).rejects.toMatchObject({
      name: "AbortError",
    })
    // 独立的对照实例，用于验证实例间的状态与能力隔离。
    const other = fixture(false).terminal

    await expect(other.confirm({ title: "继续", assumeYes: true })).resolves.toBe(true)
    await expect(other.confirm({ title: "继续" })).rejects.toThrow("不支持交互")
  })
  it("导轨保留控制序列、统一颜色并承接后续流程；正文中的竖线不变", async () => {
    // 当前场景使用独立终端及其输入或捕获资源。
    const { terminal, read } = fixture()

    vi.mocked(clack.select).mockImplementation(
      /**
       * 模拟控件向实例绑定的输出流写入重绘内容。
       * @param options - 终端包装层实际传给控件的问题和输入输出资源。
       */
      async (options) => {
        options.output?.write(
          "\u001B[999D\u001B[2A\u001B[J\u001B[36m│\u001B[39m\n◇  请选择目标\n│  first │ second\n└\n"
        )

        return "core"
      }
    )
    await terminal.select({ title: "目标", options: [{ value: "core", label: "Core" }] })
    terminal.startFlow({ title: "检查" })
    expect(read()).toContain("\u001B[999D\u001B[2A\u001B[J│")
    expect(read()).toContain("│  first │ second\n│\n│\n├─ 检查")
    expect(read()).not.toContain("└")
  })
  it("尺寸变化与 dispose 仅影响本实例的适配器", async () => {
    // 当前场景使用独立终端及其输入或捕获资源。
    const { terminal, output } = fixture()

    vi.mocked(clack.select).mockResolvedValue("core")
    await terminal.select({ title: "目标", options: [{ value: "core", label: "Core" }] })
    // 取得控件实际收到的中间流，验证尺寸和监听的转发。
    const adapted = vi.mocked(clack.select).mock.calls[0]?.[0].output

    // 记录窗口尺寸事件，确认只转发一次。
    const resize = vi.fn()

    adapted?.on("resize", resize)
    Object.assign(output, { columns: 27 })
    output.emit("resize")
    expect(adapted).toMatchObject({ columns: 27 })
    expect(resize).toHaveBeenCalledOnce()
    terminal.dispose()
    terminal.dispose()
    expect(output.listenerCount("resize")).toBe(0)
  })
})

describe("交互与任务动画", () => {
  it("选择框独占光标，选择完成后恢复父任务", async () => {
    vi.useFakeTimers()
    const { terminal, read } = fixture()

    const taskId = terminal.startTask({ title: "父任务" })

    vi.advanceTimersByTime(150)
    expect(read()).toContain("⠋ 父任务")

    let finish = (): void => {}

    vi.mocked(clack.select).mockImplementationOnce(async () => {
      await new Promise<void>((resolve) => {
        finish = resolve
      })

      return "core"
    })
    const selection = terminal.select({
      title: "选择目标",
      options: [{ value: "core", label: "Core" }],
    })

    const prompting = read()

    vi.advanceTimersByTime(1000)
    expect(read()).toBe(prompting)
    finish()
    await expect(selection).resolves.toBe("core")
    vi.advanceTimersByTime(150)
    expect(read().slice(read().lastIndexOf("\r"))).toContain("父任务")
    terminal.succeedTask({ taskId })
    expect(vi.getTimerCount()).toBe(0)
  })
})
