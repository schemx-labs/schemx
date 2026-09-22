<template>
  <Wrapper
    :class="['schemx-renderer', 'schemx-date-time-picker-renderer', props.className]"
    :readonly="props.readonly"
    :disabled="props.disabled"
  >
    <template #readonly>
      {{ getReadonlyDisplayValue(displayValue, props.readonlyPlaceholder) }}
    </template>
    <ElDatePicker
      ref="dateTimePickerRef"
      v-bind="dateTimePickerProps"
      :model-value="currentValue"
      @update:model-value="handleUpdate"
      @blur="handleBlur"
      @focus="handleFocus"
    />
  </Wrapper>
</template>

<script setup lang="ts">
  /** 使用 Element Plus ElDatePicker 的 datetime 类型渲染日期时间字段。 */
  import { computed, ref, useAttrs } from "vue"

  import { Wrapper } from "@schemx/vue"
  import { ElDatePicker } from "element-plus"

  import { formatElementDateValue } from "@/renderers/shared/date"
  import { getElementProps } from "@/renderers/shared/props"
  import { getReadonlyDisplayValue } from "@/utils"

  import type { DateTimePickerRendererProps, DateTimePickerValue } from "./types"
  import type { DatePickerInstance } from "element-plus"

  defineOptions({
    name: "DateTimePickerRendererComponent",
    inheritAttrs: false,
  })

  const props = withDefaults(defineProps<DateTimePickerRendererProps>(), {
    value: undefined,
    type: "datetime",
    readonly: false,
    disabled: false,
    readonlyPlaceholder: "-",
    className: "",
  })

  const attrs = useAttrs() as Record<string, unknown>

  const valueModel = defineModel<DateTimePickerValue>("value")

  const dateTimePickerRef = ref<DatePickerInstance>()

  const currentValue = computed(() =>
    valueModel.value === undefined ? (props.value ?? null) : valueModel.value
  )

  const dateTimePickerProps = computed(() => ({
    ...getElementProps(props, attrs, ["type", "onBlur", "onFocus"]),
    type: props.type,
  }))

  const displayValue = computed(() =>
    formatElementDateValue(
      currentValue.value,
      props.format ?? "YYYY-MM-DD HH:mm:ss",
      props.rangeSeparator ?? " - "
    )
  )

  /** 同步日期时间值。 */
  const handleUpdate = (value: DateTimePickerValue): void => {
    if (props.readonly || props.disabled) return

    valueModel.value = value
    props.onChange?.(value)
  }

  /** 处理日期时间选择器失焦。 */
  const handleBlur = (event: FocusEvent): void => {
    props.onBlur?.(event)
  }

  /** 处理日期时间选择器聚焦。 */
  const handleFocus = (event: FocusEvent): void => {
    props.onFocus?.(event)
  }

  defineExpose({
    /** 聚焦内部日期时间选择器。 */
    focus: () => dateTimePickerRef.value?.focus(),
    /** 使内部日期时间选择器失焦。 */
    blur: () => dateTimePickerRef.value?.blur(),
  })
</script>
<style>
  .schemx-renderer {
    box-sizing: border-box;
    width: 100%;
  }

  .schemx-date-time-picker-renderer > .el-date-editor {
    --el-date-editor-width: 100%;
  }
</style>
