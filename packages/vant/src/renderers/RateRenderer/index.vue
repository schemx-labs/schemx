<template>
  <Wrapper
    :class="['schemx-renderer', 'schemx-rate-renderer', className]"
    :readonly="props.readonly"
    :disabled="props.disabled"
  >
    <template #readonly>
      <Rate
        v-if="hasValue"
        v-bind="rateProps"
        :model-value="rateValue"
        :count="count"
        :allow-half="allowHalf"
        :disabled="props.disabled"
        :readonly="true"
      />
      <span v-else class="schemx-rate-renderer__readonly">
        {{ props.readonlyPlaceholder }}
      </span>
    </template>
    <Rate
      v-bind="rateProps"
      :model-value="rateValue"
      :count="count"
      :allow-half="allowHalf"
      :disabled="props.disabled"
      :readonly="props.readonly"
      @update:model-value="handleChange"
    />
  </Wrapper>
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

  import { Wrapper } from "@schemx/vue"

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

  /** 是否有评分值（0 视为未评分） */
  const hasValue = computed(() => {
    const v = rateValue.value ?? props.value

    return v !== undefined && v !== null && v !== 0
  })

  const rateProps = computed(() => {
    const rendererProps = props as typeof props & { formInstance?: unknown }

    const {
      value: _value,
      onChange: _onChange,
      className: _className,
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
      readonlyPlaceholder: _attrsReadonlyPlaceholder,
      placeholder: _attrsPlaceholder,
      align: _attrsAlign,
      formItemProps: _attrsFormItemProps,
      formInstance: _attrsFormInstance,
      ...attrsRest
    } = attrs

    return { ...attrsRest, ...rest }
  })

  const handleChange = (value: RateValue): void => {
    if (props.disabled || props.readonly) return

    rateValue.value = value
    props.onChange?.(value)
  }
</script>
