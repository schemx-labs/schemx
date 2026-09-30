/**
 * 计划与发布进度的磁盘契约。
 *
 * 回归重点：原实现对「状态文件损坏」有三种互相矛盾的策略，且读取失败的状态码在
 * `execute` 的两个调用点被吞掉，最终会回滚全部已发布包的 package.json，
 * 而对应版本已经存在于 npm 上。这里统一为「读取失败即抛错，绝不在状态不可信时回滚」。
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { readPlan, type ReleasePlan, writePlan } from "./plan.ts"
import {
  assertMatchesPlan,
  hasStep,
  markStep,
  progressText,
  publishedNames,
  publishedRecords,
  readState,
  removeState,
  statePath,
} from "./state.ts"

/** 测试用的双包计划。 */
const PLAN: ReleasePlan = {
  schemaVersion: 1,
  channel: "latest",
  target: "core,vue",
  versionAction: "patch",
  baselineVersion: "按包独立计算",
  distTag: "latest",
  sourceSha: "abc1234",
  createCommit: true,
  createTag: true,
  createGithubRelease: true,
  prerelease: false,
  packages: [
    {
      name: "@schemx/core",
      package: "core",
      currentVersion: "1.0.0",
      baselineVersion: "1.0.1",
      version: "1.0.1",
      tag: "@schemx/core@1.0.1",
    },
    {
      name: "@schemx/vue",
      package: "vue",
      currentVersion: "2.0.0",
      baselineVersion: "2.0.1",
      version: "2.0.1",
      tag: "@schemx/vue@2.0.1",
    },
  ],
}

let directory = ""

let planFile = ""

beforeEach(() => {
  directory = mkdtempSync(path.join(tmpdir(), "schemx-state-test-"))
  planFile = path.join(directory, "plan.json")
  writePlan(planFile, {
    channel: PLAN.channel,
    target: PLAN.target,
    versionAction: PLAN.versionAction,
    distTag: PLAN.distTag,
    sourceSha: PLAN.sourceSha,
    packages: PLAN.packages.map(({ tag: _tag, ...rest }) => rest),
  })
})

afterEach(() => {
  rmSync(directory, { recursive: true, force: true })
})

describe("计划读写", () => {
  it("往返保持一致", () => {
    expect(readPlan(planFile)).toEqual(PLAN)
  })

  it("按通道推导标记与预发布约定", () => {
    const betaFile = path.join(directory, "beta.json")

    writePlan(betaFile, {
      channel: "beta",
      target: "core",
      versionAction: "patch",
      distTag: "beta",
      sourceSha: "sha",
      packages: [
        {
          name: "n",
          package: "core",
          currentVersion: "1.0.0",
          baselineVersion: "1.0.1",
          version: "1.0.1-beta.0",
        },
      ],
    })
    const plan = readPlan(betaFile)

    expect(plan.createTag).toBe(true)
    expect(plan.createGithubRelease).toBe(true)
    expect(plan.createCommit).toBe(false)
    expect(plan.prerelease).toBe(true)
    expect(plan.packages[0]?.tag).toBe("n@1.0.1-beta.0")
  })

  it("dev 通道不创建任何标记", () => {
    const devFile = path.join(directory, "dev.json")

    writePlan(devFile, {
      channel: "dev",
      target: "core",
      versionAction: "patch",
      distTag: "dev",
      sourceSha: "sha",
      packages: [
        {
          name: "n",
          package: "core",
          currentVersion: "1.0.0",
          baselineVersion: "1.0.1",
          version: "1.0.1-dev.1",
        },
      ],
    })
    const plan = readPlan(devFile)

    expect(plan.createTag).toBe(false)
    expect(plan.createGithubRelease).toBe(false)
    expect(plan.prerelease).toBe(false)
  })

  it("单包计划记录该包的版本基线", () => {
    expect(readPlan(planFile).baselineVersion).toBe("按包独立计算")
    const singleFile = path.join(directory, "single.json")

    writePlan(singleFile, {
      channel: "latest",
      target: "core",
      versionAction: "patch",
      distTag: "latest",
      sourceSha: "sha",
      packages: [
        {
          name: "n",
          package: "core",
          currentVersion: "1.0.0",
          baselineVersion: "1.0.1",
          version: "1.0.1",
        },
      ],
    })
    expect(readPlan(singleFile).baselineVersion).toBe("1.0.1")
  })

  it("拒绝空包列表的计划", () => {
    const empty = path.join(directory, "empty.json")

    writeFileSync(empty, JSON.stringify({ schemaVersion: 1, packages: [] }))
    expect(() => readPlan(empty)).toThrow(/无效发布计划/)
  })

  it("拒绝未知 schema 版本", () => {
    writeFileSync(planFile, JSON.stringify({ ...PLAN, schemaVersion: 99 }))
    expect(() => readPlan(planFile)).toThrow(/无效发布计划/)
  })

  it("拒绝缺少包字段的计划", () => {
    writeFileSync(planFile, JSON.stringify({ ...PLAN, packages: [{ name: "n" }] }))
    expect(() => readPlan(planFile)).toThrow(/缺少包信息/)
  })
})

