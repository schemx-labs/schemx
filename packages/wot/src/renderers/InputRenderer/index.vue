<template>
  <div :class="classNames('schemx-input', props.className)">
    <WdInput
      ref="inputRef"
      v-bind="inputProps"
      :model-value="displayValue"
      custom-class="schemx-input__wot-control schemx-input__wot-input"
      :custom-input-class="
        classNames('schemx-input__control', `schemx-input__control--${props.align}`)
      "
      :placeholder="props.placeholder"
      :focus="props.autofocus"
      :align-right="props.align === 'right'"
      :compact="true"
      @update:model-value="handleChange"
      @focus="handleFocus"
      @blur="handleBlur"
      @clear="emit('clear')"
      @clickprefixicon="emit('click-left-icon', $event)"
      @clicksuffixicon="emit('click-right-icon', $event)"
    >
      <template v-if="$slots['left-icon']" #prefix>
        <slot name="left-icon" />
      </template>

      <template v-if="$slots['right-icon'] || $slots.button" #suffix>
        <slot name="right-icon" />
        <span v-if="$slots.button" class="schemx-input__button">
          <slot name="button" />
        </span>
      </template>
    </WdInput>

    <slot v-if="$slots.extra" name="extra" />
  </div>
</template>

<script setup lang="ts">
  /**
   * 纯净的输入组件。
   *
   * 使用 Wot UI 的 WdInput 作为实际输入控件，仅桥接 Schemx 的 value/onChange 契约。
   *
   * @module renderers/InputRenderer
   */
  import { computed, ref, useAttrs, watch } from "vue"
  import type { ComponentPublicInstance } from "vue"

  import WdInput from "@wot-ui/ui/components/wd-input/wd-input.vue"
  import classNames from "classnames"

  import type { InputRendererProps } from "./types"

  import "./index.scss"

  defineOptions({
    name: "InputRendererComponent",
    inheritAttrs: false,
  })

  const props = withDefaults(defineProps<InputRendererProps>(), {
    value: "",
    onChange: undefined,
    onBlur: undefined,
    onFocus: undefined,
    placeholder: "",
    readonly: false,
    autofocus: false,
    align: "right",
    className: "",
  })

  const emit = defineEmits<{
    "update:value": [value: string]
    change: [value: string]
    blur: [event: FocusEvent]
    focus: [event: FocusEvent]
    clear: []
    "click-left-icon": [event: MouseEvent]
    "click-right-icon": [event: MouseEvent]
  }>()

  const inputRef = ref<ComponentPublicInstance | null>(null)
  const innerValue = ref(String(props.value ?? ""))
  const attrs = useAttrs()

  const inputValue = computed({
    get: () => innerValue.value,
    set: (value) => {
      const nextValue = String(value ?? "")
      innerValue.value = nextValue

      if (nextValue !== String(props.value ?? "")) {
        props.onChange?.(nextValue)
        emit("update:value", nextValue)
        emit("change", nextValue)
      }
    },
  })

  const displayValue = computed(() => inputValue.value ?? String(props.value ?? ""))

  // 剔除 Schemx 契约字段，避免内部事件和表单元信息透传给 Wot 组件。
  const inputProps = computed(() => {
    const {
      value,
      onChange,
      onBlur,
      onFocus,
      className,
      autofocus,
      align,
      formItemProps,
      ...restProps
    } = props

    const showPassword = props.type === "safe-password"

    return { ...attrs, ...restProps, showPassword }
  })

  const handleChange = (value: string): void => {
    inputValue.value = value
  }

  const handleFocus = (event: FocusEvent): void => {
    props.onFocus?.(event)
    emit("focus", event)
  }

  const handleBlur = (event: FocusEvent): void => {
    props.onBlur?.(event)
    emit("blur", event)
  }

  const getNativeInput = (): HTMLInputElement | null => {
    const root = inputRef.value?.$el as Element | undefined

    return root?.querySelector("input") ?? null
  }

  defineExpose({
    focus: () => getNativeInput()?.focus?.(),
    blur: () => getNativeInput()?.blur?.(),
    get inputRef() {
      return getNativeInput()
    },
  })

  watch(
    () => props.value,
    (newVal) => {
      const nextValue = String(newVal ?? "")

      if (nextValue !== innerValue.value) {
        innerValue.value = nextValue
      }
    }
  )
</script>
