<template>
  <div
    :class="[
      'schemx-renderer',
      'schemx-radio-renderer',
      className,
      { 'schemx-renderer-readonly': props.readonly },
    ]"
    :style="{ textAlign: contentAlign }"
  >
    <SchemxCell
      v-if="props.readonly"
      :value="fieldValue"
      :placeholder="placeholder"
      :readonly-placeholder="props.readonlyPlaceholder"
      :readonly="props.readonly"
      :disabled="props.disabled"
    />
    <RadioGroup
      v-else
      v-bind="radioProps"
      :model-value="radioValue"
      @update:model-value="handleChange"
    >
      <Radio
        v-for="option in options"
        :key="option[valueName]"
        :name="option[valueName]"
        :disabled="disabled || option[disabledName]"
        v-bind="option"
      >
        {{ option[labelName] }}
      </Radio>
    </RadioGroup>
  </div>
</template>

<script setup lang="ts">
  /**
   * 单选框渲染器组件
   *
   * 基于 Vant Radio 组件实现单选功能。
   *
   * @module renderers/RadioRenderer
   */
  import { computed, useAttrs } from "vue"

  import { Radio, RadioGroup } from "vant"

  import SchemxCell from "@/components/Cell/index.vue"
  import { getFieldProps } from "@/utils"

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
    view: false,
    readonly: false,
    readonlyPlaceholder: "-",
    disabled: false,
  })

  const attrs = useAttrs() as Record<string, any>

  const radioValue = defineModel<RadioValue>("value")

  const labelName = computed(() => props.fieldNames?.label || "label")
  const valueName = computed(() => props.fieldNames?.value || "value")
  const disabledName = computed(() => props.fieldNames?.disabled || "disabled")

  const placeholder = computed(() => props.placeholder || "请选择")

  const contentAlign = computed(() => getFieldProps(attrs, "align", "right"))

  const fieldValue = computed(() => {
    return getOption(radioValue.value ?? props.value, labelName.value)
  })

  const radioProps = computed(() => {
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

  const handleChange = (value: RadioValue): void => {
    if (props.readonly || props.disabled) return

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
