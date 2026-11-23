<template>
  <div
    :class="[
      'schemx-renderer',
      'schemx-checkbox-renderer',
      className,
      { 'schemx-renderer-readonly': props.readonly },
    ]"
  >
    <SchemxCell
      v-if="props.readonly"
      :value="fieldValue"
      :placeholder="placeholder"
      :readonly-placeholder="props.readonlyPlaceholder"
      :readonly="props.readonly"
      :disabled="props.disabled"
    />

    <CheckboxGroup
      v-else
      v-bind="checkProps"
      :disabled="disabled"
      :model-value="modelValue"
      @update:model-value="handleChange"
    >
      <Checkbox
        v-for="option in options"
        :key="option[valueName]"
        :name="option[valueName]"
        :disabled="disabled || option[disabledName]"
        v-bind="option"
      >
        {{ option[labelName] }}
      </Checkbox>
    </CheckboxGroup>
  </div>
</template>

<script setup lang="ts">
  /**
   * 复选框渲染器组件
   *
   * 基于 Vant Checkbox 组件实现多选功能。
   *
   * @module renderers/CheckboxRenderer
   */
  import { computed, useAttrs } from "vue"

  import { Checkbox, CheckboxGroup } from "vant"

  import SchemxCell from "@/components/Cell/index.vue"
  import { getFieldProps } from "@/utils"

  import type { CheckboxRendererProps, CheckboxValue } from "./types"

  import "./index.scss"

  defineOptions({
    name: "CheckboxRendererComponent",
    inheritAttrs: false,
  })

  const props = withDefaults(defineProps<CheckboxRendererProps>(), {
    value: () => [],
    onChange: () => {},
    options: () => [],
    fieldNames: () => ({}),
    className: "",
    view: false,
    readonly: false,
    readonlyPlaceholder: "-",
    disabled: false,
  })

  const attrs = useAttrs() as Record<string, any>

  const checkboxValue = defineModel<CheckboxValue>("value")

  const labelName = computed(() => props.fieldNames?.label || "label")
  const valueName = computed(() => props.fieldNames?.value || "value")
  const disabledName = computed(() => props.fieldNames?.disabled || "disabled")

  const placeholder = computed(() => props.placeholder || "请选择")

  const contentAlign = computed(() => getFieldProps(attrs, "align", "right"))

  const modelValue = computed(() => {
    const value = checkboxValue.value ?? props.value

    if (!value) return []

    return typeof value === "string" ? (value as string).split(",") : value
  })

  const fieldValue = computed(() => {
    return modelValue.value?.map((v: any) => getOption(v, labelName.value)).join("、")
  })

  const checkProps = computed(() => {
    const { value, className, formItemProps, ...rest } = props

    const style = {
      display: "flex",
      flexWrap: "wrap",
      gap: "8px 12px",
      justifyContent: contentAlign.value,
      ...(attrs?.style || {}),
    }

    return { ...attrs, ...rest, style }
  })

  const handleChange = (value: CheckboxValue): void => {
    if (props.readonly || props.disabled) return
    checkboxValue.value = value
    props.onChange?.(value)
  }

  /**
   * 获取选项的指定字段值
   */
  const getOption = (v: any, key: string): any => {
    const option = props.options.find((option) => option[valueName.value] === v)

    return option ? option[key] : v
  }
</script>
