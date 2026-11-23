# schemx 示例

本目录包含 schemx 组件的使用示例。

## 示例列表

1. **basic** - 基础表单示例（文本、数字、日期、开关等常用字段）
2. **validation** - 表单验证示例（必填、正则、自定义验证器、异步验证）
3. **dynamic** - 动态表单示例（字段联动、条件显示/隐藏、动态属性）
4. **dependency** - FormDependency 组件示例（复杂字段联动）
5. **custom-renderer** - 自定义渲染器示例（颜色选择器、星级评分、标签输入）
6. **hooks** - Hooks API 使用示例（useForm、useField、useWatch）

## 运行示例

```bash
# 在 packages/schemx 目录下
npm run dev

# 或者使用 vite 直接运行示例
npx vite examples
```

然后在浏览器中访问 http://localhost:5173 查看示例。

## 快速开始

```vue
<template>
  <schemx v-model="formData" :schemas="schemas" :footer="true" @finish="handleSubmit" />
</template>

<script setup lang="ts">
  import { ref } from "vue"
  import schemx from "@schemx/core"
  import "@schemx/core/style.css"

  const formData = ref({})

  const schemas = [
    { name: "username", label: "用户名", componentType: "text", required: true },
    { name: "email", label: "邮箱", componentType: "text" },
  ]

  const handleSubmit = (values, done: () => void) => {
    console.log("提交数据:", values)
    done()
  }
</script>
```
