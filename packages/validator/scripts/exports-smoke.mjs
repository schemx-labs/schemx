/**
 * exports smoke 测试：验证根入口在 ESM 与 CJS 两种加载方式下
 * 都能正常导出唯一的 async-validator adapter 工厂。
 *
 * 由 `pnpm run test:exports` 在 build 之后调用。
 */
import { createRequire } from "node:module"
import { strict as assert } from "node:assert"

// [入口, 期望导出的函数名]；与 package.json exports 的运行时入口保持一致。
const entries = [
  ["@schemx/validator", "createAsyncValidatorAdapter"],
]

const require = createRequire(import.meta.url)

for (const [specifier, exportedName] of entries) {
  const esm = await import(specifier)
  const cjs = require(specifier)

  assert.equal(typeof esm[exportedName], "function", `${specifier} ESM export`)
  assert.equal(typeof cjs[exportedName], "function", `${specifier} CJS export`)
}

console.log("@schemx/validator exports map smoke 通过（ESM/CJS：1 个运行时入口）。")
