<template>
  <div
    v-if="finalReadonly"
    class="schemx-rate-renderer schemx-rate-renderer--readonly"
    :class="className"
  >
    <WdRate
      v-bind="rateProps"
      :model-value="displayValue"
      :num="count"
      :allow-half="allowHalf"
      readonly
    />
  </div>
  <div
    v-else
    class="schemx-rate-renderer"
    :class="[className, { 'schemx-rate-renderer--disabled': finalDisabled }]"
  >
    <WdRate
      v-bind="rateProps"
      :model-value="displayValue"
      :num="count"
      :allow-half="allowHalf"
      :disabled="finalDisabled"
      @update:model-value="handleChange"
    />
  </div>
</template>

<script setup lang="ts">
  /**
   * 评分渲染器组件
   *
   * 基于 Wot UI Rate 组件实现评分功能。
   *
   * @module renderers/RateRenderer
   */
  import { computed, useAttrs } from "vue"

  import WdRate from "@wot-ui/ui/components/wd-rate/wd-rate.vue"

  import type { RateRendererProps, RateValue } from "./types"

  import "./index.scss"

  defineOptions({
    name: "RateRendererComponent",
    inheritAttrs: false,
  })

  const props = withDefaults(defineProps<RateRendererProps>(), {
    value: 0,
    count: 5,
    allowHalf: false,
    className: "",
    onChange: () => {},
    readonly: false,
    disabled: false,
  })

  const attrs = useAttrs()

  const rateValue = defineModel<RateValue>("value")

  const finalReadonly = computed(() => props.readonly)
  const finalDisabled = computed(() => props.disabled)

  const displayValue = computed<RateValue>(() => rateValue.value ?? props.value ?? 0)

  // 剔除 Schemx 契约字段，避免内部事件和表单元信息透传给 Wot 组件。
  const rateProps = computed(() => {
    const {
      value: _value,
      onChange: _onChange,
      className: _className,
      count: _count,
      formItemProps: _formItemProps,
      ...rest
    } = props

    return { ...attrs, ...rest }
  })

  const handleChange = (value: RateValue): void => {
    if (finalDisabled.value || finalReadonly.value) return
    rateValue.value = value
    props.onChange?.(value)
  }
</script>
