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
        </button>
      </nav>
    </header>

    <main class="main">
      <component :is="currentComponent" />
    </main>
  </div>
</template>

<script setup lang="ts">
  import { computed, markRaw, ref } from "vue"

  import CustomRendererForm from "./custom/CustomRendererForm.vue"
  import ArrayValueUpdateForm from "./form/ArrayValueUpdateForm.vue"
  import FormGroupsForm from "./form/FormGroupsForm.vue"
  import SlotsForm from "./slots/SlotsForm.vue"

  /**
   * 示例模块列表。
   *
   * 使用 markRaw() 包装组件引用，避免 Vue 将组件对象转为响应式代理，
   * 减少不必要的性能开销。
   */
  const examples = [
    {
      id: "form-groups",
      name: "基础 / 动态 / 联动 / 动态数组",
      component: markRaw(FormGroupsForm),
    },
    {
      id: "array-value-update",
      name: "数组字段批量赋值",
      component: markRaw(ArrayValueUpdateForm),
    },
    { id: "slots", name: "插槽系统", component: markRaw(SlotsForm) },
    {
      id: "custom-renderer",
      name: "自定义子渲染器",
      component: markRaw(CustomRendererForm),
    },
  ]

  /** 当前激活的 tab id */
  const currentExample = ref("form-groups")

  /** 根据当前 tab id 查找对应的示例组件，默认回退到合并表单示例。 */
  const currentComponent = computed(() => {
    const example = examples.find((e) => e.id === currentExample.value)

    return example?.component || FormGroupsForm
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
    background: rgba(255, 255, 255, 0.82);
    -webkit-backdrop-filter: blur(20px) saturate(180%);
    backdrop-filter: blur(20px) saturate(180%);
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

  .nav button:active {
    transform: scale(0.97);
  }

  .nav button:focus-visible {
    outline: 3px solid rgba(25, 137, 250, 0.32);
    outline-offset: 2px;
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

  @media (prefers-reduced-motion: reduce) {
    .nav button {
      transition: none;
    }
  }

  @media (prefers-reduced-transparency: reduce) {
    .header {
      background: white;
      -webkit-backdrop-filter: none;
      backdrop-filter: none;
    }
  }
</style>
