/**
 * 输出排版的纯函数测试。
 *
 * @remarks 这一层刻意与终端解耦：列宽计算、任务行排版、详情块缩进都不接触真实
 * 终端，因此可以在无 TTY、无颜色的环境下断言「看起来应该是什么样」。
 *
 * 覆盖内容：
 * - 列宽取本批次实际内容，并受最小值与上限约束；
 * - 三列形态下目标、任务名左对齐补齐，耗时右对齐；
 * - 补齐按可见宽度计算，含 ANSI 颜色时列仍然对齐；
 * - 单列形态省略空列，不产生多余空格；
 * - `last` 决定 `├─` 还是 `└─`；
 * - 全部内容保留同一左侧导轨，详情块按所在 group 层级缩进。
 */
import { describe, expect, it } from "vitest"

import {
  computeColumns,
  formatDetail,
  formatGroupNote,
  formatGroupTitle,
  formatTaskRow,
} from "./layout.ts"
import { setColorSupport, theme, visibleWidth, wrapText } from "./theme.ts"

setColorSupport(false)

/** 测试用的固定列布局。 */
const COLUMNS = { target: 20, label: 10, duration: 7 }

describe("computeColumns", () => {
  it("混合中文任务名按终端列数计算宽度", () => {
    expect(computeColumns(["core"], ["验证 npm registry"])).toEqual({
      target: 12,
      label: 17,
      duration: 7,
    })
  })

  it("按实际最宽内容确定列宽", () => {
    expect(computeColumns(["@schemx/core", "@schemx/element-plus"], ["build"])).toEqual({
      target: 20,
      label: 10,
      duration: 7,
    })
  })

  it("内容很短时不低于最小宽度", () => {
    expect(computeColumns(["a", "bb"], ["lint"])).toEqual({
      target: 12,
      label: 10,
      duration: 7,
    })
  })

  it("超长内容被上限截断，避免把耗时列挤出屏幕", () => {
    expect(computeColumns(["x".repeat(60)], ["y".repeat(40)])).toEqual({
      target: 32,
      label: 24,
      duration: 7,
    })
  })

  it("空输入也返回可用宽度", () => {
    expect(computeColumns([], [])).toEqual({ target: 12, label: 10, duration: 7 })
  })
})

describe("终端文本换行", () => {
  it("中文、组合字符和 emoji 按实际列数计宽", () => {
    expect(visibleWidth("发布 beta")).toBe(9)
    expect(visibleWidth("e\u0301")).toBe(1)
    expect(visibleWidth("👩‍💻")).toBe(2)
    expect(wrapText("发布前检查", 6)).toEqual(["发布前", "检查"])
  })

  it("ANSI 序列不占列宽且不会被换行切断", () => {
    const lines = wrapText("\u001B[31m发布前检查\u001B[39m", 6)

    expect(lines.map((line) => visibleWidth(line))).toEqual([6, 4])
    expect(lines.every((line) => line.startsWith("\u001B[31m"))).toBe(true)
    expect(lines[0]).toBe("\u001B[31m发布前\u001B[0m")
  })
})

describe("formatTaskRow", () => {
  it("三列形态下按列宽对齐，耗时右对齐", () => {
    const line = formatTaskRow(
      {
        status: "success",
        target: "@schemx/core",
        label: "check",
        duration: 13_500,
        last: false,
      },
      1,
      COLUMNS
    )

    // 目标列补齐到 20、任务列补齐到 10、耗时右对齐到 7。
    expect(line).toBe("│    ✔ ├─ @schemx/core          check         13.5s")
  })

  it("耗时不足一秒时用毫秒", () => {
    const line = formatTaskRow(
      { status: "success", target: "core", label: "check", duration: 850, last: true },
      1,
      COLUMNS
    )

    expect(line).toContain("850ms")
  })

  it("last 决定树形连接符", () => {
    const middle = formatTaskRow(
      { status: "success", target: "a", label: "x", duration: 1, last: false },
      1,
      COLUMNS
    )

    const last = formatTaskRow(
      { status: "success", target: "b", label: "x", duration: 1, last: true },
      1,
      COLUMNS
    )

    expect(middle).toContain("├─")
    expect(last).toContain("└─")
  })

  it("未指定 last 时不画树形连接符", () => {
    const line = formatTaskRow({ status: "success", target: "a", label: "x" }, 1, COLUMNS)

    expect(line).not.toContain("├─")
    expect(line).not.toContain("└─")
  })

  it("未执行原因右对齐到耗时列", () => {
    const line = formatTaskRow(
      {
        status: "pending",
        target: "vant",
        label: "",
        pendingReason: "未执行",
        last: true,
      },
      1,
      COLUMNS
    )

    expect(line.trimEnd().endsWith("未执行")).toBe(true)
    expect(line).toContain("○")
  })

  it("单列形态不产生多余空列", () => {
    expect(formatTaskRow({ status: "success", target: "core", label: "check" }, 0)).toBe(
      "│  ✔ core check"
    )
    expect(formatTaskRow({ status: "success", label: "check" }, 0)).toBe("│  ✔ check")
  })

  it("嵌套层级每深一层缩进两格", () => {
    expect(formatTaskRow({ status: "success", label: "x" }, 0)).toBe("│  ✔ x")
    expect(formatTaskRow({ status: "success", label: "x" }, 1)).toBe("│    ✔ x")
    expect(formatTaskRow({ status: "success", label: "x" }, 2)).toBe("│      ✔ x")
  })

  it("耗时缺省时不渲染尾列", () => {
    const line = formatTaskRow(
      { status: "success", target: "core", label: "check" },
      1,
      COLUMNS
    )

    expect(line.trimEnd().endsWith("check")).toBe(true)
  })
})

describe("分组与详情缩进", () => {
  it("分组标题按层级缩进", () => {
    expect(formatGroupTitle("执行检查", 1)).toBe("│  ◆ 执行检查")
    expect(formatGroupTitle("执行检查", 2)).toBe("│    ◆ 执行检查")
  })

  it("分组说明比标题再深一级", () => {
    expect(formatGroupNote("说明", 1)).toBe("│    说明")
  })

  it("详情块首行带左锚点，其余行与首行对齐", () => {
    expect(formatDetail("line1", 1, true)).toBe("│      ┌ line1")
    expect(formatDetail("line2", 1, false)).toBe("│      │ line2")
  })

  it("flow 直接层的详情块保留导轨", () => {
    expect(formatDetail("line", 0, true)).toBe("│    ┌ line")
  })
})

describe("颜色模式", () => {
  it("关闭颜色时输出不含 ANSI 序列", () => {
    const line = formatTaskRow({ status: "error", target: "core", label: "x" }, 0)

    expect(line).not.toContain(String.fromCharCode(27))
  })

  it("开启颜色时列宽仍按可见宽度计算", () => {
    const row = {
      status: "success" as const,
      target: "core",
      label: "check",
      duration: 5,
      last: true,
    }

    const plain = formatTaskRow(row, 1, COLUMNS)

    setColorSupport(true, {})

    try {
      const colored = formatTaskRow(row, 1, COLUMNS)

      expect(colored).toContain(String.fromCharCode(27))
      // 去掉 ANSI 后，可见宽度必须与关闭颜色时逐字相同，否则列会错位。
      expect(
        colored.replace(new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g"), "")
      ).toBe(plain)
    } finally {
      setColorSupport(false)
    }
  })

  it("语义色各自可独立渲染", () => {
    expect(theme.success("x")).toBe("x")
    expect(theme.error("x")).toBe("x")
    expect(theme.warning("x")).toBe("x")
    expect(theme.dim("x")).toBe("x")
  })
})
