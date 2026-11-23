# schemx

Schema-driven, extensible form engine for modern web.

`schemx` 是一套以 Schema 驱动的动态表单方案。它将表单状态、校验、字段依赖和 UI 渲染拆分为独立层级，既可以直接在 Vue 3 + Vant 项目中使用，也可以基于 headless core 接入其他 UI 框架。

## 特性

- **Schema 驱动**：使用配置描述字段、分组、动态属性和条件子树。
- **分层设计**：core、Vue 适配层和 Vant renderer 可以独立使用。
- **动态表单优先**：支持字段联动、异步 dependency renderer 和运行时 schema 更新。
- **类型友好**：根据表单值、字段路径和 `componentType` 推断对应类型。
- **可扩展校验**：内置常用必填规则，并支持实现 Standard Schema 的校验库。
- **可扩展渲染**：通过 renderer registry 注册业务组件或接入新的 UI 组件库。

## 包说明

| 包                                | 说明                         | 适用场景                                        |
| --------------------------------- | ---------------------------- | ----------------------------------------------- |
| [`@schemx/core`](./packages/core) | 框架无关的 headless 表单引擎 | 自定义框架适配、状态管理、字段依赖和校验        |
| [`@schemx/vue`](./packages/vue)   | Vue 3 表单适配层             | 使用 Vue 组件树渲染 Schema，接入自定义 renderer |
| [`@schemx/vant`](./packages/vant) | 基于 Vant 的 renderer 集合   | 在 Vue 3 + Vant 项目中快速构建移动端表单        |

## 快速开始

在 Vue 3 + Vant 项目中，推荐直接使用 `@schemx/vant`：

```bash
pnpm add @schemx/vant vant vue
```

```vue
<script setup lang="ts">
  import { ref } from "vue"

  import Schemx from "@schemx/vant"

  import type { SchemxField } from "@schemx/vant"

  type LoginValues = {
    username: string
    password: string
  }

  const formData = ref<LoginValues>({
    username: "",
    password: "",
  })

  const schemas: SchemxField<LoginValues>[] = [
    {
      name: "username",
      label: "用户名",
      componentType: "input",
      rules: "required",
      placeholder: "请输入用户名",
    },
    {
      name: "password",
      label: "密码",
      componentType: "input",
      rules: "required",
      componentProps: {
        type: "password",
      },
    },
  ]

  function handleFinish(values: Readonly<LoginValues>) {
    console.log(values)
  }
</script>

<template>
  <Schemx v-model="formData" :schemas="schemas" @finish="handleFinish" />
</template>
```

`@schemx/vant` 会在导入时注册默认 Vant renderer。需要接入其他 UI 组件库时，可以使用 `@schemx/vue` 注册自定义 renderer；只需要状态、校验和依赖能力时，可以直接使用 `@schemx/core`。

## 本地开发

```bash
pnpm install
pnpm dev:vant
```

常用检查命令：

```bash
pnpm build
pnpm test
pnpm type-check
pnpm lint
```

## 发布脚本

发布脚本统一通过 `pnpm release:*` 执行。涉及包目标的命令都支持 `all`、`core`、`vue`、`vant`：

- `release:version:*` 和 `release:pack` 默认目标为 `all`。
- `release:publish*` 不传目标时会进入交互选择；在 CI 或非交互环境中建议显式传入目标。

正式发布只发布当前 `package.json` 中的版本，不会自动提升版本号。推荐流程：

```bash
pnpm release:version:patch vue
git add packages/vue/package.json pnpm-lock.yaml
git commit -m "chore(发布): 提升 vue 版本"
pnpm release:publish vue
```

预发布会临时生成 `0.1.x-alpha.<timestamp>.<sha>` 这类版本号，发布完成后恢复本地 `package.json`：

```bash
pnpm release:publish:alpha vue
```

### 常用命令

| 命令 | 作用 | 使用 |
| --- | --- | --- |
| `pnpm release:check` | 执行完整发布前检查：安装一致性、测试、lint、构建和发布包内容检查。 | 发布前本地自检：`pnpm release:check` |
| `pnpm release:pack [target]` | 生成本地 tarball，用于检查实际发布包内容。 | 全部包：`pnpm release:pack`；单包：`pnpm release:pack vant` |
| `pnpm release:publish [target]` | 发布正式版到 npm，并创建 Git tag 和 GitHub Release。正式发布前需要先执行 `release:version:*` 并提交版本变更。 | 交互选择：`pnpm release:publish`；单包：`pnpm release:publish vue` |
| `pnpm release:publish:dev [target]` | 发布 `dev` 预发布版本，适合日常联调验证。 | `pnpm release:publish:dev core` |
| `pnpm release:publish:alpha [target]` | 发布 `alpha` 预发布版本，适合内部预览。 | `pnpm release:publish:alpha vue` |
| `pnpm release:publish:beta [target]` | 发布 `beta` 预发布版本，适合外部测试。 | `pnpm release:publish:beta vant` |
| `pnpm release:publish:rc [target]` | 发布 `rc` 预发布版本，适合正式发布前候选验证。 | `pnpm release:publish:rc all` |
| `pnpm release:publish:next [target]` | 发布 `next` 预发布版本，适合下一版本线验证。 | `pnpm release:publish:next all` |
| `pnpm release:version:patch [target]` | 提升 patch 版本，并同步 `pnpm-lock.yaml`。 | 全部包：`pnpm release:version:patch`；单包：`pnpm release:version:patch vue` |
| `pnpm release:version:minor [target]` | 提升 minor 版本，并同步 `pnpm-lock.yaml`。 | `pnpm release:version:minor core` |
| `pnpm release:version:major [target]` | 提升 major 版本，并同步 `pnpm-lock.yaml`。 | `pnpm release:version:major all` |
| `pnpm release:test` | 运行发布脚本自身的测试，不发布、不改版本。 | 修改发布脚本后执行：`pnpm release:test` |

### 发布通道

| 类型 | 用途 |
| --- | --- |
| `dev` | 日常开发测试，不稳定 |
| `alpha` | 内部预览，API 可能还会变 |
| `beta` | 外部测试，功能基本完整 |
| `rc` | release candidate，候选正式版 |
| `stable` | 正式版 |

## 相关文档

- [core 使用说明](./packages/core)
- [Vue 适配层说明](./packages/vue)
- [Vant renderer 说明](./packages/vant)
- [Vant 示例项目](./examples/vant)
