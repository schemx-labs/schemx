<template>
  <div class="example-container custom-renderer-example">
    <h2>自定义子渲染器</h2>
    <p class="description">
      这个字段由一个自定义 Renderer 负责，但 Renderer 内部继续组合 Vant Field、Button 和
      Tag。 它通过 <code>useFieldContext()</code> 读取当前字段的 dirty、pending 和 errors
      状态。
    </p>

    <Schemx
      ref="formRef"
      v-model="formData"
      :schemas="schemas"
      label-width="84px"
      :colon="true"
      :submitter="false"
      :resetter="false"
    />

    <div class="form-actions">
      <van-button type="primary" @click="fillContact">通过表单实例填充</van-button>
      <van-button @click="formRef?.reset()">重置</van-button>
      <van-button @click="formRef?.validate()">验证</van-button>
    </div>

    <div class="result-card">
      <h3>当前表单值</h3>
      <pre>{{ JSON.stringify(formData, null, 2) }}</pre>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref } from "vue"

  import { Button as VanButton } from "vant"

  import Schemx, { rendererRegistry } from "@schemx/vant"

  import ContactCardRenderer from "./ContactCardRenderer.vue"

  import type { ContactCardValue } from "./types"
  import type { SchemxExactBaseField, SchemxField, SchemxInstance } from "@schemx/vant"

  interface CustomRendererValues {
    contact: ContactCardValue
    note: string
  }

  rendererRegistry.register("contact-card", ContactCardRenderer)

  const formRef = ref<SchemxInstance<CustomRendererValues>>()

  const formData = ref<CustomRendererValues>({
    contact: {
      name: "Grace Hopper",
      phone: "13900139000",
    },
    note: "自定义 Renderer 也可以和普通 Vant Renderer 混用。",
  })

  const schemas: SchemxField<CustomRendererValues>[] = [
    {
      name: "contact",
      label: "联系人",
      componentType: "contact-card",
      required: true,
      rules: [
        {
          validator: (rule, value, callback, values, options) => {
            console.log(" > ~ value:", rule, value, callback, values, options)

            if (values?.name && values.phone) {
              callback()
            } else {
              callback("请完整填写姓名和电话")
            }
          },
        },
      ],
    },
    {
      name: "note",
      label: "备注",
      componentType: "textarea",
      componentProps: {
        rows: 2,
        maxlength: 80,
        showWordLimit: true,
      },
    },
  ]

  const fillContact = (): void => {
    formRef.value?.setFieldValue("contact", {
      name: "Katherine Johnson",
      phone: "13700137000",
    })
  }
</script>

<style scoped>
  .custom-renderer-example {
    padding: 16px;
  }

  .custom-renderer-example h2 {
    margin-bottom: 8px;
    color: #333;
  }

  .custom-renderer-example .description code {
    padding: 2px 4px;
    color: #1989fa;
    background: #f0f7ff;
    border-radius: 3px;
  }
</style>
