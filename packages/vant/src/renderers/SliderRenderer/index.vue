<template>
  <Wrapper
    :class="['schemx-renderer', 'schemx-slider-renderer', props.className]"
    :readonly="props.readonly"
    :disabled="props.disabled"
  >
    <template #readonly>
      <span class="schemx-slider-renderer__readonly">
        {{ getReadonlyDisplayValue(displayValue, props.readonlyPlaceholder) }}
      </span>
    </template>
    <Slider
      v-bind="sliderProps"
      :model-value="sliderValue"
      @update:model-value="handleChange"
    />
  </Wrapper>
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

  import { Wrapper } from "@schemx/vue"

  import { getReadonlyDisplayValue } from "@/utils"

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
  })

  const attrs = useAttrs()

  const sliderValue = defineModel<SliderValue>("value")

  const displayValue = computed(() => {
    return Array.isArray(sliderValue.value)
      ? sliderValue.value.join(" - ")
      : sliderValue.value
  })

  const sliderProps = computed(() => {
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
  const handleChange = (value: SliderValue): void => {
    if (props.readonly || props.disabled) return
    sliderValue.value = value
    props.onChange?.(value)
  }
</script>
