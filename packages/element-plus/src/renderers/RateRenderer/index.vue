<template>
  <Wrapper
    :class="['schemx-renderer', 'schemx-rate-renderer', props.className]"
    :readonly="props.readonly"
    :disabled="props.disabled"
  >
    <template #readonly>
      <ElRate v-bind="rateProps" :model-value="currentValue" disabled />
    </template>
    <ElRate
      v-bind="rateProps"
      :model-value="currentValue"
      @update:model-value="handleUpdate"
    />
  </Wrapper>
</template>

<script setup lang="ts">
  /** 使用 Element Plus ElRate 渲染评分字段。 */
  import { computed, useAttrs } from "vue"

  import { Wrapper } from "@schemx/vue"
  import { ElRate } from "element-plus"

  import { getElementProps } from "@/renderers/shared/props"

  import type { RateRendererProps, RateValue } from "./types"

  defineOptions({
    name: "RateRendererComponent",
    inheritAttrs: false,
  })

  const props = withDefaults(defineProps<RateRendererProps>(), {
    value: 0,
    readonly: false,
    disabled: false,
    readonlyPlaceholder: "-",
    className: "",
  })

  const attrs = useAttrs() as Record<string, unknown>

  const valueModel = defineModel<RateValue>("value")

  const currentValue = computed(() => valueModel.value ?? props.value ?? 0)

  const rateProps = computed(() => getElementProps(props, attrs))

  /**
   * 同步 Element Plus 评分值。
   *
   * @param value - Element Plus 产生的新评分。
   */
  const handleUpdate = (value: number): void => {
    if (props.readonly || props.disabled) return

    valueModel.value = value
    props.onChange?.(value)
  }
</script>

<style>
  .schemx-renderer {
    box-sizing: border-box;
    width: 100%;
  }
</style>
