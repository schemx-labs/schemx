# @schemx/validator

`@schemx/validator` 提供 `async-validator` 与 `@schemx/core` 的集成。注册 adapter 后，可以直接在字段 `rules` 中使用 `async-validator` 的规则对象。

适用于已经使用 `async-validator` 的项目，包括必填、类型、长度、正则、嵌套对象和异步自定义校验等场景。

## 安装

```bash
pnpm add @schemx/core @schemx/validator async-validator
```

`async-validator` 是 peer dependency，需要由业务项目显式安装。

## 快速开始

创建 adapter，并在创建 Form 时通过 `validatorAdapters` 注册：

```ts
import { createForm } from "@schemx/core"
import { createAsyncValidatorAdapter } from "@schemx/validator"

const form = createForm({
  initialValues: {
    email: "",
  },
  validatorAdapters: [createAsyncValidatorAdapter()],
  schemas: [
    {
      name: "email",
      label: "邮箱",
      componentType: "input",
      rules: [
        {
          required: true,
          type: "email",
          message: "请输入有效的邮箱地址",
        },
      ],
    },
  ],
})

const result = await form.validate()

if (!result.valid) {
  console.log(result.errors)
}
```

## 规则写法

字段 `rules` 中的每个 `async-validator` 规则对象都会由 adapter 识别并执行。可使用 `required`、`type`、`pattern`、`min`、`max`、`len`、`enum`、`whitespace`、`fields`、`validator` 和 `asyncValidator` 等 `async-validator` 配置。

```ts
const schemas = [
  {
    name: "password",
    label: "密码",
    componentType: "input",
    rules: [
      { required: true, message: "请输入密码" },
      { min: 8, message: "密码至少为 8 位" },
      { pattern: /[A-Z]/, message: "密码需包含大写字母" },
    ],
  },
]
```

### 异步与关联字段校验

`asyncValidator` 执行时会收到当前表单的完整值快照，可用于比较关联字段：

```ts
const schemas = [
  {
    name: "confirmPassword",
    label: "确认密码",
    componentType: "input",
    rules: [
      {
        asyncValidator(_rule, value, _callback, source) {
          return value === source.password
            ? Promise.resolve()
            : Promise.reject(new Error("两次输入的密码不一致"))
        },
      },
    ],
  },
]
```

当某次校验已被新的校验或表单销毁取消时，adapter 不会将过期结果写入字段错误状态。

## API

| 导出 | 说明 |
| --- | --- |
| `createAsyncValidatorAdapter()` | 创建 ID 为 `"async-validator"` 的校验 adapter，并用于 `createForm({ validatorAdapters })`。 |
| `AsyncValidatorValidationAdapter` | adapter 的 TypeScript 类型。 |

同一个 Form 中不应重复注册 ID 相同的 adapter。需要覆盖既有注册时，使用 Core 的 `{ adapter, override: true }` 配置形式。

## 错误结果

校验失败会按 Core 的统一结果格式返回。字段错误位于 `result.errors` 中；每条 issue 都包含 `message`，并保留 `async-validator` 原始错误对象作为 `cause`，便于记录或排查。
