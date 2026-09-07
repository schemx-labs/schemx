<template>
  <Wrapper
    :class="['schemx-renderer', 'schemx-selector-renderer', className]"
    :readonly="props.readonly"
    :disabled="props.disabled"
  >
    <template #readonly>
      <span :style="`text-align: ${contentAlign}`">
        {{ getReadonlyDisplayValue(fieldValue, props.readonlyPlaceholder) }}
      </span>
    </template>
    <Selector
      v-bind="selectorProps"
      :options="options"
      :field-names="fieldNames"
      :disabled="props.disabled"
      :model-value="selectorValue"
      :style="{
        justifyContent: contentAlign,
        ...(attrs?.style || {}),
      }"
      @update:model-value="handleChange"
    />
  </Wrapper>
</template>

<script setup lang="ts">
  /**
   * 选择组渲染器组件
   *
   * 基于 Selector 子组件实现选择功能。
   *
   * @module renderers/SelectorRenderer
   */
  import { computed, useAttrs } from "vue"

  import { Wrapper } from "@schemx/vue"

  import { getFieldProps, getReadonlyDisplayValue } from "@/utils"

  import Selector from "./Selector.vue"

  import type { SelectorOption, SelectorRendererProps, SelectValue } from "./types"

  import "./index.scss"

  defineOptions({
    name: "SelectorRendererComponent",
    inheritAttrs: false,
  })

  const props = withDefaults(defineProps<SelectorRendererProps>(), {
    value: undefined,
    onChange: () => {},
    options: () => [],
    className: "",
    fieldNames: () => ({}),
    readonly: false,
    readonlyPlaceholder: "-",
    disabled: false,
  })

  const attrs = useAttrs() as Record<string, any>

  const selectorValue = defineModel<SelectValue>("value")

  const labelName = computed(() => props.fieldNames?.label || "label")

  const valueName = computed(() => props.fieldNames?.value || "value")

  const contentAlign = computed(() => getFieldProps(attrs, "align", "right"))

  const fieldValue = computed(() => {
    return getOption(selectorValue.value ?? props.value, labelName.value)
  })

  const selectorProps = computed(() => {
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
      style: _attrsStyle,
      value: _attrsValue,
      onChange: _attrsOnChange,
      options: _attrsOptions,
      fieldNames: _attrsFieldNames,
      className: _attrsClassName,
      readonly: _attrsReadonly,
      readonlyPlaceholder: _attrsReadonlyPlaceholder,
      placeholder: _attrsPlaceholder,
      formItemProps: _attrsFormItemProps,
      formInstance: _attrsFormInstance,
      ...attrsRest
    } = attrs

    return { ...attrsRest, ...rest }
  })

  const handleChange = (value: SelectValue): void => {
    if (props.readonly || props.disabled) return
    selectorValue.value = value
    props.onChange?.(value)
  }

  /**
   * 获取选项的指定字段值
   */
  const getOption = (v: any, key: string): any => {
    const option = props.options.find(
      (option: SelectorOption) => option[valueName.value] === v
    )

    return option ? option[key] : v
  }
</script>
