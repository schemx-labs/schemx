<template>
  <Wrapper
    :class="['schemx-renderer', 'schemx-stepper-renderer', props.className]"
    :readonly="props.readonly"
    :disabled="props.disabled"
  >
    <template #readonly>
      <span class="schemx-stepper-renderer__readonly">
        {{
          getReadonlyDisplayValue(stepperValue ?? props.value, props.readonlyPlaceholder)
        }}
      </span>
    </template>
    <Stepper
      v-bind="stepperProps"
      :model-value="stepperValue"
      @update:model-value="handleChange"
    />
  </Wrapper>
</template>

<script setup lang="ts">
  /**
   * 步进器渲染器组件
   *
   * 基于 Vant Stepper 实现数值调节功能。
   *
   * @module renderers/StepperRenderer
   */
  import { computed, useAttrs } from "vue"

  import { Stepper } from "vant"

  import { Wrapper } from "@schemx/vue"

  import { getReadonlyDisplayValue } from "@/utils"

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
    readonlyPlaceholder: "-",
    disabled: false,
    allowEmpty: false,
  })

  const attrs = useAttrs()

  const stepperValue = defineModel<StepperValue>("value")

  const stepperProps = computed(() => {
    const rendererProps = props as typeof props & { formInstance?: unknown }

    const {
      value: _value,
      onChange: _onChange,
      className: _className,
      readonly: _readonly,
      readonlyPlaceholder: _readonlyPlaceholder,
      placeholder: _placeholder,
      formItemProps: _formItemProps,
      formInstance: _formInstance,
      ...rest
    } = rendererProps

    const {
      value: _attrsValue,
      onChange: _attrsOnChange,
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

  /**
   * 处理值变化事件
   */
  const handleChange = (value: StepperValue): void => {
    if (props.readonly || props.disabled) return
    stepperValue.value = value
    props.onChange?.(value)
  }
</script>
