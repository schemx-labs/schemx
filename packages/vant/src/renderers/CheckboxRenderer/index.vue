<template>
  <Wrapper
    :class="['schemx-renderer', 'schemx-checkbox-renderer', className]"
    :readonly="props.readonly"
    :disabled="props.disabled"
  >
    <template #readonly>
      <span :style="`text-align: ${contentAlign}`">
        {{ getReadonlyDisplayValue(fieldValue, props.readonlyPlaceholder) }}
      </span>
    </template>
    <CheckboxGroup
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
  </Wrapper>
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

  import { Wrapper } from "@schemx/vue"

  import { getFieldProps, getReadonlyDisplayValue } from "@/utils"

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
    readonly: false,
    readonlyPlaceholder: "-",
    disabled: false,
  })

  const attrs = useAttrs() as Record<string, any>

  const checkboxValue = defineModel<CheckboxValue>("value")

  const labelName = computed(() => props.fieldNames?.label || "label")

  const valueName = computed(() => props.fieldNames?.value || "value")

  const disabledName = computed(() => props.fieldNames?.disabled || "disabled")

  const contentAlign = computed(
    () =>
      getFieldProps(props?.formItemProps, "contentAlign", "right") ??
      getFieldProps(attrs as Record<string, any>, "align", "right")
  )

  const modelValue = computed(() => {
    const value = checkboxValue.value ?? props.value

    if (!value) return []

    return typeof value === "string" ? (value as string).split(",") : value
  })

  const fieldValue = computed(() => {
    return modelValue.value?.map((v: any) => getOption(v, labelName.value)).join("、")
  })

  const checkProps = computed(() => {
    const rendererProps = props as typeof props & { formInstance?: unknown }

    const {
      value: _value,
      onChange: _onChange,
      options: _options,
      fieldNames: _fieldNames,
      className: _className,
      readonly: _readonly,
      readonlyPlaceholder: _readonlyPlaceholder,
      placeholder: _placeholder,
      formItemProps: _formItemProps,
      formInstance: _formInstance,
      ...rest
    } = rendererProps

    const {
      style: attrsStyle,
      options: _attrsOptions,
      fieldNames: _attrsFieldNames,
      readonly: _attrsReadonly,
      readonlyPlaceholder: _attrsReadonlyPlaceholder,
      placeholder: _attrsPlaceholder,
      formItemProps: _attrsFormItemProps,
      formInstance: _attrsFormInstance,
      ...attrsRest
    } = attrs

    const style = {
      display: "flex",
      flexWrap: "wrap",
      gap: "8px 12px",
      justifyContent: contentAlign.value,
      ...(attrsStyle || {}),
    }

    return { ...attrsRest, ...rest, style }
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
