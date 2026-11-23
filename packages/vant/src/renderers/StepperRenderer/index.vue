<template>
  <div :class="['schemx-renderer', 'schemx-stepper-renderer', props.className]">
    <SchemxCell
      v-if="props.readonly"
      :value="stepperValue"
      :placeholder="placeholder"
      :readonly-placeholder="props.readonlyPlaceholder"
      :readonly="props.readonly"
      :disabled="props.disabled"
    />
    <Stepper
      v-else
      v-bind="stepperProps"
      :model-value="stepperValue"
      @update:model-value="handleChange"
    />
  </div>
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

  import SchemxCell from "@/components/Cell/index.vue"

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

  const placeholder = computed(() => props.placeholder || "请选择")

  const stepperProps = computed(() => {
    const { value, className, formItemProps, ...rest } = props

    return { ...attrs, ...rest }
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
