<template>
  <div
    v-if="readonly"
    class="schemx-checkbox-renderer"
    :class="className"
    :style="{ textAlign: align }"
  >
    {{ fieldValue }}
  </div>
  <div
    v-else
    class="schemx-renderer schemx-checkbox-renderer"
    :class="[
      className,
      {
        'schemx-renderer-disabled': disabled,
        'schemx-renderer-readonly': readonly,
      },
    ]"
  >
    <WdCheckboxGroup
      v-bind="checkboxProps"
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
    >
      <WdCheckbox
        v-for="option in options"
        :key="option[valueName]"
        :name="option[valueName]"
        :disabled="disabled || option[disabledName]"
        v-bind="option"
      >
        {{ option[labelName] }}
      </WdCheckbox>
    </WdCheckboxGroup>
  </div>
</template>

<script setup lang="ts">
  /**
   * 复选框渲染器组件
   *
   * 基于 Wot UI Checkbox 组件实现多选功能。
   *
   * @module renderers/CheckboxRenderer
   */
  import { computed, useAttrs } from "vue"

  import WdCheckbox from "@wot-ui/ui/components/wd-checkbox/wd-checkbox.vue"
  import WdCheckboxGroup from "@wot-ui/ui/components/wd-checkbox-group/wd-checkbox-group.vue"

  import { getFieldProps } from "../../utils"

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
    disabled: false,
  })

  const attrs = useAttrs() as Record<string, any>

  const checkboxValue = defineModel<CheckboxValue>("value")

  const labelName = computed(() => props.fieldNames?.label || "label")
  const valueName = computed(() => props.fieldNames?.value || "value")
  const disabledName = computed(() => props.fieldNames?.disabled || "disabled")

  const disabled = computed(() => props.disabled)
  const readonly = computed(() => props.readonly)
  const align = computed(() => getFieldProps(attrs, "align", "right"))

  const modelValue = computed(() => {
    if (!checkboxValue.value) return []

    return typeof checkboxValue.value === "string"
      ? (checkboxValue.value as string).split(",")
      : checkboxValue.value
  })

  const displayValue = computed(() => modelValue.value)

  // 剔除 Schemx 契约字段，避免内部事件和表单元信息透传给 Wot 组件。
  const checkboxProps = computed(() => {
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

  const fieldValue = computed(() => {
    return modelValue.value?.map((v: any) => getOption(v, labelName.value)).join("、")
  })

  const handleChange = (value: CheckboxValue): void => {
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
