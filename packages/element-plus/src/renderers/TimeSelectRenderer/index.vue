<template>
  <Wrapper
    :class="['schemx-renderer', 'schemx-time-select-renderer', props.className]"
    :readonly="props.readonly"
    :disabled="props.disabled"
  >
    <template #readonly>
      {{ getReadonlyDisplayValue(displayValue, props.readonlyPlaceholder) }}
    </template>
    <ElTimeSelect
      ref="timeSelectRef"
      v-bind="timeSelectProps"
      :model-value="currentValue"
      @update:model-value="handleUpdate"
      @clear="handleClear"
      @blur="handleBlur"
      @focus="handleFocus"
    />
  </Wrapper>
</template>

<script setup lang="ts">
  /** 使用 Element Plus ElTimeSelect 渲染固定时间字段。 */
  import { computed, ref, useAttrs } from "vue"

  import { Wrapper } from "@schemx/vue"
  import { ElTimeSelect } from "element-plus"

  import { formatElementDateValue } from "@/renderers/shared/date"
  import { getElementProps } from "@/renderers/shared/props"
  import { getReadonlyDisplayValue } from "@/utils"

  import type { TimeSelectRendererProps, TimeSelectValue } from "./types"
  import type { TimeSelectInstance } from "element-plus"

  defineOptions({
    name: "TimeSelectRendererComponent",
    inheritAttrs: false,
  })

  const props = withDefaults(defineProps<TimeSelectRendererProps>(), {
    value: null,
    readonly: false,
    disabled: false,
    readonlyPlaceholder: "-",
    className: "",
  })

  const attrs = useAttrs() as Record<string, unknown>

  const valueModel = defineModel<TimeSelectValue>("value")

  const timeSelectRef = ref<TimeSelectInstance>()

  const currentValue = computed(() =>
    valueModel.value === undefined ? (props.value ?? null) : valueModel.value
  )

  const timeSelectProps = computed(() =>
    getElementProps(props, attrs, ["onClear", "onBlur", "onFocus"])
  )

  const displayValue = computed(() =>
    formatElementDateValue(currentValue.value, props.format ?? "HH:mm")
  )

  /** 同步固定时间值。 */
  const handleUpdate = (value: string | null): void => {
    if (props.readonly || props.disabled) return

    valueModel.value = value
    props.onChange?.(value)
  }

  /** 处理固定时间清空。 */
  const handleClear = (): void => {
    props.onClear?.()
  }

  /** 处理固定时间选择器失焦。 */
  const handleBlur = (event: FocusEvent): void => {
    props.onBlur?.(event)
  }

  /** 处理固定时间选择器聚焦。 */
  const handleFocus = (event: FocusEvent): void => {
    props.onFocus?.(event)
  }

  defineExpose({
    /** 聚焦内部固定时间选择器。 */
    focus: () => timeSelectRef.value?.focus(),
    /** 使内部固定时间选择器失焦。 */
    blur: () => timeSelectRef.value?.blur(),
  })
</script>

<style>
  .schemx-renderer {
    box-sizing: border-box;
    width: 100%;
  }
</style>
