<template>
  <Wrapper
    :class="['schemx-renderer', 'schemx-color-picker-renderer', props.className]"
    :readonly="props.readonly"
    :disabled="props.disabled"
  >
    <template #readonly>
      {{ getReadonlyDisplayValue(currentValue, props.readonlyPlaceholder) }}
    </template>
    <ElColorPicker
      ref="colorPickerRef"
      v-bind="colorPickerProps"
      :model-value="currentValue"
      @update:model-value="handleUpdate"
      @active-change="handleActiveChange"
      @clear="handleClear"
      @blur="handleBlur"
      @focus="handleFocus"
    />
  </Wrapper>
</template>

<script setup lang="ts">
  /** 使用 Element Plus ElColorPicker 渲染颜色字段。 */
  import { computed, ref, useAttrs } from "vue"

  import { Wrapper } from "@schemx/vue"
  import { ElColorPicker } from "element-plus"

  import { getElementProps } from "@/renderers/shared/props"
  import { getReadonlyDisplayValue } from "@/utils"

  import type { ColorPickerRendererProps, ColorPickerValue } from "./types"
  import type { ColorPickerInstance } from "element-plus"

  defineOptions({
    name: "ColorPickerRendererComponent",
    inheritAttrs: false,
  })

  const props = withDefaults(defineProps<ColorPickerRendererProps>(), {
    value: null,
    readonly: false,
    disabled: false,
    readonlyPlaceholder: "-",
    className: "",
  })

  const attrs = useAttrs() as Record<string, unknown>

  const valueModel = defineModel<ColorPickerValue>("value")

  const colorPickerRef = ref<ColorPickerInstance>()

  const currentValue = computed(() =>
    valueModel.value === undefined ? (props.value ?? null) : valueModel.value
  )

  const colorPickerProps = computed(() =>
    getElementProps(props, attrs, ["onActiveChange", "onClear", "onBlur", "onFocus"])
  )

  /** 同步颜色值。 */
  const handleUpdate = (value: ColorPickerValue): void => {
    if (props.readonly || props.disabled) return

    valueModel.value = value
    props.onChange?.(value)
  }

  /** 处理激活颜色变化。 */
  const handleActiveChange = (value: ColorPickerValue): void => {
    props.onActiveChange?.(value)
  }

  /** 处理颜色清空。 */
  const handleClear = (): void => {
    props.onClear?.()
  }

  /** 处理颜色选择器失焦。 */
  const handleBlur = (event: FocusEvent): void => {
    props.onBlur?.(event)
  }

  /** 处理颜色选择器聚焦。 */
  const handleFocus = (event: FocusEvent): void => {
    props.onFocus?.(event)
  }

  defineExpose({
    /** 聚焦内部颜色选择器。 */
    focus: () => colorPickerRef.value?.focus(),
    /** 使内部颜色选择器失焦。 */
    blur: () => colorPickerRef.value?.blur(),
  })
</script>

<style>
  .schemx-renderer {
    box-sizing: border-box;
    width: 100%;
  }
</style>
