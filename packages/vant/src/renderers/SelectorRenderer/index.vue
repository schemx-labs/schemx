<template>
  <div
    :class="[
      'schemx-renderer',
      'schemx-selector-renderer',
      className,
      {
        'schemx-renderer-readonly': readonly,
      },
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

    <Selector
      v-else
      v-bind="selectorProps"
      :options="options"
      :field-names="fieldNames"
      :disabled="props.disabled"
      :model-value="selectorValue"
      :style="{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '8px 12px',
        justifyContent: contentAlign,
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

  import SchemxCell from "@/components/Cell/index.vue"
  import { getFieldProps } from "@/utils"

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
    view: false,
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
    const { value, className: _className, formItemProps: _formItemProps, ...rest } = props

    return { ...attrs, rest }
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
