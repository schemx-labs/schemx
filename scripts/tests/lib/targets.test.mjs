import { describe, expect, test } from "vitest"

import { resolveTaskScript } from "../../lib/workspace-targets.mjs"

describe("resolveTaskScript", () => {
  test("dev 可以匹配 uni-app 的 dev:h5 脚本", () => {
    expect(resolveTaskScript({ "dev:h5": "uni" }, "dev")).toBe("dev:h5")
  })

  test("build 可以匹配 uni-app 的 build:h5 脚本", () => {
    expect(resolveTaskScript({ "build:h5": "uni build" }, "build")).toBe("build:h5")
  })

  test("未配置白名单的任务只匹配同名脚本", () => {
    expect(resolveTaskScript({ "lint:fix": "eslint --fix" }, "lint")).toBeUndefined()
  })
})
