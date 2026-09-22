<template>
  <main class="app">
    <section class="intro">
      <p class="eyebrow">SCHEMX / ELEMENT PLUS</p>
      <h1>Element Plus Renderer 示例</h1>
      <p>展示 Element Plus 适配包支持的输入、选项、日期时间和上传字段。</p>
    </section>
    <ElCard class="form-card">
      <SchemxForm ref="formRef" :initial-values="initialValues" :schemas="schemas" />

      <div class="actions">
        <ElButton type="primary" @click="submitForm">提交</ElButton>
        <ElButton @click="formRef?.validate()">校验</ElButton>
        <ElButton @click="formRef?.reset()">重置</ElButton>
      </div>
    </ElCard>

    <ElCard v-if="submitResult" class="result-card">
      <template #header>最近一次提交结果</template>
      <pre>{{ submitResult }}</pre>
    </ElCard>
  </main>
</template>

<script setup lang="ts">
  import { ref } from "vue"

  import SchemxForm, { type SchemxField, type SchemxInstance } from "@schemx/element-plus"
  import { ElButton, ElCard } from "element-plus"

  interface ExampleValues {
    name: string
    note: string
    suggestion: string | number
    favoriteColor: string | null
    appointment: string | Date | null
    tags: string[]
    otp: string
    mention: string
    quantity: number | null
    enabled: boolean
    gender: string
    hobbies: string[]
    choice: string | null
    remoteChoice: string | null
    virtualChoice: string | null
    birthday: string | Date | null
    time: string | Date | null
    fixedTime: string | null
    category: string | null
    region: string[]
    secret: string
    score: number
    progress: number
    files: Array<{ name: string; url?: string }>
    basic: {
      username: string
      website: string
      phone: string
      bio: string
      age: number
      notification: boolean
      gender: "male" | "female"
      hobbies: string[]
      birthday?: string
      travelDate?: string
      city?: string
      frequentCampus?: string
      affiliatedCampus?: string
      preferredCities: string[]
      education?: string
      satisfaction?: number
      volume?: number
      quantity?: number
      avatar: Array<{ name: string; url?: string }>
      region: string[]
    }
  }

  const formRef = ref<SchemxInstance<ExampleValues>>()

  const submitResult = ref<unknown>()

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
  }

  const schemas: SchemxField<ExampleValues>[] = [
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
      componentProps: {
        type: "textarea",
        autosize: { minRows: 2, maxRows: 5 },
      },
    },
    {
      name: "suggestion",
      label: "自动补全",
      componentType: "autocomplete",
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
    },
    {
      name: "appointment",
      label: "预约时间",
      componentType: "datetimePicker",
      componentProps: { valueFormat: "YYYY-MM-DD HH:mm:ss" },
    },
    {
      name: "tags",
      label: "标签",
      componentType: "inputTag",
      componentProps: { trigger: "Enter", clearable: true },
    },
    {
      name: "otp",
      label: "验证码",
      componentType: "inputOtp",
      componentProps: { length: 6, inputmode: "numeric" },
    },
    {
      name: "mention",
      label: "提及",
      componentType: "mention",
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
      componentProps: { min: 0, max: 99, precision: 0 },
    },
    {
      name: "enabled",
      label: "启用状态",
      componentType: "switch",
    },
    {
      name: "gender",
      label: "性别",
      componentType: "radio",
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
      componentProps: { valueFormat: "YYYY-MM-DD", placeholder: "请选择日期" },
    },
    {
      name: "time",
      label: "时间",
      componentType: "timePicker",
      componentProps: { valueFormat: "HH:mm:ss" },
    },
    {
      name: "fixedTime",
      label: "固定时间",
      componentType: "timeSelect",
      componentProps: { start: "08:00", end: "18:00", step: "00:30" },
    },
    {
      name: "category",
      label: "树形选择",
      componentType: "treeSelect",
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
    },
    {
      name: "score",
      label: "评分",
      componentType: "rate",
    },
    {
      name: "progress",
      label: "进度",
      componentType: "slider",
    },
    {
      name: "files",
      label: "附件",
      componentType: "upload",
      componentProps: {
        accept: "image/*",
        uploader: async (file) => ({
          name: file.name,
          url: URL.createObjectURL(file),
        }),
      },
    },
    {
      key: "basic-information",
      label: "基础信息",
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
          componentProps: { min: 0, max: 150 },
        },
        {
          name: "basic.notification",
          label: "通知开关（switch）",
          componentType: "switch",
        },
        {
          name: "basic.gender",
          label: "性别（radio）",
          componentType: "radio",
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

  /** 提交当前表单并展示返回结果。 */
  const submitForm = async (): Promise<void> => {
    submitResult.value = await formRef.value?.submit()
  }
</script>

<style>
  :root {
    color: #303133;
    background: #f4f7fb;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }

  body {
    margin: 0;
  }

  .app {
    width: min(960px, calc(100% - 32px));
    margin: 0 auto;
    padding: 48px 0;
  }

  .intro {
    margin-bottom: 24px;
  }

  .eyebrow {
    margin: 0 0 8px;
    color: var(--el-color-primary);
    font-size: 12px;
    letter-spacing: 0.12em;
  }

  h1 {
    margin: 0 0 8px;
  }

  .intro p:last-child {
    margin: 0;
    color: var(--el-text-color-secondary);
  }

  .actions {
    display: flex;
    gap: 8px;
    margin-top: 24px;
  }

  .result-card {
    margin-top: 24px;
  }

  pre {
    margin: 0;
    white-space: pre-wrap;
  }
</style>
