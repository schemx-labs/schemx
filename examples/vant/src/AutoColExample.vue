<script setup lang="ts">
  import { ref } from "vue"

  import SchemxForm from "@schemx/vant"

  import type { SchemxField, SchemxInstance } from "@schemx/vant"

  /**
   * 自动列示例中的控件值。
   */
  interface AutoValues {
    /**
     * 自然宽度的输入。
     */
    keyword: string
    /**
     * 显式宽度的选择器。
     */
    status: string
    /**
     * 默认宽度的日期控件。
     */
    date: string
    /**
     * 默认宽度的开关。
     */
    enabled: boolean
    /**
     * 按栅格排列的备注。
     */
    note: string
  }

  // 切换容器宽度，直接观察浏览器自然换行。
  const narrow = ref(false)

  // 校验与重置共用当前表单实例。
  const form = ref<SchemxInstance<AutoValues>>()

  // 普通列、自动列和显式控件宽度混合排列。
  const schemas: SchemxField<AutoValues>[] = [
    {
      name: "keyword",
      label: "关键词",
      componentType: "input",
      col: "auto",
      required: {
        message: "请输入关键词，这是一段用于检查自动列错误区域换行的较长校验提示",
      },
    },
    {
      name: "status",
      label: "状态",
      componentType: "selectPicker",
      col: "auto",
      componentProps: {
        style: { width: "180px" },
        options: [{ label: "进行中", value: "active" }],
      },
    },
    { name: "date", label: "日期", componentType: "date", col: "auto" },
    { name: "enabled", label: "启用", componentType: "switch", col: "auto" },
    {
      name: "note",
      label: "备注",
      componentType: "input",
      col: { span: 12 },
      required: { message: "请输入备注，这是一段用于检查错误区域换行的较长校验提示" },
    },
  ]
</script>

<template>
  <section class="auto-col-example">
    <h2>自动列与栅格混排</h2>
    <p>auto 只解除列的栅格宽度约束；控件宽度由 Renderer 自身决定，备注占 12 栅格。</p>
    <div class="auto-col-tools">
      <button type="button" @click="narrow = !narrow">
        {{ narrow ? "恢复宽容器" : "切换窄容器" }}
      </button>
      <button type="button" @click="form?.validate()">检查错误换行</button>
    </div>
    <div :style="{ width: narrow ? '320px' : '100%', maxWidth: '100%' }">
      <SchemxForm
        ref="form"
        :schemas="schemas"
        :initial-values="{ keyword: '', status: '', date: '', enabled: false, note: '' }"
        :label-width="64"
        :row="{ gutter: [12, 16] }"
        :action-col="'auto'"
        :bordered="false"
      />
    </div>
  </section>
</template>

<style scoped>
  .auto-col-example {
    padding: 20px;
    background: white;
    border: 1px solid #ddd;
    border-radius: 8px;
  }
  .auto-col-tools {
    display: flex;
    gap: 12px;
    margin-bottom: 16px;
  }
</style>
