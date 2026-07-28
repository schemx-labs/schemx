# @schemx/validator

`@schemx/validator` 为 `@schemx/core` 提供非 Standard Schema 第三方校验器适配器。
当前包含 `async-validator` 自描述规则适配器，可直接将其 descriptor 交给 Core Validator 执行。

Zod 等实现 Standard Schema V1 的校验器可以直接作为 Core 字段规则使用，只需安装对应的校验库，
不需要安装 `@schemx/validator` 或注册额外 adapter。

## 安装

只安装需要的校验器即可：

```bash
pnpm add @schemx/core @schemx/validator async-validator
```

`async-validator` 是可选 peer dependency。`@schemx/validator` 根入口只导出类型，不会加载第三方库；运行时实现应从对应子路径导入。

## async-validator

```ts
import { createForm } from "@schemx/core"
import { createAsyncValidatorAdapter } from "@schemx/validator/async-validator"

const asyncValidator = createAsyncValidatorAdapter()
const emailRule = {
  type: "email",
  message: "邮箱格式错误",
}

const form = createForm({
  validatorAdapters: [asyncValidator],
  initialValues: { email: "" },
  schemas: [
    {
      name: "email",
      label: "邮箱",
      componentType: "input",
      rules: [emailRule],
    },
  ],
})
```

descriptor 可以是单个 `RuleItem`，也可以是只读数组。适配器会把当前字段值写回完整表单快照，因此自定义 validator 可以读取关联字段；校验被新一轮校验或销毁操作取消时，过期结果不会写入错误状态。

## 预设

需要快速启用 `async-validator` 时，可使用 `/preset`：

```ts
import { createForm } from "@schemx/core"
import { createValidationAdapterPreset } from "@schemx/validator/preset"

const validation = createValidationAdapterPreset()

const form = createForm({
  validatorAdapters: validation.validatorAdapters,
  // schemas、initialValues 等其他配置
})
```

预设只负责注册 adapter；业务代码可直接将 async-validator descriptor 放入字段 `rules`。

## API 与导出

| 入口                                | 运行时导出                      | 说明                                                                                   |
| ----------------------------------- | ------------------------------- | -------------------------------------------------------------------------------------- |
| `@schemx/validator`                 | 无（仅类型）                    | `AsyncValidatorValidationAdapter`、`ValidationAdapterPreset`。                       |
| `@schemx/validator/async-validator` | `createAsyncValidatorAdapter`   | 适配 `RuleItem` descriptor。                                                           |
| `@schemx/validator/preset`          | `createValidationAdapterPreset` | 创建 async-validator 适配器集合。                                                     |

适配器需要通过 `createForm({ validatorAdapters })`、`configureSchemx({ validatorAdapters })` 或其他 Core 表单创建入口注册。Core 内置的原生 `ValidationRule` 与 Standard Schema 不需要额外适配器。完整的结果类型和错误模型见 [`@schemx/core`](../core)。

同 ID adapter 默认会被拒绝；如需显式覆盖前一项，使用 `{ adapter, override: true }`。

## 注意事项

- `rules` 中的 async-validator descriptor 可直接传入；未被已注册 adapter 识别的对象会作为字段配置错误处理。
- `ValidationResult` 的错误详情使用 `issues`，每项包含 `message`，并可能包含 `code` 与 `cause`。
- 适配器不会改变 Core 的校验生命周期；同一字段开始新的校验时，旧校验可能返回 `cancelled: true`。
