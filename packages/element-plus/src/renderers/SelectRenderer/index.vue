<template>
  <Wrapper
    :class="['schemx-renderer', 'schemx-select-renderer', props.className]"
    :readonly="props.readonly"
    :disabled="props.disabled"
  >
    <template #readonly>
      {{ getReadonlyDisplayValue(displayValue, props.readonlyPlaceholder) }}
    </template>
    <ElSelect
      ref="selectRef"
      v-bind="selectProps"
      :model-value="currentValue"
      @update:model-value="handleUpdate"
      @remove-tag="handleRemoveTag"
      @visible-change="handleVisibleChange"
      @end-reached="handleEndReached"
      @clear="handleClear"
      @blur="handleBlur"
      @focus="handleFocus"
    >
      <template v-if="$slots.default" #default="slotProps">
        <slot name="default" v-bind="slotProps" />
      </template>
      <template v-if="$slots.header" #header>
        <slot name="header" />
      </template>
      <template v-if="$slots.footer" #footer>
        <slot name="footer" />
      </template>
      <template v-if="$slots.loading" #loading>
        <slot name="loading" />
      </template>
      <template v-if="$slots.tag" #tag="slotProps">
        <slot name="tag" v-bind="slotProps" />
      </template>
    </ElSelect>
  </Wrapper>
</template>

<script setup lang="ts">
  /** 使用 Element Plus ElSelect 渲染选项字段。 */
  import { computed, ref, useAttrs } from "vue"

  import { Wrapper } from "@schemx/vue"
  import { ElSelect } from "element-plus"

  import {
    getElementOptionDisplayValue,
    normalizeElementSelection,
  } from "@/renderers/shared/options"
  import { getElementProps } from "@/renderers/shared/props"
  import { getReadonlyDisplayValue } from "@/utils"

  import type { SelectRendererProps, SelectValue } from "./types"
  import type { ScrollbarDirection, SelectInstance } from "element-plus"

  defineOptions({
    name: "SelectRendererComponent",
    inheritAttrs: false,
  })

  const props = withDefaults(defineProps<SelectRendererProps>(), {
    value: null,
    readonly: false,
    disabled: false,
    readonlyPlaceholder: "-",
    className: "",
    options: () => [],
    multiple: false,
  })

  const attrs = useAttrs() as Record<string, unknown>

  const valueModel = defineModel<SelectValue>("value")

  const selectRef = ref<SelectInstance>()

  const currentValue = computed(() =>
    normalizeElementSelection(
      valueModel.value === undefined ? props.value : valueModel.value,
      props.multiple
    )
  )

  const displayValue = computed(() =>
    getElementOptionDisplayValue(currentValue.value, props.options ?? [], props.props)
  )

  const selectProps = computed(() => ({
    ...getElementProps(props, attrs, [
      "onRemoveTag",
      "onVisibleChange",
      "onEndReached",
      "onClear",
      "onBlur",
      "onFocus",
    ]),
  }))

  /** 同步选择值。 */
  const handleUpdate = (value: unknown): void => {
    if (props.readonly || props.disabled) return

    const nextValue = normalizeElementSelection(value, props.multiple)

    valueModel.value = nextValue
    props.onChange?.(nextValue)
  }

  /** 处理删除多选标签。 */
  const handleRemoveTag = (value: unknown): void => {
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      props.onRemoveTag?.(value)
    }
  }

  /** 处理下拉面板显示状态变化。 */
  const handleVisibleChange = (visible: boolean): void => {
    props.onVisibleChange?.(visible)
  }

  /** 处理下拉列表滚动到底部。 */
  const handleEndReached = (direction: ScrollbarDirection): void => {
    props.onEndReached?.(direction)
  }

  /** 处理选择清空。 */
  const handleClear = (): void => {
    props.onClear?.()
  }

  /** 处理选择器失焦。 */
  const handleBlur = (event: FocusEvent): void => {
    props.onBlur?.(event)
  }

  /** 处理选择器聚焦。 */
  const handleFocus = (event: FocusEvent): void => {
    props.onFocus?.(event)
  }

  defineExpose({
    /** 聚焦内部选择器。 */
    focus: () => selectRef.value?.focus(),
    /** 使内部选择器失焦。 */
    blur: () => selectRef.value?.blur(),
  })
</script>

<style>
  .schemx-renderer {
    box-sizing: border-box;
    width: 100%;
  }
</style>
