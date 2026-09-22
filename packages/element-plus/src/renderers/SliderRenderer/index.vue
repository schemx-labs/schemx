<template>
  <Wrapper
    :class="['schemx-renderer', 'schemx-slider-renderer', props.className]"
    :readonly="props.readonly"
    :disabled="props.disabled"
  >
    <template #readonly>
      {{ getReadonlyDisplayValue(displayValue, props.readonlyPlaceholder) }}
    </template>
    <ElSlider
      v-bind="sliderProps"
      :model-value="currentValue"
      @update:model-value="handleUpdate"
    />
  </Wrapper>
</template>

<script setup lang="ts">
  /** 使用 Element Plus ElSlider 渲染滑块字段。 */
  import { computed, useAttrs } from "vue"

  import { Wrapper } from "@schemx/vue"
  import { ElSlider } from "element-plus"

  import { getElementProps } from "@/renderers/shared/props"
  import { getReadonlyDisplayValue } from "@/utils"

  import type { SliderRendererProps, SliderValue } from "./types"

  defineOptions({
    name: "SliderRendererComponent",
    inheritAttrs: false,
  })

  const props = withDefaults(defineProps<SliderRendererProps>(), {
    value: 0,
    readonly: false,
    disabled: false,
    readonlyPlaceholder: "-",
    className: "",
  })

  const attrs = useAttrs() as Record<string, unknown>

  const valueModel = defineModel<SliderValue>("value")

  const sliderProps = computed(() => getElementProps(props, attrs))

  const currentValue = computed(() => valueModel.value ?? props.value ?? 0)

  const displayValue = computed(() =>
    Array.isArray(currentValue.value)
      ? currentValue.value.join(" - ")
      : currentValue.value
  )

  /**
   * 同步 Element Plus 滑块值。
   *
   * @param value - Element Plus 产生的新滑块值。
   */
  const handleUpdate = (value: number | number[]): void => {
    if (props.readonly || props.disabled) return

    const nextValue: SliderValue = Array.isArray(value)
      ? [value[0] ?? 0, value[1] ?? value[0] ?? 0]
      : value

    valueModel.value = nextValue
    props.onChange?.(nextValue)
  }
</script>

<style>
  .schemx-renderer {
    box-sizing: border-box;
    width: 100%;
  }
</style>
