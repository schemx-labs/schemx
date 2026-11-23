<template>
  <div class="app">
    <header class="header">
      <h1>Schemx 示例</h1>
      <nav class="nav">
        <button
          v-for="example in examples"
          :key="example.id"
          :class="{ active: currentExample === example.id }"
          @click="currentExample = example.id"
        >
          {{ example.name }}
        </Button>
      </nav>
    </header>

    <main class="main">
      <component :is="currentComponent" />
    </main>
  </div>
</template>

<script setup lang="ts">
  import { computed, markRaw, ref } from "vue"

  import BasicForm from "./basic/BasicForm.vue"
  import DependencyForm from "./dependency/DependencyForm.vue"
  import DynamicForm from "./dynamic/DynamicForm.vue"
  import SlotsForm from "./slots/SlotsForm.vue"
  import SlotsFormJsx from "./slots/SlotsFormJsx.jsx"
  import ValidationForm from "./validation/ValidationForm.vue"

  /**
   * 示例模块列表。
   *
   * 使用 markRaw() 包装组件引用，避免 Vue 将组件对象转为响应式代理，
   * 减少不必要的性能开销。
   */
  const examples = [
    { id: "basic", name: "基础表单", component: markRaw(BasicForm) },
    { id: "validation", name: "表单验证", component: markRaw(ValidationForm) },
    { id: "dynamic", name: "动态表单", component: markRaw(DynamicForm) },
    { id: "dependency", name: "字段联动", component: markRaw(DependencyForm) },
    { id: "slots", name: "插槽系统", component: markRaw(SlotsForm) },
    { id: "slots-jsx", name: "插槽系统（JSX）", component: markRaw(SlotsFormJsx) },
  ]

  /** 当前激活的 tab id */
  const currentExample = ref("basic")

  /** 根据当前 tab id 查找对应的示例组件，默认回退到 BasicForm */
  const currentComponent = computed(() => {
    const example = examples.find((e) => e.id === currentExample.value)

    return example?.component || BasicForm
  })
</script>

<style>
  * {
    box-sizing: border-box;
  }

  body {
    margin: 0;
    font-family:
      -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial,
      sans-serif;
    background: #f5f5f5;
  }

  .app {
    min-height: 100vh;
  }

  .header {
    background: white;
    padding: 16px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    position: sticky;
    top: 0;
    z-index: 100;
  }

  .header h1 {
    margin: 0 0 16px 0;
    font-size: 20px;
    color: #333;
  }

  .nav {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .nav button {
    padding: 8px 16px;
    border: 1px solid #ddd;
    background: white;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    color: #666;
    transition: all 0.2s;
  }

  .nav button:hover {
    border-color: #1989fa;
    color: #1989fa;
  }

  .nav button.active {
    background: #1989fa;
    border-color: #1989fa;
    color: white;
  }

  .main {
    max-width: 100%;
    overflow-x: hidden;
  }

  .form-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 16px;
    padding: 0 16px;
  }

  .form-data-preview {
    margin-top: 24px;
    padding: 16px;
    background: #f8f8f8;
    border-radius: 8px;
  }

  .form-data-preview h3 {
    margin: 0 0 12px 0;
    font-size: 14px;
    color: #666;
  }

  .form-data-preview pre {
    margin: 0;
    font-size: 12px;
    line-height: 1.6;
    white-space: pre-wrap;
    word-break: break-all;
  }
</style>
