<template>
  <div
    :class="[
      'schemx-renderer',
      'schemx-rate-renderer',
      className,
      {
        'schemx-rate-renderer__readonly': props.readonly,
        'schemx-rate-renderer__disabled': props.disabled,
      },
    ]"
  >
    <Rate
      v-bind="rateProps"
      :model-value="rateValue"
      :count="count"
      :allow-half="allowHalf"
      :disabled="props.disabled"
      @update:model-value="handleChange"
    />
  </div>
</template>

<script setup lang="ts">
  /**
   * 评分渲染器组件
   *
   * 基于 Vant Rate 组件实现评分功能。
   *
   * @module renderers/RateRenderer
   */
  import { computed, useAttrs } from "vue"

  import { Rate } from "vant"

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
    readonlyPlaceholder: "-",
    disabled: false,
  })

  const attrs = useAttrs()

  const rateValue = defineModel<RateValue>("value")

  const rateProps = computed(() => {
    const {
      value: _value,
      onChange: _onChange,
      className: _className,
      formItemProps: _formItemProps,
      ...rest
    } = props

    return { ...attrs, rest }
  })

  const handleChange = (value: RateValue): void => {
    if (props.disabled || props.readonly) return

    rateValue.value = value
    props.onChange?.(value)
  }
</script>