describe("发布进度状态", () => {
  it("无状态文件时所有步骤均未完成", () => {
    expect(readState(planFile)).toBeUndefined()
    expect(hasStep(planFile, "core", "published")).toBe(false)
    expect(publishedRecords(PLAN, planFile)).toEqual([])
    expect(publishedNames(PLAN, planFile).size).toBe(0)
  })

  it("记录并读取逐步骤进度", () => {
    markStep(planFile, PLAN, "core", "published")
    expect(hasStep(planFile, "core", "published")).toBe(true)
    expect(hasStep(planFile, "core", "tagged")).toBe(false)
    expect(hasStep(planFile, "vue", "published")).toBe(false)
  })

  it("三个步骤互不干扰", () => {
    markStep(planFile, PLAN, "core", "published")
    markStep(planFile, PLAN, "core", "tagged")
    expect(hasStep(planFile, "core", "published")).toBe(true)
    expect(hasStep(planFile, "core", "tagged")).toBe(true)
    expect(hasStep(planFile, "core", "released")).toBe(false)
  })

  it("拒绝记录计划外的包", () => {
    expect(() => markStep(planFile, PLAN, "ghost", "published")).toThrow(/计划外的包/)
  })

  it("已发布记录保持计划顺序而不是写入顺序", () => {
    markStep(planFile, PLAN, "vue", "published")
    markStep(planFile, PLAN, "core", "published")
    expect(publishedRecords(PLAN, planFile).map((item) => item.package)).toEqual([
      "core",
      "vue",
    ])
    expect([...publishedNames(PLAN, planFile)]).toEqual(["core", "vue"])
  })

  it("进度文本只展示通道适用的步骤", () => {
    const devPlan: ReleasePlan = {
      ...PLAN,
      channel: "dev",
      createTag: false,
      createGithubRelease: false,
    }

    markStep(planFile, devPlan, "core", "published")
    const text = progressText(devPlan, planFile)

    expect(text).toContain("@schemx/core@1.0.1  已发布")
    expect(text).toContain("@schemx/vue@2.0.1  未执行")
    expect(text).not.toContain("已建 Tag")
  })

  it("删除状态保持幂等", () => {
    markStep(planFile, PLAN, "core", "published")
    removeState(planFile)
    expect(() => removeState(planFile)).not.toThrow()
    expect(hasStep(planFile, "core", "published")).toBe(false)
  })
})

/** 回归：状态文件损坏时不能把已发布包静默降级为「未发布」。 */
describe("状态文件损坏的回归", () => {
  it("读取已发布包时抛出错误而不是返回空列表", () => {
    markStep(planFile, PLAN, "core", "published")
    writeFileSync(statePath(planFile), "{ 损坏的 JSON")

    expect(() => publishedRecords(PLAN, planFile)).toThrow()
    expect(() => publishedNames(PLAN, planFile)).toThrow()
    expect(() => progressText(PLAN, planFile)).toThrow()
  })

  it("schema 版本不符时同样抛出错误", () => {
    markStep(planFile, PLAN, "core", "published")
    writeFileSync(
      statePath(planFile),
      JSON.stringify({
        schemaVersion: 99,
        channel: "latest",
        sourceSha: "sha",
        packages: [],
      })
    )

    expect(() => publishedNames(PLAN, planFile)).toThrow(/发布进度状态无效/)
  })

  it("损坏状态下 hasStep 不会把已完成步骤判为未完成", () => {
    markStep(planFile, PLAN, "core", "published")
    writeFileSync(statePath(planFile), "not json at all")

    // 原实现这里 catch 后 exit(1)，即「损坏 = 未完成」，会诱导执行器重做不可逆步骤。
    expect(() => hasStep(planFile, "core", "published")).toThrow()
  })

  it("损坏状态下 markStep 不会静默重建并覆盖现场", () => {
    markStep(planFile, PLAN, "core", "published")
    writeFileSync(statePath(planFile), "not json at all")

    expect(() => markStep(planFile, PLAN, "vue", "published")).toThrow()
    expect(readFileSync(statePath(planFile), "utf8")).toBe("not json at all")
  })
})

describe("状态与计划一致性", () => {
  it("一致时通过", () => {
    markStep(planFile, PLAN, "core", "published")
    expect(() => assertMatchesPlan(PLAN, planFile)).not.toThrow()
  })

  it("无状态文件时通过", () => {
    expect(() => assertMatchesPlan(PLAN, planFile)).not.toThrow()
  })

  it("记录计划外的包时报错", () => {
    markStep(planFile, PLAN, "core", "published")
    const state = readState(planFile)

    writeFileSync(
      statePath(planFile),
      JSON.stringify({
        ...state,
        packages: [
          ...(state?.packages ?? []),
          {
            package: "ghost",
            name: "g",
            version: "1.0.0",
            published: true,
            tagged: false,
            released: false,
          },
        ],
      })
    )
    expect(() => assertMatchesPlan(PLAN, planFile)).toThrow(/与冻结计划不一致/)
  })

  it("版本漂移时报错", () => {
    markStep(planFile, PLAN, "core", "published")
    const state = readState(planFile)

    const packages = (state?.packages ?? []).map((item) =>
      item.package === "core" ? { ...item, version: "9.9.9" } : item
    )

    writeFileSync(statePath(planFile), JSON.stringify({ ...state, packages }))
    expect(() => assertMatchesPlan(PLAN, planFile)).toThrow(/与冻结计划不一致/)
  })
})
