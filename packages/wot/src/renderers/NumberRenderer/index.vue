<template>
  <div
    :class="
      classNames('schemx-renderer', 'schemx-number-renderer', props.className, {
        'schemx-renderer-readonly': readonly,
        'schemx-renderer-disabled': disabled,
      })
    "
  >
    <WdInput
      ref="inputRef"
      v-bind="inputProps"
      :model-value="displayValue"
      custom-class="schemx-number-renderer__wot-control"
      custom-input-class="schemx-number-renderer__control"
      :type="inputType"
      :placeholder="props.placeholder"
      :readonly="readonly"
      :disabled="disabled"
      :compact="true"
      @update:model-value="handleChange"
      @blur="props.onBlur"
      @focus="props.onFocus"
    />
    <slot v-if="$slots.extra" name="extra" />
  </div>
</template>

<script setup lang="ts">
  /**
   * 数字输入渲染器组件
   *
   * 支持 number、digit 类型，基于 Wot UI Input 实现。
   *
   * @module renderers/NumberRenderer
   */
  import { computed, ref, useAttrs } from "vue"
  import type { ComponentPublicInstance } from "vue"

  import WdInput from "@wot-ui/ui/components/wd-input/wd-input.vue"
  import classNames from "classnames"

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
    readonly: false,
    disabled: false,
    value: "",
  })

  const numberValue = defineModel<NumberValue>("value")

  const inputRef = ref<ComponentPublicInstance | null>(null)
  const attrs = useAttrs()

  const readonly = computed(() => props.readonly)
  const disabled = computed(() => props.disabled)
  const displayValue = computed<NumberValue>(() => numberValue.value ?? props.value ?? "")

  const inputType = computed(() => {
    if (["number", "digit"].includes(props.type)) {
      return props.type
    }

    console.warn(
      `[numberRenderer]: Type expects to get 'number', 'digit' but gets ${props.type}.`
    )

    return "number"
  })

  // 剔除 Schemx 契约字段，避免内部事件和表单元信息透传给 Wot 组件。
  const inputProps = computed(() => {
    const {
      value,
      onChange,
      onBlur,
      onFocus,
      className,
      readonly,
      disabled,
      type,
      formItemProps,
      ...restProps
    } = props

    return { ...attrs, ...restProps }
  })

  /**
   * 处理值变化
   *
   * 保持 Wot UI Input 的值形态，并同步给 Schemx。
   */
  const handleChange = (value: NumberValue): void => {
    if (value === "" || value === null || value === undefined) {
      numberValue.value = ""
      props.onChange?.("")

      return
    }

    numberValue.value = value
    props.onChange?.(value)
  }

  const getNativeInput = (): HTMLInputElement | null => {
    const root = inputRef.value?.$el as Element | undefined

    return root?.querySelector("input") ?? null
  }

  defineExpose({
    focus: () => getNativeInput()?.focus?.(),
    blur: () => getNativeInput()?.blur?.(),
  })
</script>
