<template>
  <Wrapper
    :class="['schemx-renderer', 'schemx-date-picker-renderer', props.className]"
    :readonly="props.readonly"
    :disabled="props.disabled"
  >
    <template #readonly>
      {{ getReadonlyDisplayValue(displayValue, props.readonlyPlaceholder) }}
    </template>
    <ElDatePicker
      ref="datePickerRef"
      v-bind="datePickerProps"
      :model-value="currentValue"
      @update:model-value="handleUpdate"
      @blur="handleBlur"
      @focus="handleFocus"
    />
  </Wrapper>
</template>

<script setup lang="ts">
  /** 使用 Element Plus ElDatePicker 渲染日期字段。 */
  import { computed, ref, useAttrs } from "vue"

  import { Wrapper } from "@schemx/vue"
  import dayjs from "dayjs"
  import { ElDatePicker } from "element-plus"

  import { getElementProps } from "@/renderers/shared/props"
  import { getReadonlyDisplayValue } from "@/utils"

  import type { DatePickerRendererProps, DatePickerValue } from "./types"
  import type { DatePickerInstance } from "element-plus"

  defineOptions({
    name: "DatePickerRendererComponent",
    inheritAttrs: false,
  })

  const props = withDefaults(defineProps<DatePickerRendererProps>(), {
    value: undefined,
    type: "date",
    readonly: false,
    disabled: false,
    readonlyPlaceholder: "-",
    className: "",
  })

  const attrs = useAttrs() as Record<string, unknown>

  const valueModel = defineModel<DatePickerValue>("value")

  const datePickerRef = ref<DatePickerInstance>()

  const datePickerProps = computed(() => getElementProps(props, attrs))

  const currentValue = computed(() => valueModel.value ?? props.value ?? null)

  const displayValue = computed(() => formatValue(currentValue.value))

  /**
   * 格式化日期值用于只读展示。
   *
   * @param value - Element Plus 日期值。
   * @returns 面向用户的日期文本。
   */
  function formatValue(value: DatePickerValue): string {
    if (Array.isArray(value)) {
      return value.map((item) => formatValue(item)).join(" - ")
    }

    if (value instanceof Date || typeof value === "number") {
      return dayjs(value).format(props.format || "YYYY-MM-DD")
    }

    return value ? String(value) : ""
  }

  /**
   * 同步 Element Plus 日期值。
   *
   * @param value - Element Plus 产生的新日期值。
   */
  const handleUpdate = (value: DatePickerValue): void => {
    valueModel.value = value
    props.onChange?.(value)
  }

  /**
   * 处理日期控件失焦。
   *
   * @param _event - Element Plus 产生的原生失焦事件。
   */
  const handleBlur = (_event: FocusEvent): void => {
    props.onBlur?.(currentValue.value)
  }

  /**
   * 处理日期控件聚焦。
   *
   * @param event - Element Plus 产生的原生聚焦事件。
   */
  const handleFocus = (event: FocusEvent): void => {
    props.onFocus?.(event)
  }

  defineExpose({
    /** 聚焦内部日期输入控件。 */
    focus: () => datePickerRef.value?.focus(),
    /** 使内部日期输入控件失焦。 */
    blur: () => datePickerRef.value?.blur(),
  })
</script>
<style>
  .schemx-renderer {
    box-sizing: border-box;
    width: 100%;
  }

  .schemx-date-picker-renderer > .el-date-editor {
    --el-date-editor-width: 100%;
  }
</style>
