<template>
  <div
    :class="
      classNames('schemx-renderer', 'schemx-text-renderer', props.className, {
        'schemx-renderer-readonly': readonly,
        'schemx-renderer-disabled': disabled,
      })
    "
    @click="handleClickRoot"
  >
    <InputRenderer
      ref="inputRef"
      v-model:value="textValue"
      :type="props.type === 'password' ? 'text' : props.type"
      :show-password="props.type === 'password'"
      :placeholder="props.placeholder"
      :readonly="readonly"
      :disabled="disabled"
      :align="props.align"
      :maxlength="props.maxlength"
      :autofocus="props.autofocus"
      :clearable="props.clearable"
      :clear-trigger="props.clearTrigger"
      :prefix-icon="props.leftIcon"
      :suffix-icon="props.type === 'password' ? '' : props.rightIcon"
      :show-word-limit="props.showWordLimit && !readonly && !disabled"
      @change="props.onChange"
      @blur="props.onBlur"
      @focus="props.onFocus"
    >
      <template v-if="slots['left-icon']" #left-icon>
        <slot name="left-icon" />
      </template>

      <template v-if="props.type !== 'password' && slots['right-icon']" #right-icon>
        <slot name="right-icon" />
      </template>

      <template v-if="slots.button" #button>
        <slot name="button" />
      </template>
      <template v-if="slots.extra" #extra>
        <slot name="extra" />
      </template>
    </InputRenderer>
  </div>
</template>

<script setup lang="ts">
  /**
   * 文本输入渲染器组件
   *
   * 基于 Wot UI Input 实现，支持密码可见性切换。
   *
   * @module renderers/TextRenderer
   */
  import { computed, ref, useSlots } from "vue"

  import classNames from "classnames"

  import InputRenderer from "../InputRenderer"

  import type { TextRendererProps } from "./types"

  import "./index.scss"

  defineOptions({
    name: "TextRendererComponent",
    inheritAttrs: false,
  })

  const props = withDefaults(defineProps<TextRendererProps>(), {
    className: "",
    placeholder: undefined,
    readonly: false,
    disabled: false,
    value: "",
    align: "right",
    clearable: false,
    clearTrigger: "focus",
    leftIcon: "",
    rightIcon: "",
    showWordLimit: false,
  })

  const textValue = defineModel<string>("value")

  const slots = useSlots()

  const inputRef = ref<InstanceType<typeof InputRenderer> | null>(null)
  const readonly = computed(() => props.readonly)
  const disabled = computed(() => props.disabled)

  /** 点击非交互展示区域时聚焦输入框 */
  const handleClickRoot = (event: MouseEvent): void => {
    if (props.disabled) return

    const target = event.target

    console.log(" > ~ handleClickRoot ~ event.target:", event.target)

    if (!(target instanceof Element)) return

    inputRef.value?.focus()
  }

  defineExpose({
    focus: () => inputRef.value?.focus?.(),
    blur: () => inputRef.value?.blur?.(),
  })
</script>
