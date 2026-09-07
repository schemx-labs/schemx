<template>
  <Wrapper
    :class="['schemx-renderer', 'schemx-textarea-renderer', props.className]"
    :readonly="props.readonly"
    :disabled="props.disabled"
  >
    <template #readonly>
      {{ getReadonlyDisplayValue(textAreaValue, props.readonlyPlaceholder) }}
    </template>
    <SchemxInput
      ref="inputRef"
      v-model:value="textAreaValue"
      v-bind="inputProps"
      @change="props.onChange"
      @blur="props.onBlur"
      @focus="props.onFocus"
    >
      <template v-if="slots['left-icon']" #left-icon>
        <slot name="left-icon" />
      </template>
      <template v-if="slots['right-icon']" #right-icon>
        <slot name="right-icon" />
      </template>
      <template v-if="slots.button" #button>
        <slot name="button" />
      </template>
      <template v-if="slots.extra" #extra>
        <slot name="extra" />
      </template>
    </SchemxInput>
  </Wrapper>
</template>

<script setup lang="ts">
  /**
   * 文本域输入渲染器组件
   *
   * 基于 InputRenderer 实现，支持自适应高度。
   *
   * @module renderers/TextAreaRenderer
   */
  import { computed, ref, useSlots } from "vue"

  import { Wrapper } from "@schemx/vue"

  import SchemxInput from "@/components/Input"
  import { getReadonlyDisplayValue } from "@/utils"

  import type { TextAreaAutosize, TextAreaRendererProps } from "./types"

  import "./index.scss"

  defineOptions({
    name: "TextAreaRendererComponent",
    inheritAttrs: false,
  })

  const props = withDefaults(defineProps<TextAreaRendererProps>(), {
    className: "",
    autosize: () => ({ minRows: 2, maxRows: 6 }),
    autoSize: undefined,
    rows: undefined,
    placeholder: undefined,
    readonlyPlaceholder: "-",
    readonly: false,
    disabled: false,
    value: "",
    onFocus: undefined,
    align: "left",
    showWordLimit: false,
  })

  const textAreaValue = defineModel<string>("value")

  const slots = useSlots()

  const inputRef = ref<InstanceType<typeof SchemxInput> | null>(null)

  /** 兼容 autoSize 和 autosize */
  const computedAutosize = computed<boolean | TextAreaAutosize>(() => {
    return (props.autoSize ?? props.autosize ?? { minRows: 2, maxRows: 6 }) as
      boolean | TextAreaAutosize
  })

  /** 计算行数 */
  const computedRows = computed(() => {
    if (props.rows !== undefined) {
      return props.rows
    }

    const autosize = computedAutosize.value

    if (typeof autosize === "object" && autosize.minRows) {
      return autosize.minRows
    }

    return 2
  })

  const inputProps = computed(() => {
    const rendererProps = props as typeof props & { formInstance?: unknown }

    const {
      value: _value,
      onChange: _onChange,
      onBlur: _onBlur,
      onFocus: _onFocus,
      className: _className,
      rows: _rows,
      autosize: _autosize,
      autoSize: _autoSize,
      showWordLimit: _showWordLimit,
      formItemProps: _formItemProps,
      formInstance: _formInstance,
      ...rest
    } = rendererProps

    return {
      ...rest,
      type: "textarea" as const,
      rows: computedRows.value,
      autosize: computedAutosize.value,
      showWordLimit: props.showWordLimit && !props.readonly && !props.disabled,
    }
  })

  defineExpose({
    focus: () => inputRef.value?.focus?.(),
    blur: () => inputRef.value?.blur?.(),
  })
</script>
