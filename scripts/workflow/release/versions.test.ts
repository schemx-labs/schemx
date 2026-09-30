import { describe, expect, it } from "vitest"

import {
  baseline,
  CHANNELS,
  distTag,
  isAction,
  isChannel,
  isStable,
  needsSequence,
  releaseVersion,
} from "./versions.ts"

describe("版本基线计算", () => {
  it("current 沿用当前正式版本", () => {
    expect(baseline("1.2.3", "current")).toBe("1.2.3")
  })

  it("current 拒绝预发布版本", () => {
    expect(() => baseline("1.2.3-beta.1", "current")).toThrow(/不是正式版本/)
  })

  it("精确版本直接作为基线", () => {
    expect(baseline("1.2.3", "9.9.9")).toBe("9.9.9")
  })

  it.each([
    ["patch", "1.2.4"],
    ["minor", "1.3.0"],
    ["major", "2.0.0"],
  ] as const)("%s 从 1.2.3 推导基线", (action, expected) => {
    expect(baseline("1.2.3", action)).toBe(expected)
  })

  it("从个位进位", () => {
    expect(baseline("9.9.9", "major")).toBe("10.0.0")
    expect(baseline("0.0.0", "minor")).toBe("0.1.0")
    expect(baseline("1.9.0", "minor")).toBe("1.10.0")
  })

  it("预发布版本不能作为推导起点", () => {
    expect(() => baseline("1.2.3-dev.1", "patch")).toThrow(/不是正式版本/)
  })

  it("拒绝未知动作", () => {
    expect(() => baseline("1.2.3", "nonsense")).toThrow()
  })
})

describe("发布版本计算", () => {
  it("latest 直接使用正式基线", () => {
    expect(releaseVersion("latest", "1.2.3", 0)).toBe("1.2.3")
  })

  it.each(["alpha", "beta", "rc", "next"] as const)(
    "%s 使用 registry 序号",
    (channel) => {
      expect(releaseVersion(channel, "1.2.3", 7)).toBe(`1.2.3-${channel}.7`)
    }
  )

  it("dev 通道使用可注入的时间戳与 SHA", () => {
    expect(
      releaseVersion("dev", "1.2.3", 0, { timestamp: "20260101000000", sha: "abc1234" })
    ).toBe("1.2.3-dev.20260101000000.abc1234")
  })

  it("dev 通道在未注入时回落到 local", () => {
    expect(releaseVersion("dev", "1.2.3", 0, { timestamp: "20260101000000" })).toMatch(
      /^1\.2\.3-dev\.20260101000000\.local$/
    )
  })

  it("预发布序号必须是非负整数", () => {
    expect(() => releaseVersion("alpha", "1.2.3", -1)).toThrow(/序号非法/)
    expect(() => releaseVersion("alpha", "1.2.3", 1.5)).toThrow(/序号非法/)
  })

  it("基线必须是正式版本", () => {
    expect(() => releaseVersion("latest", "1.2.3-beta.1", 0)).toThrow(/不是正式版本/)
  })

  it("拒绝未知通道", () => {
    expect(() => releaseVersion("nightly", "1.2.3", 0)).toThrow(/未知发布通道/)
  })
})

describe("版本辅助判定", () => {
  it("识别正式版本", () => {
    expect(isStable("1.2.3")).toBe(true)
    expect(isStable("1.2")).toBe(false)
    expect(isStable("1.2.3-beta.1")).toBe(false)
    expect(isStable("v1.2.3")).toBe(false)
  })

  it("识别全部发布通道", () => {
    for (const channel of CHANNELS) {
      expect(isChannel(channel)).toBe(true)
      expect(distTag(channel)).toBe(channel)
    }

    expect(isChannel("nightly")).toBe(false)
    expect(() => distTag("nightly")).toThrow(/未知发布通道/)
  })

  it("识别版本动作与精确版本", () => {
    for (const action of ["current", "patch", "minor", "major", "1.2.3"]) {
      expect(isAction(action)).toBe(true)
    }

    expect(isAction("current2")).toBe(false)
    expect(isAction("1.2")).toBe(false)
  })

  it("只有 alpha/beta/rc/next 需要查询序号", () => {
    for (const channel of ["alpha", "beta", "rc", "next"]) {
      expect(needsSequence(channel)).toBe(true)
    }

    for (const channel of ["latest", "dev"]) {
      expect(needsSequence(channel)).toBe(false)
    }
  })
})
