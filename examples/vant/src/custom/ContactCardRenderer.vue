<!-- eslint-disable vue/prop-name-casing -->
<template>
  <div class="contact-card-renderer">
    <van-cell class="contact-card-renderer__header" title="自定义子渲染器">
      <template #value>
        <van-tag type="primary">contact-card</van-tag>
      </template>
    </van-cell>

    <van-field
      :model-value="contact.name"
      label="姓名"
      placeholder="请输入姓名"
      :disabled="props.disabled"
      :readonly="props.readonly"
      @update:model-value="updateName"
      @blur="handleBlur"
    />
    <van-field
      :model-value="contact.phone"
      label="电话"
      type="tel"
      placeholder="请输入手机号"
      :disabled="props.disabled"
      :readonly="props.readonly"
      @update:model-value="updatePhone"
      @blur="handleBlur"
    />

    <div class="contact-card-renderer__footer">
      <van-button
        size="small"
        plain
        type="primary"
        :disabled="props.disabled || props.readonly"
        @click="fillExample"
      >
        填充示例
      </van-button>
      <span v-if="field.pending.value" class="contact-card-renderer__status"
        >处理中…</span
      >
      <span v-else class="contact-card-renderer__status">
        {{ field.dirty.value ? "已修改" : "未修改" }}
      </span>
    </div>

    <div v-if="field.errors.value.length" class="contact-card-renderer__error">
      {{ field.errors.value[0] }}
    </div>
  </div>
</template>

<script setup lang="ts">
  import { computed } from "vue"

  import {
    Button as VanButton,
    Cell as VanCell,
    Field as VanField,
    Tag as VanTag,
  } from "vant"

  import { useFieldContext } from "@schemx/vant"

  import type { ContactCardRendererProps, ContactCardValue } from "./types"

  defineOptions({
    name: "ContactCardRenderer",
    inheritAttrs: false,
  })

  // eslint-disable-next-line vue/prop-name-casing
  const props = defineProps<ContactCardRendererProps>()

  const field = useFieldContext()

  const contact = computed<ContactCardValue>(() => ({
    name: props.value?.name ?? "",
    phone: props.value?.phone ?? "",
  }))

  const updateValue = (patch: Partial<ContactCardValue>): void => {
    const nextValue: ContactCardValue = { ...contact.value, ...patch }

    props.onChange?.(nextValue)
    props["onUpdate:value"]?.(nextValue)
  }

  const updateName = (value: string | number): void => {
    updateValue({ name: String(value) })
  }

  const updatePhone = (value: string | number): void => {
    updateValue({ phone: String(value) })
  }

  const handleBlur = (): void => {
    props.onBlur?.(contact.value)
  }

  const fillExample = (): void => {
    updateValue({ name: "Ada Lovelace", phone: "13800138000" })
  }
</script>

<style scoped>
  .contact-card-renderer {
    padding: 8px 0;
    overflow: hidden;
    background: #fff;
    border: 1px solid #ebedf0;
    border-radius: 8px;
  }

  .contact-card-renderer__header {
    background: #f7f8fa;
  }

  .contact-card-renderer__footer {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 16px 4px;
  }

  .contact-card-renderer__status {
    color: #969799;
    font-size: 12px;
  }

  .contact-card-renderer__error {
    padding: 4px 16px 0;
    color: #ee0a24;
    font-size: 12px;
  }
</style>
