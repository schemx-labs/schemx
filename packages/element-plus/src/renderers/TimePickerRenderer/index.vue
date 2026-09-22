<template>
  <Wrapper
    :class="['schemx-renderer', 'schemx-time-picker-renderer', props.className]"
    :readonly="props.readonly"
    :disabled="props.disabled"
  >
    <template #readonly>
      {{ getReadonlyDisplayValue(displayValue, props.readonlyPlaceholder) }}
    </template>
    <ElTimePicker
      ref="timePickerRef"
      v-bind="timePickerProps"
      :model-value="currentValue"
      @update:model-value="handleUpdate"
      @blur="handleBlur"
      @focus="handleFocus"
    />
  </Wrapper>
</template>

<script setup lang="ts">
  /** 使用 Element Plus ElTimePicker 渲染时间字段。 */
  import { computed, ref, useAttrs } from "vue"

  import { Wrapper } from "@schemx/vue"
  import { ElTimePicker } from "element-plus"

  import { formatElementDateValue } from "@/renderers/shared/date"
  import { getElementProps } from "@/renderers/shared/props"
  import { getReadonlyDisplayValue } from "@/utils"

  import type { TimePickerRendererProps, TimePickerValue } from "./types"
  import type { TimePickerInstance } from "element-plus"

  defineOptions({
    name: "TimePickerRendererComponent",
    inheritAttrs: false,
  })

  const props = withDefaults(defineProps<TimePickerRendererProps>(), {
    value: null,
    readonly: false,
    disabled: false,
    readonlyPlaceholder: "-",
    className: "",
  })

  const attrs = useAttrs() as Record<string, unknown>

  const valueModel = defineModel<TimePickerValue>("value")

  const timePickerRef = ref<TimePickerInstance>()

  const currentValue = computed(() =>
    valueModel.value === undefined ? (props.value ?? null) : valueModel.value
  )

  const timePickerProps = computed(() =>
    getElementProps(props, attrs, ["onBlur", "onFocus"])
  )

  const displayValue = computed(() =>
    formatElementDateValue(
      currentValue.value,
      props.format ?? "HH:mm:ss",
      props.rangeSeparator ?? " - "
    )
  )

  /** 同步时间值。 */
  const handleUpdate = (value: TimePickerValue): void => {
    if (props.readonly || props.disabled) return

    valueModel.value = value
    props.onChange?.(value)
  }

  /** 处理时间选择器失焦。 */
  const handleBlur = (event: FocusEvent): void => {
    props.onBlur?.(event)
  }

  /** 处理时间选择器聚焦。 */
  const handleFocus = (event: FocusEvent): void => {
    props.onFocus?.(event)
  }

  defineExpose({
    /** 聚焦内部时间选择器。 */
    focus: () => timePickerRef.value?.focus(),
    /** 使内部时间选择器失焦。 */
    blur: () => timePickerRef.value?.blur(),
  })
</script>
<style>
  .schemx-renderer {
    box-sizing: border-box;
    width: 100%;
  }

  .schemx-time-picker-renderer > .el-date-editor {
    --el-date-editor-width: 100%;
  }
</style>
