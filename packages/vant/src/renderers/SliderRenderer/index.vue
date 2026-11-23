<template>
  <div :class="['schemx-renderer', 'schemx-slider-renderer', props.className]">
    <SchemxCell
      v-if="props.readonly"
      :value="displayValue"
      :placeholder="placeholder"
      :readonly-placeholder="props.readonlyPlaceholder"
      :readonly="props.readonly"
      :disabled="props.disabled"
    />
    <Slider
      v-else
      v-bind="sliderProps"
      :model-value="sliderValue"
      @update:model-value="handleChange"
    />
  </div>
</template>

<script setup lang="ts">
  /**
   * 滑块渲染器组件
   *
   * 基于 Vant Slider 实现滑块功能。
   *
   * @module renderers/SliderRenderer
   */
  import { computed, useAttrs } from "vue"

  import { Slider } from "vant"

  import SchemxCell from "@/components/Cell/index.vue"

  import type { SliderRendererProps, SliderValue } from "./types"

  import "./index.scss"

  defineOptions({
    name: "SliderRendererComponent",
    inheritAttrs: false,
  })

  const props = withDefaults(defineProps<SliderRendererProps>(), {
    value: 0,
    min: 0,
    max: 100,
    step: 1,
    range: false,
    className: "",
    onChange: () => {},
    readonly: false,
    readonlyPlaceholder: "-",
    disabled: false,
    button: true,
  })

  const attrs = useAttrs()

  const sliderValue = defineModel<SliderValue>("value")

  const placeholder = computed(() => props.placeholder || "请选择")

  const displayValue = computed(() => {
    return Array.isArray(sliderValue.value)
      ? sliderValue.value.join(" - ")
      : sliderValue.value
  })

  const sliderProps = computed(() => {
    const { value, className, formItemProps, ...rest } = props

    return { ...attrs, ...rest }
  })

  /**
   * 处理值变化事件
   */
  const handleChange = (value: SliderValue): void => {
    if (props.readonly || props.disabled) return
    sliderValue.value = value
    props.onChange?.(value)
  }
</script>
