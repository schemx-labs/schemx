<template>
  <Wrapper
    :class="['schemx-renderer', 'schemx-number-renderer', props.className]"
    :readonly="props.readonly"
    :disabled="props.disabled"
  >
    <template #readonly>
      {{ getReadonlyDisplayValue(numberValue ?? props.value, props.readonlyPlaceholder) }}
    </template>
    <SchemxInput
      ref="inputRef"
      v-model:value="numberValue"
      v-bind="numberProps"
      @change="handleChange"
      @blur="props.onBlur"
      @focus="props.onFocus"
    >
      <template v-if="slots['left-icon']" #left-icon>
        <slot name="left-icon" />
      </template>
      <template v-if="slots['right-icon']" #right-icon>
        <slot name="right-icon" />
      </template>
      <template v-if="slots.button" #button>
        <slot name="button" />
      </template>
      <template v-if="slots.extra" #extra>
        <slot name="extra" />
      </template>
    </SchemxInput>
  </Wrapper>
</template>

<script setup lang="ts">
  /**
   * 数字输入渲染器组件
   *
   * 支持 number、digit 类型，基于 InputRenderer 实现。
   *
   * @module renderers/NumberRenderer
   */
  import { computed, ref, useSlots } from "vue"

  import { Wrapper } from "@schemx/vue"

  import SchemxInput from "@/components/Input"
  import { getReadonlyDisplayValue } from "@/utils"

  import type { NumberRendererProps, NumberValue } from "./types"

  import "./index.scss"

  defineOptions({
    name: "NumberRendererComponent",
    inheritAttrs: false,
  })

  const props = withDefaults(defineProps<NumberRendererProps>(), {
    className: "",
    type: "number",
    placeholder: undefined,
    readonlyPlaceholder: "-",
    readonly: false,
    disabled: false,
    value: "",
    align: "right",
    clearable: false,
    min: undefined,
    max: undefined,
  })

  const slots = useSlots()

  const numberValue = defineModel<NumberValue>("value")

  const inputRef = ref<InstanceType<typeof SchemxInput> | null>(null)

  const numberProps = computed(() => {
    const rendererProps = props as typeof props & { formInstance?: unknown }

    const {
      value: _value,
      onChange: _onChange,
      onBlur: _onBlur,
      onFocus: _onFocus,
      className: _className,
      formItemProps: _formItemProps,
      formInstance: _formInstance,
      ...rest
    } = rendererProps

    return rest
  })

  /**
   * 处理值变化
   *
   * 保持字符串形式，让 InputRenderer 处理格式化。
   */
  const handleChange = (value: string): void => {
    if (value === "" || value === null || value === undefined) {
      numberValue.value = ""
      props.onChange?.("")

      return
    }

    numberValue.value = value
    props.onChange?.(value)
  }

  defineExpose({
    focus: () => (inputRef.value as any)?.focus?.(),
    blur: () => (inputRef.value as any)?.blur?.(),
  })
</script>
