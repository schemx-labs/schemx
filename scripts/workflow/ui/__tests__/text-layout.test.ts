/**
 * Unicode 宽度与 ANSI 换行保持纯函数，不依赖实例或工作流。
 */
import { describe, expect, it } from "vite-plus/test"

import { visibleWidth, wrapText } from "../text-layout.ts"

describe("终端文本宽度", () => {
  it("中文、组合字符与 emoji 按可见宽度计算", () => {
    expect(visibleWidth("发布 beta")).toBe(9)
    expect(visibleWidth("e\u0301")).toBe(1)
    expect(visibleWidth("👩‍💻")).toBe(2)
    expect(wrapText("发布前检查", 6)).toEqual(["发布前", "检查"])
  })
  it("换行保留颜色序列和显式空行", () => {
    // 逐物理行验证宽度、续行导轨或颜色保留。
    const lines = wrapText("\u001B[31m发布前检查\u001B[39m", 6)

    expect(lines.map(visibleWidth)).toEqual([6, 4])
    expect(lines[0]).toBe("\u001B[31m发布前\u001B[0m")
    expect(wrapText("a\n\nb", 10)).toEqual(["a", "", "b"])
  })
})
