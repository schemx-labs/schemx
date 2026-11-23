<template>
  <div
    :class="
      classNames('schemx-renderer', 'schemx-textarea-renderer', props.className, {
        'schemx-renderer-readonly': readonly,
        'schemx-renderer-disabled': disabled,
      })
    "
  >
    <WdTextarea
      ref="inputRef"
      v-bind="textareaProps"
      :model-value="displayValue"
      custom-class="schemx-textarea-renderer__textarea"
      custom-textarea-class="schemx-textarea-renderer__control"
      :readonly="readonly"
      :disabled="disabled"
      :compact="true"
      @update:model-value="handleChange"
      @blur="props.onBlur"
      @focus="props.onFocus"
    />
    <slot v-if="$slots.extra" name="extra" />
  </div>
</template>

<script setup lang="ts">
  /**
   * 文本域输入渲染器组件
   *
   * 基于 Wot UI Textarea 实现，支持自适应高度。
   *
   * @module renderers/TextAreaRenderer
   */
  import { computed, ref, useAttrs } from "vue"

  import WdTextarea from "@wot-ui/ui/components/wd-textarea/wd-textarea.vue"
  import classNames from "classnames"

  import type { TextAreaRendererProps } from "./types"

  import "./index.scss"

  defineOptions({
    name: "TextAreaRendererComponent",
    inheritAttrs: false,
  })

  const props = withDefaults(defineProps<TextAreaRendererProps>(), {
    className: "",
    autoHeight: true,
    placeholder: undefined,
    readonly: false,
    disabled: false,
    value: "",
    onFocus: undefined,
    align: "left",
    showWordLimit: false,
  })

  const textAreaValue = defineModel<string>("value")

  const inputRef = ref<InstanceType<typeof WdTextarea> | null>(null)
  const attrs = useAttrs()

  const readonly = computed(() => props.readonly)
  const disabled = computed(() => props.disabled)
  const displayValue = computed(() => textAreaValue.value ?? props.value ?? "")

  // 剔除 Schemx 契约字段，避免内部事件和表单元信息透传给 Wot 组件。
  const textareaProps = computed(() => {
    const {
      value,
      onChange,
      onBlur,
      onFocus,
      className,
      readonly,
      disabled,
      formItemProps,
      ...restProps
    } = props

    return { ...attrs, ...restProps }
  })

  const handleChange = (value: string): void => {
    textAreaValue.value = value
    props.onChange?.(value)
  }

  defineExpose({
    focus: () =>
      (inputRef.value?.$el as Element | undefined)?.querySelector("textarea")?.focus?.(),
    blur: () =>
      (inputRef.value?.$el as Element | undefined)?.querySelector("textarea")?.blur?.(),
  })
</script>
