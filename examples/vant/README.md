# @schemx/vant 示例

本目录是 `@schemx/vant` 的 Vue 3 + Vant 4 示例项目，用于验证内置 Renderer、字段联动、容器状态、校验、插槽和运行时 Schema 更新能力。

## 示例列表

1. **form-groups**：合并表单示例，通过 Group 区分基础表单、动态表单、字段联动和动态数组。
2. **array-value-update**：数组字段赋值示例，对比 `setFieldsValue` 与 `setFieldValue` 对普通数组和 Dynamic 数组的整体替换行为。
3. **slots**：插槽示例，覆盖 `FieldItem`、`FieldGroup` 和 renderer slot 的自定义展示。

## 运行示例

```bash
# 在仓库根目录（交互选择目标，选 Examples · vant）
pnpm dev

# 或只运行示例包
pnpm --filter vant-demo dev
```

然后在浏览器中访问 <http://localhost:5173> 查看示例。

“动态表单”中，关闭“显示配送详情”可隐藏整个 Group；选择“自提”可查看只读继承，选择“其他”可查看禁用继承。“字段联动”中，“显示订单配置”和“订单配置权限”会控制 Dependency 动态生成的全部后代字段。

“动态数组”已合并到“form-groups”示例中，`SchemxDynamicField.item` 使用数组项相对路径；通过“末项移到首位”可观察数组索引变化时字段值与行身份仍保持对应。切换“显示团队成员”和“成员编辑权限”可观察 `SchemxDynamicField.dependencies` 对数组容器及行内字段的状态控制。

## 快速开始

```vue
<template>
  <Schemx v-model="formData" :schemas="schemas" @finish="handleSubmit" />
</template>

<script setup lang="ts">
  import { ref } from "vue"

  import Schemx from "@schemx/vant"

  import type { SchemxField } from "@schemx/vant"

  const formData = ref({})

  const schemas: SchemxField[] = [
    {
      name: "username",
      label: "用户名",
      componentType: "input",
      required: true,
      placeholder: "请输入用户名",
    },
    {
      name: "email",
      label: "邮箱",
      componentType: "input",
      placeholder: "请输入邮箱",
    },
  ]

  function handleSubmit(values: Readonly<Record<string, unknown>>) {
    console.log("提交数据：", values)
  }
</script>
```
