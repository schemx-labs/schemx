<template>
  <div
    v-if="finalReadonly"
    class="schemx-stepper-renderer schemx-stepper-renderer--readonly"
    :class="className"
  >
    <div class="schemx-stepper-renderer__readonly">
      <span class="schemx-stepper-renderer__readonly-value">
        {{ formatDisplayValue(stepperValue) }}
      </span>
    </div>
  </div>
  <div
    v-else
    class="schemx-stepper-renderer"
    :class="[className, { 'schemx-stepper-renderer--disabled': finalDisabled }]"
  >
    <WdInputNumber
      v-bind="stepperProps"
      :model-value="displayValue"
      :min="min"
      :max="max"
      :step="step"
      :input-type="integer ? 'digit' : 'number'"
      :precision="decimalLength"
      :disabled="finalDisabled"
      :allow-null="allowEmpty"
      @update:model-value="handleChange"
    />
  </div>
</template>

<script setup lang="ts">
  /**
   * 步进器渲染器组件
   *
   * 基于 Wot UI InputNumber 实现数值调节功能。
   *
   * @module renderers/StepperRenderer
   */
  import { computed, useAttrs } from "vue"

  import WdInputNumber from "@wot-ui/ui/components/wd-input-number/wd-input-number.vue"

  import type { StepperRendererProps, StepperValue } from "./types"

  import "./index.scss"

  defineOptions({
    name: "StepperRendererComponent",
    inheritAttrs: false,
  })

  const props = withDefaults(defineProps<StepperRendererProps>(), {
    value: 0,
    min: undefined,
    max: undefined,
    step: 1,
    integer: false,
    decimalLength: undefined,
    className: "",
    onChange: () => {},
    readonly: false,
    disabled: false,
    allowEmpty: false,
  })

  const attrs = useAttrs()

  const stepperValue = defineModel<StepperValue>("value")

  const displayValue = computed<StepperValue>(() => stepperValue.value ?? props.value ?? 0)

  // 剔除 Schemx 契约字段，避免内部事件和表单元信息透传给 Wot 组件。
  const stepperProps = computed(() => {
    const {
      value: _value,
      onChange: _onChange,
      className: _className,
      integer: _integer,
      decimalLength: _decimalLength,
      allowEmpty: _allowEmpty,
      formItemProps: _formItemProps,
      ...rest
    } = props

    return { ...attrs, ...rest }
  })

  const fieldProps = computed(() => ({
    readonly: props.readonly,
    disabled: props.disabled,
  }))

  const finalReadonly = computed(() => fieldProps.value.readonly)
  const finalDisabled = computed(() => fieldProps.value.disabled)

  /**
   * 处理值变化事件
   */
  const handleChange = (value: StepperValue): void => {
    if (finalDisabled.value || finalReadonly.value) return
    stepperValue.value = value
    props.onChange?.(value)
  }

  /**
   * 格式化显示值
   */
  const formatDisplayValue = (value?: StepperValue): string => {
    if (
      value === null ||
      value === undefined ||
      (value === ("" as any) && !props.allowEmpty)
    ) {
      return ""
    }

    return String(value)
  }
</script>
