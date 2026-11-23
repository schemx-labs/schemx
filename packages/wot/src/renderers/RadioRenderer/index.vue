<template>
  <div
    v-if="readonly"
    class="schemx-radio-renderer"
    :class="className"
    :style="{ textAlign: align }"
  >
    {{ fieldValue }}
  </div>
  <div
    v-else
    class="schemx-renderer schemx-radio-renderer"
    :class="[
      className,
      {
        'schemx-renderer-readonly': readonly,
        'schemx-renderer-disabled': disabled,
      },
    ]"
  >
    <WdRadioGroup
      v-bind="radioProps"
      :model-value="displayValue"
      :style="{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '8px 12px',
        justifyContent: align,
        ...(attrs?.style || {}),
      }"
      @update:model-value="handleChange"
    >
      <WdRadio
        v-for="option in options"
        :key="option[valueName]"
        :value="option[valueName]"
        :disabled="disabled || option[disabledName]"
        v-bind="option"
      >
        {{ option[labelName] }}
      </WdRadio>
    </WdRadioGroup>
  </div>
</template>

<script setup lang="ts">
  /**
   * 单选框渲染器组件
   *
   * 基于 Wot UI Radio 组件实现单选功能。
   *
   * @module renderers/RadioRenderer
   */
  import { computed, useAttrs } from "vue"

  import WdRadio from "@wot-ui/ui/components/wd-radio/wd-radio.vue"
  import WdRadioGroup from "@wot-ui/ui/components/wd-radio-group/wd-radio-group.vue"

  import { getFieldProps } from "../../utils"

  import type { RadioRendererProps, RadioValue } from "./types"

  import "./index.scss"

  defineOptions({
    name: "RadioRendererComponent",
    inheritAttrs: false,
  })

  const props = withDefaults(defineProps<RadioRendererProps>(), {
    value: undefined,
    onChange: () => {},
    options: () => [],
    className: "",
    fieldNames: () => ({}),
    readonly: false,
    disabled: false,
  })

  const attrs = useAttrs() as Record<string, any>

  const radioValue = defineModel<RadioValue>("value")

  const displayValue = computed<RadioValue>(() => radioValue.value ?? props.value)

  // 剔除 Schemx 契约字段，避免内部事件和表单元信息透传给 Wot 组件。
  const radioProps = computed(() => {
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
  const disabledName = computed(() => props.fieldNames?.disabled || "disabled")

  const disabled = computed(() => props.disabled)
  const readonly = computed(() => props.readonly)
  const align = computed(() => getFieldProps(attrs, "align", "right"))

  const fieldValue = computed(() => {
    return getOption(radioValue.value, labelName.value)
  })

  const handleChange = (value: RadioValue): void => {
    radioValue.value = value
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
