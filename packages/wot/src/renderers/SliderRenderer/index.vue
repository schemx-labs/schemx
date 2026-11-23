<template>
  <div class="schemx-slider-renderer" :class="[className]">
    <WdSlider
      v-bind="sliderProps"
      :model-value="displayValue"
      @update:model-value="handleChange"
    />
  </div>
</template>

<script setup lang="ts">
  /**
   * 滑块渲染器组件
   *
   * 基于 Wot UI Slider 实现滑块功能。
   *
   * @module renderers/SliderRenderer
   */
  import { computed, useAttrs } from "vue"

  import WdSlider from "@wot-ui/ui/components/wd-slider/wd-slider.vue"

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
    disabled: false,
  })

  const attrs = useAttrs()

  const sliderValue = defineModel<SliderValue>("value")

  const displayValue = computed<SliderValue>(() => sliderValue.value ?? props.value ?? 0)

  // 剔除 Schemx 契约字段，避免内部事件和表单元信息透传给 Wot 组件。
  const sliderProps = computed(() => {
    const {
      value: _value,
      onChange: _onChange,
      className: _className,
      readonly: _readonly,
      formItemProps: _formItemProps,
      ...rest
    } = props

    return { ...attrs, ...rest }
  })

  /**
   * 处理值变化事件
   */
  const handleChange = (value: SliderValue): void => {
    if (props.disabled || props.readonly) return
    sliderValue.value = value
    props.onChange?.(value)
  }
</script>
