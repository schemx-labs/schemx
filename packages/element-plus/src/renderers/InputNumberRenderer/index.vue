<template>
  <Wrapper
    :class="['schemx-renderer', 'schemx-input-number-renderer', props.className]"
    :readonly="props.readonly"
    :disabled="props.disabled"
  >
    <template #readonly>
      {{ getReadonlyDisplayValue(valueModel, props.readonlyPlaceholder) }}
    </template>
    <ElInputNumber
      ref="inputRef"
      v-bind="inputProps"
      :model-value="currentValue"
      @update:model-value="handleUpdate"
      @blur="handleBlur"
      @focus="handleFocus"
    />
  </Wrapper>
</template>

<script setup lang="ts">
  /** 使用 Element Plus ElInputNumber 渲染数值字段。 */
  import { computed, ref, useAttrs } from "vue"

  import { Wrapper } from "@schemx/vue"
  import { ElInputNumber } from "element-plus"

  import { getElementProps } from "@/renderers/shared/props"
  import { getReadonlyDisplayValue } from "@/utils"

  import type { InputNumberRendererProps, InputNumberValue } from "./types"
  import type { InputNumberInstance } from "element-plus"

  defineOptions({
    name: "InputNumberRendererComponent",
    inheritAttrs: false,
  })

  const props = withDefaults(defineProps<InputNumberRendererProps>(), {
    value: null,
    readonly: false,
    disabled: false,
    readonlyPlaceholder: "-",
    className: "",
  })

  const attrs = useAttrs() as Record<string, unknown>

  const valueModel = defineModel<InputNumberValue>("value")

  const inputRef = ref<InputNumberInstance>()

  const currentValue = computed(() => valueModel.value ?? props.value ?? null)

  const inputProps = computed(() => getElementProps(props, attrs))

  /**
   * 同步 Element Plus 数字值。
   *
   * @param value - Element Plus 产生的数字或空值。
   */
  const handleUpdate = (value: number | undefined): void => {
    const nextValue = value ?? null

    valueModel.value = nextValue
    props.onChange?.(nextValue)
  }

  /**
   * 处理数字输入失焦。
   *
   * @param event - 原生失焦事件。
   */
  const handleBlur = (_event: FocusEvent): void => {
    props.onBlur?.(currentValue.value)
  }

  /**
   * 处理数字输入聚焦。
   *
   * @param event - 原生聚焦事件。
   */
  const handleFocus = (event: FocusEvent): void => {
    props.onFocus?.(event)
  }

  defineExpose({
    /** 聚焦内部数字输入框。 */
    focus: () => inputRef.value?.focus(),
    /** 使内部数字输入框失焦。 */
    blur: () => inputRef.value?.blur(),
  })
</script>

<style>
  .schemx-renderer {
    box-sizing: border-box;
    width: 100%;
  }
</style>
