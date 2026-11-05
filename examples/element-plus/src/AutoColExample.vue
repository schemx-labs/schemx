<script setup lang="ts">
  import { ref } from "vue"

  import SchemxForm from "@schemx/element-plus"
  import { ElButton } from "element-plus"

  import type { SchemxField, SchemxInstance } from "@schemx/element-plus"

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

  // 工具栏显示实际校验反馈，不把错误提示混进说明文字。
  const feedback = ref("宽容器中自动排列，切换到 320px 观察换行。")

  /**
   * 校验混排字段，观察长错误提示对布局的影响。
   */
  const validateLayout = async (): Promise<void> => {
    // result 是当前示例表单返回的真实校验结果。
    const result = await form.value?.validate()

    feedback.value = result?.valid
      ? "校验通过，字段布局保持不变。"
      : "已显示校验提示，可继续切换容器宽度观察换行。"
  }

  /**
   * 恢复字段初始值并清除校验反馈。
   */
  const resetLayout = (): void => {
    form.value?.reset()
    feedback.value = "已清除输入与校验提示。"
  }

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
      componentType: "select",
      col: "auto",
      componentProps: {
        style: { width: "180px" },
        options: [{ label: "进行中", value: "active" }],
      },
    },
    { name: "date", label: "日期", componentType: "datePicker", col: "auto" },
    { name: "enabled", label: "启用", componentType: "switch", col: "auto" },
    {
      name: "note",
      label: "备注",
      componentType: "input",
      col: { span: 12 },
      required: { message: "请输入备注，这是一段用于检查错误区域换行的较长校验提示" },
    },
  ]

  // 自动列和栅格可以直接在字段上混合配置。
  const usageCode = `const schemas = [
  { name: "keyword", label: "关键词", componentType: "input", col: "auto" },
  { name: "enabled", label: "启用", componentType: "switch", col: "auto" },
  { name: "note", label: "备注", componentType: "input", col: { span: 12 } },
]

<SchemxForm :schemas="schemas" :row="{ gutter: [14, 16] }" />`
</script>

<template>
  <section class="example-panel">
    <header class="panel-heading">
      <div>
        <h2>自动列与栅格</h2>
        <p class="panel-description">
          字段配置 col: 'auto'；备注使用 col: { span: 12 }。
        </p>
      </div>
    </header>
    <div class="demo-toolbar">
      <div class="demo-segmented" role="group" aria-label="容器宽度">
        <button type="button" :aria-pressed="!narrow" @click="narrow = false">
          自适应宽度</button
        ><button type="button" :aria-pressed="narrow" @click="narrow = true">
          320px
        </button>
      </div>
      <div class="button-row">
        <ElButton size="small" @click="resetLayout">重置</ElButton
        ><ElButton size="small" @click="validateLayout">校验</ElButton>
      </div>
    </div>
    <div class="layout-stage">
      <div class="layout-viewport" :class="{ 'is-narrow': narrow }">
        <SchemxForm
          ref="form"
          :schemas="schemas"
          :initial-values="{
            keyword: '',
            status: '',
            date: '',
            enabled: false,
            note: '',
          }"
          :label-width="64"
          :row="{ gutter: [14, 16] }"
          :submitter="false"
          :resetter="false"
          :bordered="false"
        />
      </div>
    </div>
    <p class="layout-feedback inline-feedback" role="status">{{ feedback }}</p>
  </section>
  <details class="api-source">
    <summary>API 用法</summary>
    <pre class="data-preview">{{ usageCode }}</pre>
  </details>
</template>

<style scoped>
  .layout-stage {
    padding: 16px;
    overflow-x: auto;
  }
  .layout-viewport {
    width: 100%;
    border: 1px dashed #dcdfe6;
    padding: 12px;
  }
  .layout-viewport.is-narrow {
    width: 320px;
  }
  .layout-feedback {
    padding: 0 16px 12px;
  }
</style>
