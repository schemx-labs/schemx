<script setup lang="ts">
  import { computed, nextTick, onScopeDispose, ref } from "vue"

  import SchemxForm from "@schemx/element-plus"
  import { ElButton, ElSwitch } from "element-plus"

  import type { SchemxField, SchemxInstance } from "@schemx/element-plus"

  /**
   * 控件总览的数据模型，每个字段对应一个可交互的 Renderer。
   */
  interface ExampleValues {
    /**
     * 姓名输入。
     */
    name: string
    /**
     * 多行备注。
     */
    note: string
    /**
     * 自动补全选择结果。
     */
    suggestion: string | number
    /**
     * 颜色选择结果。
     */
    favoriteColor: string | null
    /**
     * 日期时间选择结果。
     */
    appointment: string | Date | null
    /**
     * 自由输入的标签。
     */
    tags: string[]
    /**
     * 六位验证码。
     */
    otp: string
    /**
     * 支持提及的输入。
     */
    mention: string
    /**
     * 数字输入值。
     */
    quantity: number | null
    /**
     * 开关状态。
     */
    enabled: boolean
    /**
     * 单选值。
     */
    gender: string
    /**
     * 多选值。
     */
    hobbies: string[]
    /**
     * 普通下拉选择。
     */
    choice: string | null
    /**
     * 模拟远程字典选择。
     */
    remoteChoice: string | null
    /**
     * 虚拟列表选择。
     */
    virtualChoice: string | null
    /**
     * 日期选择。
     */
    birthday: string | Date | null
    /**
     * 时间选择。
     */
    time: string | Date | null
    /**
     * 固定时间段选择。
     */
    fixedTime: string | null
    /**
     * 树节点选择。
     */
    category: string | null
    /**
     * 级联地区路径。
     */
    region: string[]
    /**
     * 可切换可见性的敏感输入。
     */
    secret: string
    /**
     * 评分值。
     */
    score: number
    /**
     * 滑块进度。
     */
    progress: number
    /**
     * 本地模拟上传的文件。
     */
    files: Array<{ name: string; url?: string }>
    /**
     * 用于演示分组展开和字段定位的嵌套值。
     */
    basic: {
      /**
       * 禁用状态下的用户名。
       */
      username: string
      /**
       * 定位操作的目标字段。
       */
      age: number
      /**
       * 嵌套开关。
       */
      notification: boolean
      /**
       * 嵌套单选值。
       */
      gender: "male" | "female"
    }
  }

  // 表单实例用于校验、重置、提交和字段定位。
  const formRef = ref<SchemxInstance<ExampleValues>>()

  // 提交结果以内联 JSON 展示，避免额外弹层。
  const submitResult = ref<unknown>()

  // 同时对比普通、只读与禁用状态。
  const readonly = ref(false)

  // 禁用状态独立于只读状态，便于对照两种行为。
  const disabled = ref(false)

  // 默认展示自动列，可切换栅格对比各类 Renderer 的宽度与换行。
  const autoColumns = ref(true)

  // 在工具栏播报校验或提交的实际结果。
  const feedback = ref("可直接编辑控件，或切换只读与禁用状态。")

  // 真实异步操作期间显示对应按钮的 loading 状态。
  const pending = ref<"validate" | "submit">()

  // 本地上传产生的临时地址在页面卸载时释放。
  const uploadUrls = new Set<string>()

  // 空值和已有值混合展示，便于观察占位和默认内容。
  const initialValues: ExampleValues = {
    name: "",
    note: "",
    suggestion: "",
    favoriteColor: null,
    appointment: null,
    tags: [],
    otp: "",
    mention: "",
    quantity: 1,
    enabled: true,
    gender: "female",
    hobbies: ["coding"],
    choice: null,
    remoteChoice: null,
    virtualChoice: null,
    birthday: null,
    time: null,
    fixedTime: null,
    category: null,
    region: [],
    secret: "demo-secret",
    score: 3,
    progress: 40,
    files: [],
    basic: {
      username: "Ada",
      age: 28,
      notification: true,
      gender: "female",
    },
  }

  // 保留所有控件配置，再按用途组织为可导航的分组。
  const rendererSchemas: SchemxField<ExampleValues>[] = [
    {
      name: "name",
      label: "姓名",
      componentType: "input",
      required: true,
    },
    {
      name: "note",
      label: "备注",
      componentType: "input",
      required: true,
      componentProps: {
        type: "textarea",
        autosize: { minRows: 2, maxRows: 5 },
      },
    },
    {
      name: "suggestion",
      label: "自动补全",
      componentType: "autocomplete",
      required: true,
      componentProps: {
        options: [
          { text: "Ada", id: "ada" },
          { text: "Grace", id: "grace" },
        ],
        props: { label: "text", value: "id" },
      },
    },
    {
      name: "favoriteColor",
      label: "颜色",
      componentType: "colorPicker",
      required: true,
    },
    {
      name: "appointment",
      label: "预约时间",
      componentType: "datetimePicker",
      required: true,
      componentProps: { valueFormat: "YYYY-MM-DD HH:mm:ss" },
    },
    {
      name: "tags",
      label: "标签",
      componentType: "inputTag",
      required: true,
      componentProps: { trigger: "Enter", clearable: true },
    },
    {
      name: "otp",
      label: "验证码",
      componentType: "inputOtp",
      required: true,
      componentProps: { length: 6, inputmode: "numeric" },
    },
    {
      name: "mention",
      label: "提及",
      componentType: "mention",
      required: true,
      componentProps: {
        options: [
          { label: "Ada", value: "Ada" },
          { label: "Grace", value: "Grace" },
        ],
      },
    },
    {
      name: "quantity",
      label: "数量",
      componentType: "inputNumber",
      required: true,
      componentProps: { min: 0, max: 99, precision: 0 },
    },
    {
      name: "enabled",
      label: "启用状态",
      componentType: "switch",
      required: true,
    },
    {
      name: "gender",
      label: "性别",
      componentType: "radio",
      required: true,
      componentProps: {
        options: [
          { label: "男", value: "male" },
          { label: "女", value: "female" },
        ],
      },
    },
    {
      name: "hobbies",
      label: "兴趣",
      componentType: "checkbox",
      required: true,
      componentProps: {
        options: [
          { label: "编程", value: "coding" },
          { label: "阅读", value: "reading" },
          { label: "音乐", value: "music" },
        ],
      },
    },
    {
      name: "choice",
      label: "选择器",
      componentType: "select",
      required: true,
      componentProps: {
        options: [
          { text: "选项 A", id: "a" },
          { text: "选项 B", id: "b" },
        ],
        props: { label: "text", value: "id" },
        clearable: true,
      },
    },
    {
      name: "virtualChoice",
      label: "虚拟化选择器",
      componentType: "virtualizedSelect",
      required: true,
      componentProps: {
        options: [
          { label: "虚拟选项 A", value: "a" },
          { label: "虚拟选项 B", value: "b" },
        ],
        height: 180,
      },
    },
    {
      name: "remoteChoice",
      label: "远程选择器",
      componentType: "select",
      required: true,
      componentProps: {
        dict: {
          api: async () => [
            { label: "远程选项 A", value: "remote-a" },
            { label: "远程选项 B", value: "remote-b" },
          ],
        },
        loadingText: "加载中",
      },
    },
    {
      name: "birthday",
      label: "生日",
      componentType: "datePicker",
      required: true,
      componentProps: { valueFormat: "YYYY-MM-DD", placeholder: "请选择日期" },
    },
    {
      name: "time",
      label: "时间",
      componentType: "timePicker",
      required: true,
      componentProps: { valueFormat: "HH:mm:ss" },
    },
    {
      name: "fixedTime",
      label: "固定时间",
      componentType: "timeSelect",
      required: true,
      componentProps: { start: "08:00", end: "18:00", step: "00:30" },
    },
    {
      name: "category",
      label: "树形选择",
      componentType: "treeSelect",
      required: true,
      componentProps: {
        options: [
          {
            value: "frontend",
            label: "前端",
            children: [{ value: "vue", label: "Vue" }],
          },
          { value: "backend", label: "后端" },
        ],
        filterable: true,
      },
    },
    {
      name: "region",
      label: "地区",
      componentType: "cascader",
      required: true,
      componentProps: {
        options: [
          {
            value: "east",
            label: "华东",
            children: [
              { value: "shanghai", label: "上海" },
              { value: "hangzhou", label: "杭州" },
            ],
          },
          {
            value: "south",
            label: "华南",
            children: [{ value: "shenzhen", label: "深圳" }],
          },
        ],
      },
    },
    {
      name: "secret",
      label: "敏感信息",
      componentType: "sensitiveInput",
      required: true,
    },
    {
      name: "score",
      label: "评分",
      componentType: "rate",
      required: true,
    },
    {
      name: "progress",
      label: "进度",
      componentType: "slider",
      required: true,
    },
    {
      name: "files",
      label: "附件",
      componentType: "upload",
      required: true,
      componentProps: {
        accept: "image/*",
        // file 是用户选择的本地文件；示例不向服务器发送文件。
        uploader: async (file) => {
          // 本地预览地址只在当前示例生命周期内有效。
          const url = URL.createObjectURL(file)

          uploadUrls.add(url)

          return { name: file.name, url }
        },
        listType: "text",
        multiple: true,
      },
    },
    {
      key: "basic-information",
      label: "分组与定位",
      collapsible: true,
      defaultCollapsed: true,
      children: [
        {
          name: "basic.username",
          label: "用户名（text）",
          componentType: "input",
          required: true,
          componentProps: { placeholder: "请输入用户名" },
          disabled: true,
        },
        {
          name: "basic.age",
          label: "年龄（number）",
          componentType: "inputNumber",
          required: true,
          componentProps: { min: 0, max: 150 },
        },
        {
          name: "basic.notification",
          label: "通知开关（switch）",
          componentType: "switch",
          required: true,
        },
        {
          name: "basic.gender",
          label: "性别（radio）",
          componentType: "radio",
          required: true,
          componentProps: {
            options: [
              { label: "男", value: "male" },
              { label: "女", value: "female" },
            ],
          },
        },
      ],
    },
  ]

  // 分组索引同时用于锚点导航和 Schema 分类，避免重复维护展示顺序。
  const sections = [
    {
      key: "inputs",
      label: "基础输入",
      fields: ["name", "note", "suggestion", "tags", "otp", "mention", "secret"],
    },
    {
      key: "choices",
      label: "选项与字典",
      fields: ["choice", "virtualChoice", "remoteChoice", "category", "region"],
    },
    {
      key: "dates",
      label: "日期与时间",
      fields: ["appointment", "birthday", "time", "fixedTime"],
    },
    {
      key: "values",
      label: "数值与状态",
      fields: [
        "quantity",
        "enabled",
        "gender",
        "hobbies",
        "score",
        "progress",
        "favoriteColor",
      ],
    },
    { key: "files", label: "文件上传", fields: ["files"] },
  ]

  // 每次只展示一类 Renderer，全部字段仍归属于同一份表单模型。
  const activeSection = ref("inputs")

  // 用途分类仅控制展示，保留现有字段配置和用户输入。
  const schemas = computed<SchemxField<ExampleValues>[]>(() => [
    // section 是当前用途分类及对应字段集合。
    ...sections.map((section) => ({
      key: section.key,
      label: section.label,
      visible: activeSection.value === section.key,
      layout: { span: 24 },
      children: rendererSchemas.filter(
        // schema 是原始控件配置，分组只选择对应字段。
        (schema) => "name" in schema && section.fields.includes(String(schema.name))
      ),
    })),
    // schema 是原来的嵌套分组，保留折叠和定位行为。
    ...rendererSchemas
      .filter(
        // schema 是原有的嵌套分组配置。
        (schema) => schema.key === "basic-information"
      )
      .map(
        // schema 的 key 保持不变，定位 API 仍能找到年龄字段。
        (schema) => ({
          ...schema,
          label: "分组与定位",
          visible: activeSection.value === "basic-information",
        })
      ),
  ])

  // 最小调用片段直接对应页面中的表单实例与操作按钮。
  const usageCode = `const formRef = ref<SchemxInstance>()
// 表单级自动列，分组内的 Renderer 同样继承此配置。
// <SchemxForm ref="formRef" :schemas="schemas" col="auto" />

await formRef.value?.validate()
const result = await formRef.value?.submit()
formRef.value?.reset()
await formRef.value?.scrollToField("basic.age")`

  /**
   * 校验全部控件，并在工具栏展示实际结果。
   */
  const validateForm = async (): Promise<void> => {
    pending.value = "validate"
    try {
      // result 是本次全表单校验结果。
      const result = await formRef.value?.validate()

      feedback.value = result?.valid
        ? "全部字段校验通过。"
        : "还有字段需要完善，请查看控件下方的提示。"
    } finally {
      pending.value = undefined
    }
  }

  /**
   * 提交完整表单，并以内联 JSON 显示结果。
   */
  const submitForm = async (): Promise<void> => {
    pending.value = "submit"
    try {
      submitResult.value = await formRef.value?.submit()
      feedback.value = "已生成本次提交结果。"
    } finally {
      pending.value = undefined
    }
  }

  /**
   * 恢复示例初始值，同时清空上一次提交结果。
   */
  const resetForm = (): void => {
    formRef.value?.reset()
    submitResult.value = undefined
    feedback.value = "已恢复初始值。"
  }

  /**
   * 展开基础信息分组，并滚动到年龄字段。
   */
  const scrollToBasicAge = async (): Promise<void> => {
    activeSection.value = "basic-information"
    await nextTick()
    await formRef.value?.scrollToField("basic.age", {
      block: "center",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      highlight: { duration: 0 },
    })
  }

  onScopeDispose(() => {
    // url 是本示例创建的文件预览地址。
    uploadUrls.forEach((url) => URL.revokeObjectURL(url))
  })
