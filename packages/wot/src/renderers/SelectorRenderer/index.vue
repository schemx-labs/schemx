<template>
  <div
    v-if="readonly"
    class="schemx-selector-renderer"
    :class="className"
    :style="{ textAlign: align }"
  >
    {{ fieldValue }}
  </div>
  <div
    v-else
    class="schemx-renderer schemx-selector-renderer"
    :class="[
      className,
      {
        'schemx-renderer-readonly': readonly,
        'schemx-renderer-disabled': disabled,
      },
    ]"
  >
    <Selector
      v-bind="selectorProps"
      :options="options"
      :field-names="fieldNames"
      :disabled="disabled"
      :model-value="displayValue"
      :style="{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '8px 12px',
        justifyContent: align,
        ...(attrs?.style || {}),
      }"
      @update:model-value="handleChange"
    />
  </div>
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

  import { getFieldProps } from "../../utils"

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
    disabled: false,
  })

  const attrs = useAttrs() as Record<string, any>

  const selectorValue = defineModel<SelectValue>("value")

  const displayValue = computed<SelectValue>(() => selectorValue.value ?? props.value ?? "")

  // 剔除 Schemx 契约字段，避免内部事件和表单元信息透传给 Wot 组件。
  const selectorProps = computed(() => {
    const {
      value: _value,
      onChange: _onChange,
      className: _className,
      options: _options,
      fieldNames: _fieldNames,
      formItemProps: _formItemProps,
      ...rest
    } = props

    return { ...attrs, ...rest }
  })

  const labelName = computed(() => props.fieldNames?.label || "label")
  const valueName = computed(() => props.fieldNames?.value || "value")

  const disabled = computed(() => props.disabled)
  const readonly = computed(() => props.readonly)
  const align = computed(() => getFieldProps(attrs, "align", "right"))

  const fieldValue = computed(() => {
    return getOption(selectorValue.value, labelName.value)
  })

  const handleChange = (value: SelectValue): void => {
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
