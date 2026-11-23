# @schemx/vue

Vue 3 adapter for schemx.

`@schemx/vue` 将 `@schemx/core` 的表单实例和 ViewSchemas 渲染为 Vue 组件树。它不绑定具体 UI 组件库，适合接入业务组件、设计系统或新的 UI adapter。

如果项目使用 Vant，推荐直接安装 [`@schemx/vant`](../vant)。该包已经注册好常用移动端表单 renderer。

## 特性

- 提供 Vue 3 表单组件和 Composition API。
- 通过 `rendererRegistry` 注册自定义 renderer。
- 支持 `v-model`、`initialValues`、表单级事件和实例方法。
- 复用 `@schemx/core` 的字段依赖、校验、运行时 schema node 和 ViewSchemas。
- 直接导出 `@schemx/core` 的公开类型与工具。

## 安装

```bash
pnpm add @schemx/vue vue
```

## 快速开始

`@schemx/vue` 默认不提供具体输入控件。使用前需要注册 renderer：

```ts
import { markRaw } from "vue"

import { rendererRegistry } from "@schemx/vue"

import InputRenderer from "./components/InputRenderer.vue"

rendererRegistry.register("input", markRaw(InputRenderer))
```

然后通过默认导出的 `Schemx` 组件渲染表单：

```vue
<script setup lang="ts">
  import { ref } from "vue"

  import Schemx from "@schemx/vue"

  import type { SchemxField } from "@schemx/vue"

  type ProfileValues = {
    nickname: string
  }

  const formData = ref<ProfileValues>({
    nickname: "",
  })

  const schemas: SchemxField<ProfileValues>[] = [
    {
      name: "nickname",
      label: "昵称",
      componentType: "input",
      rules: "required",
      placeholder: "请输入昵称",
    },
  ]
</script>

<template>
  <Schemx v-model="formData" :schemas="schemas" />
</template>
```

`@schemx/vue` 的基础样式会随包入口自动加载，常规 Vite / Vue 项目不需要再手动引入 `@schemx/vue/style.css`。

## 自定义 Renderer

renderer 会接收到 `value`、`onUpdate:value`、`onChange`、`onBlur`、`readonly`、`disabled` 和 `placeholder` 等公共属性。可以使用标准 Vue 事件更新字段值：

```vue
<script setup lang="ts">
  defineProps<{
    value?: string
    readonly?: boolean
    disabled?: boolean
    placeholder?: string
  }>()

  const emit = defineEmits<{
    "update:value": [value: string]
    change: [value: string]
    blur: [value: string]
  }>()
</script>

<template>
  <input
    :value="value"
    :readonly="readonly"
    :disabled="disabled"
    :placeholder="placeholder"
    @input="emit('update:value', ($event.target as HTMLInputElement).value)"
    @change="emit('change', ($event.target as HTMLInputElement).value)"
    @blur="emit('blur', ($event.target as HTMLInputElement).value)"
  />
</template>
```

也可以为单个表单实例传入独立的 registry：

```ts
import { createRendererRegistry } from "@schemx/vue"

const rendererRegistry = createRendererRegistry("input")

rendererRegistry.register("input", InputRenderer)
```

```vue
<Schemx :schemas="schemas" :renderer-registry="rendererRegistry" />
```

## Composition API

| API                 | 说明                                          |
| ------------------- | --------------------------------------------- |
| `useForm()`         | 创建表单实例，并通过 Vue context 提供给子组件 |
| `useField()`        | 获取字段级读写、校验和状态能力                |
| `useWatch()`        | 监听字段变化                                  |
| `useWatchField()`   | 监听单个字段                                  |
| `useWatchFields()`  | 监听多个字段                                  |
| `useWatchAll()`     | 监听整张表单                                  |
| `useDictionary()`   | 管理依赖字段的远程或本地选项                  |
| `useContext()`      | 获取表单上下文                                |
| `useEffect()`       | 创建字段依赖追踪 effect                       |
| `useFieldContext()` | 获取当前字段上下文                            |

## Adapter 边界

Vue 适配层只负责将 core 输出的 ViewSchemas 映射为 Vue 组件树。descriptor 编译、dependency 执行、validation、scheduler 和 node 生命周期由 `@schemx/core` 管理。

自定义 adapter 应优先使用 `form.getViewSchemas()`、`form.subscribeViewSchemas()` 和 `form.registerRenderer()` 等公开 API，避免依赖 core 内部目录。