</script>

<template>
  <section class="example-panel">
    <header class="panel-heading">
      <div>
        <h2>表单与 Renderer</h2>
        <p class="panel-description">
          默认使用 col: "auto"，切换控件分类观察自然宽度与换行，也可对比栅格布局。
        </p>
      </div>
      <div class="state-switches">
        <label
          >只读
          <ElSwitch v-model="readonly" size="small" aria-label="表单只读状态" /></label
        ><label
          >禁用 <ElSwitch v-model="disabled" size="small" aria-label="表单禁用状态"
        /></label>
      </div>
    </header>

    <div class="demo-toolbar">
      <div class="demo-segmented" role="group" aria-label="列布局">
        <button type="button" :aria-pressed="autoColumns" @click="autoColumns = true">
          col: 'auto'
        </button>
        <button type="button" :aria-pressed="!autoColumns" @click="autoColumns = false">
          col: { span: 12 }
        </button>
      </div>
    </div>

    <nav class="renderer-index demo-segmented" aria-label="Renderer 分类">
      <button
        v-for="section in sections"
        :key="section.key"
        type="button"
        :aria-pressed="activeSection === section.key"
        @click="activeSection = section.key"
      >
        {{ section.label }}
      </button>
      <button
        type="button"
        :aria-pressed="activeSection === 'basic-information'"
        @click="activeSection = 'basic-information'"
      >
        分组与定位
      </button>
    </nav>

    <div class="renderer-preview">
      <SchemxForm
        ref="formRef"
        :initial-values="initialValues"
        :schemas="schemas"
        :readonly="readonly"
        :disabled="disabled"
        :col="autoColumns ? 'auto' : { span: 12, xs: 24 }"
        :row="{ gutter: [14, 24] }"
        label-position="top"
        :submitter="false"
        :resetter="false"
      />
    </div>

    <div class="renderer-actions">
      <div class="button-row">
        <ElButton size="small" :disabled="Boolean(pending)" @click="resetForm"
          >reset()</ElButton
        >
        <ElButton
          size="small"
          :loading="pending === 'validate'"
          :disabled="pending === 'submit'"
          @click="validateForm"
          >validate()</ElButton
        >
        <ElButton
          size="small"
          type="primary"
          :loading="pending === 'submit'"
          :disabled="pending === 'validate'"
          @click="submitForm"
          >submit()</ElButton
        >
        <ElButton
          v-if="activeSection === 'basic-information'"
          size="small"
          @click="scrollToBasicAge"
          >scrollToField('basic.age')</ElButton
        >
      </div>
      <p class="inline-feedback" role="status">{{ feedback }}</p>
    </div>
  </section>

  <details v-if="submitResult" open class="api-source">
    <summary>提交结果</summary>
    <pre class="data-preview">{{ JSON.stringify(submitResult, null, 2) }}</pre>
  </details>
  <details class="api-source">
    <summary>API 用法</summary>
    <pre class="data-preview">{{ usageCode }}</pre>
  </details>
</template>

<style scoped>
  .state-switches,
  .state-switches label {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
  }
  .state-switches {
    gap: 16px;
  }
  .renderer-index {
    padding: 0 16px 12px;
  }
  .renderer-preview {
    padding: 0 16px 8px;
    overflow-x: auto;
  }
  .renderer-preview :deep(.schemx-group__header) {
    padding: 8px 0 12px;
    font-size: 13px;
    font-weight: 500;
  }
  .renderer-preview :deep(.schemx-field__label) {
    font-size: 12px;
  }
  .renderer-actions {
    display: grid;
    gap: 8px;
    padding: 12px 16px;
    border-top: 1px solid var(--demo-border);
  }
</style>
