/**
 * 发布输入适配器测试。
 *
 * 回归重点：交互式选择 `custom` 时原实现直接返回了 `select` 的原始结果，把占位值
 * `custom` 当成版本动作交给下游，于是计划生成阶段报「无效版本动作：custom」，
 * 而非交互路径（参数或 `SCHEMX_RELEASE_CUSTOM_VERSION`）却是正常的。两条路径必须收敛
 * 到同一套归一化逻辑。
 */
import { Writable } from "node:stream"

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { Ui } from "../ui/ui.ts"

const clackSelect = vi.fn()

const clackText = vi.fn()

vi.mock("@clack/prompts", () => ({
  confirm: vi.fn(),
  groupMultiselect: vi.fn(),
  isCancel: () => false,
  multiselect: vi.fn(),
  select: (options: unknown) => clackSelect(options),
  text: (options: unknown) => clackText(options),
}))

const { selectVersionAction } = await import("./inputs.ts")

/**
 * 构造一个处于交互模式的 Ui。
 *
 * @param env - 环境变量。
 * @returns UI 实例。
 */
function interactiveUi(env: NodeJS.ProcessEnv = {}): Ui {
  const out = new Writable({
    write(_chunk, _encoding, done) {
      done()
    },
  }) as Writable & { isTTY: boolean }

  out.isTTY = true

  return new Ui(out, { ...env }, { signals: false })
}

let stdin: { isTTY?: boolean }

beforeEach(() => {
  stdin = { isTTY: true }
  Object.defineProperty(process, "stdin", { configurable: true, value: stdin })
  clackSelect.mockReset()
  clackText.mockReset()
})

afterEach(() => {
  Object.defineProperty(process, "stdin", { configurable: true, value: stdin })
})

describe("selectVersionAction", () => {
  it("交互选择 custom 时继续询问精确版本", async () => {
    clackSelect.mockResolvedValue("custom")
    clackText.mockResolvedValue("2.4.0")

    const action = await selectVersionAction(interactiveUi(), "beta", "")

    expect(action).toBe("2.4.0")
    expect(clackText).toHaveBeenCalledTimes(1)
  })

  it("交互选择 custom 时优先采用环境变量中的版本基线", async () => {
    clackSelect.mockResolvedValue("custom")

    const action = await selectVersionAction(
      interactiveUi({ SCHEMX_RELEASE_CUSTOM_VERSION: "1.9.3" }),
      "beta",
      ""
    )

    expect(action).toBe("1.9.3")
    expect(clackText).not.toHaveBeenCalled()
  })

  it("交互选择普通动作时不再询问版本", async () => {
    clackSelect.mockResolvedValue("patch")

    const action = await selectVersionAction(interactiveUi(), "beta", "")

    expect(action).toBe("patch")
    expect(clackText).not.toHaveBeenCalled()
  })

  it("命令行传入 custom 时归一化为精确版本", async () => {
    const action = await selectVersionAction(
      interactiveUi({ SCHEMX_RELEASE_CUSTOM_VERSION: "3.1.4" }),
      "beta",
      "custom"
    )

    expect(action).toBe("3.1.4")
    expect(clackSelect).not.toHaveBeenCalled()
  })

  it("命令行传入非法动作时以用法错误终止", async () => {
    await expect(
      selectVersionAction(interactiveUi(), "beta", "custom-ish")
    ).rejects.toThrow("无效版本动作：custom-ish")
  })

  it("预发布通道拒绝 current 动作", async () => {
    await expect(selectVersionAction(interactiveUi(), "beta", "current")).rejects.toThrow(
      "预发布通道必须选择 patch、minor、major 或精确 x.y.z 版本基线。"
    )
  })
})
