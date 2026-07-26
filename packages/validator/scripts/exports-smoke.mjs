/**
 * exports smoke 测试：验证 package.json `exports` 映射的每个子路径入口
 * 在 ESM 与 CJS 两种加载方式下都能正常导出运行时 adapter。
 *
 * 由 `pnpm run test:exports` 在 build 之后调用。
 */
import { createRequire } from "node:module"
import { strict as assert } from "node:assert"

// [子路径入口, 期望导出的函数名]；与 package.json exports 的运行时入口保持一致。
const entries = [
  ["@schemx/validator/async-validator", "createAsyncValidatorAdapter"],
  ["@schemx/validator/preset", "createValidationAdapterPreset"],
]

const require = createRequire(import.meta.url)

for (const [specifier, exportedName] of entries) {
  const esm = await import(specifier)
  const cjs = require(specifier)

  assert.equal(typeof esm[exportedName], "function", `${specifier} ESM export`)
  assert.equal(typeof cjs[exportedName], "function", `${specifier} CJS export`)
}

console.log("@schemx/validator exports map smoke 通过（ESM/CJS：3 个运行时入口）。")
