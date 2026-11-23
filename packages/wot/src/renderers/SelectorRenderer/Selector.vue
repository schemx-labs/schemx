<template>
  <div class="selector">
    <div
      v-for="item in options"
      :key="item[valueKey]"
      :class="optionClass(item)"
      @click="handleClick(item)"
    >
      <slot name="item" :item="item">
        {{ item[labelKey] }}
      </slot>
    </div>
  </div>
</template>

<script setup lang="ts">
  /**
   * 选择器子组件
   *
   * 提供选项列表渲染和选择交互功能。
   *
   * @module renderers/SelectorRenderer/Selector
   */
  import { computed } from "vue"

  import type { SelectorOption, SelectorProps, SelectValue } from "./types"

  import "./selector.scss"

  defineOptions({
    name: "SSelector",
  })

  const props = withDefaults(defineProps<SelectorProps>(), {
    modelValue: () => [],
    options: () => [],
    multiple: false,
    fieldNames: () => ({ label: "label", value: "value", disabled: "disabled" }),
    disabled: false,
  })

  const emit = defineEmits<{
    "update:modelValue": [value: SelectValue]
    change: [value: SelectValue, option: SelectorOption]
  }>()

  const labelKey = computed(() => props.fieldNames?.label || "label")
  const valueKey = computed(() => props.fieldNames?.value || "value")
  const disabledKey = computed(() => props.fieldNames?.disabled || "disabled")

  const selectedValues = computed(() => {
    if (props.multiple) {
      return Array.isArray(props.modelValue) ? props.modelValue : []
    }

    return props.modelValue === undefined || props.modelValue === null
      ? []
      : [props.modelValue]
  })

  const options = computed(() => (Array.isArray(props.options) ? props.options : []))

  /**
   * 判断选项是否选中
   */
  const isSelected = (option: SelectorOption): boolean => {
    return selectedValues.value.includes(option?.[valueKey.value])
  }

  /**
   * 处理选项点击
   */
  const handleClick = (option: SelectorOption): void => {
    if (props.disabled || option?.[disabledKey.value]) return

    const value = option?.[valueKey.value]

    if (props.multiple) {
      const next = selectedValues.value.includes(value)
        ? selectedValues.value.filter((item) => item !== value)
        : [...selectedValues.value, value]

      emit("update:modelValue", next)
      emit("change", next, option)

      return
    }

    emit("update:modelValue", value)
    emit("change", value, option)
  }

  /**
   * 计算选项类名
   */
  const optionClass = (item: SelectorOption): Record<string, boolean> => ({
    option: true,
    active: isSelected(item),
    disabled: props.disabled || !!item?.[disabledKey.value],
  })
</script>
