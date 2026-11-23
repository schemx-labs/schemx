<template>
  <div :class="['schemx-renderer', 'schemx-textarea-renderer', props.className]">
    <SchemxCell
      v-if="props.readonly"
      :value="textAreaValue"
      :placeholder="props.placeholder"
      :readonly-placeholder="props.readonlyPlaceholder"
      :readonly="props.readonly"
      :disabled="props.disabled"
    />
    <SchemxInput
      v-else
      ref="inputRef"
      v-model:value="textAreaValue"
      type="textarea"
      :placeholder="props.placeholder"
      :readonly-placeholder="props.readonlyPlaceholder"
      :readonly="props.readonly"
      :disabled="props.disabled"
      :align="props.align"
      :rows="computedRows"
      :autosize="computedAutosize"
      :maxlength="props.maxlength"
      :show-word-limit="props.showWordLimit && !props.readonly && !props.disabled"
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
  </div>
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

  import SchemxCell from "@/components/Cell/index.vue"
  import SchemxInput from "@/components/Input"

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
      | boolean
      | TextAreaAutosize
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

  defineExpose({
    focus: () => inputRef.value?.focus?.(),
    blur: () => inputRef.value?.blur?.(),
  })
</script>
