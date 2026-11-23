<template>
  <div :class="classNames('schemx-input', props.className)" @click="handleClickRoot">
    <Field
      ref="fieldRef"
      v-model="internalValue"
      :type="fieldType"
      :placeholder="computedPlaceholder"
      :disabled="props.disabled"
      :readonly="props.readonly"
      :autofocus="props.autofocus"
      :maxlength="props.maxlength"
      :rows="props.rows !== undefined ? +props.rows : undefined"
      :autosize="computedAutosize"
      :formatter="fieldFormatter"
      :format-trigger="props.formatTrigger"
      :clearable="props.clearable"
      :clear-icon="props.clearIcon"
      :clear-trigger="props.clearTrigger"
      :left-icon="props.leftIcon || ($slots['left-icon'] ? undefined : undefined)"
      :right-icon="props.rightIcon || ($slots['right-icon'] ? undefined : undefined)"
      :show-word-limit="props.showWordLimit"
      :autocomplete="props.autocomplete"
      :autocapitalize="props.autocapitalize"
      :autocorrect="props.autocorrect"
      :enterkeyhint="props.enterkeyhint"
      :spellcheck="props.spellcheck ?? undefined"
      :inputmode="computedInputmode"
      :input-align="props.align"
      @update:model-value="handleUpdateModelValue"
      @focus="handleFocus"
      @blur="handleBlur"
      @clear="handleClear"
      @keypress="handleKeypress"
      @click-input="handleClickInput"
      @click-left-icon="handleClickLeftIcon"
      @click-right-icon="handleClickRightIcon"
    >
      <template v-if="$slots['left-icon']" #left-icon>
        <slot name="left-icon" />
      </template>
      <template v-if="$slots['right-icon']" #right-icon>
        <slot name="right-icon" />
      </template>
      <template v-if="$slots.button" #button>
        <slot name="button" />
      </template>
      <template v-if="$slots.extra" #extra>
        <slot name="extra" />
      </template>
    </Field>
  </div>
</template>

<script setup lang="ts">
  /**
   * 输入组件 - 基于 Vant Field 实现
   *
   * @module components/Input
   */
  import { computed, ref, watch } from "vue"

  import { Field } from "vant"

  import classNames from "classnames"

  import { formatNumber } from "./types"

  import type { SchemxInputProps, TextAreaAutosize } from "./types"

  import "./index.scss"

  defineOptions({
    name: "SchemxInput",
    inheritAttrs: false,
  })

  const props = withDefaults(defineProps<SchemxInputProps>(), {
    value: "",
    onChange: undefined,
    onBlur: undefined,
    onFocus: undefined,
    type: "text",
    placeholder: "",
    disabled: false,
    readonly: false,
    autofocus: false,
    maxlength: undefined,
    min: undefined,
    max: undefined,
    rows: undefined,
    autosize: false,
    formatter: undefined,
    formatTrigger: "onChange",
    clearable: false,
    clearIcon: "clear",
    clearTrigger: "focus",
    leftIcon: "",
    rightIcon: "",
    showWordLimit: false,
    autocomplete: undefined,
    autocapitalize: undefined,
    autocorrect: undefined,
    enterkeyhint: undefined,
    spellcheck: null,
    inputmode: undefined,
    align: "left",
    className: "",
    readonlyPlaceholder: "-",
  })

  const emit = defineEmits<{
    "update:value": [value: string]
    change: [value: string]
    blur: [event: FocusEvent]
    focus: [event: FocusEvent]
    clear: [event: TouchEvent | MouseEvent]
    keypress: [event: KeyboardEvent]
    "click-input": [event: MouseEvent]
    "click-left-icon": [event: MouseEvent | KeyboardEvent]
    "click-right-icon": [event: MouseEvent | KeyboardEvent]
  }>()

  const fieldRef = ref<InstanceType<typeof Field> | null>(null)

  /** 内部值 - 用于 v-model 绑定 */
  const internalValue = ref(String(props.value ?? ""))

  /** 计算 placeholder */
  const computedPlaceholder = computed(() => {
    if (props.readonly) {
      return props.readonlyPlaceholder
    }

    return props.placeholder || ""
  })

  /** 计算 Field 组件的 type */
  const fieldType = computed(() => {
    const { type } = props

    if (type === "textarea") {
      return "textarea"
    }

    if (type === "password") {
      return "password"
    }

    if (type === "number") {
      return "number"
    }

    if (type === "digit") {
      return "digit"
    }

    return "text"
  })

  /** 计算 inputmode */
  const computedInputmode = computed(() => {
    if (props.inputmode) return props.inputmode
    const { type } = props
    if (type === "number") return "decimal"
    if (type === "digit") return "numeric"

    return undefined
  })

  /** 计算 autosize 配置 */
  const computedAutosize = computed(() => {
    if (props.type !== "textarea") return false
    if (!props.autosize || typeof props.autosize === "boolean") {
      return props.autosize
    }

    // Convert minRows/maxRows to minHeight/maxHeight (estimated 22px per row)
    const { minRows, maxRows, minHeight, maxHeight } = props.autosize as TextAreaAutosize
    const result: { minHeight?: number; maxHeight?: number } = {}

    if (minHeight !== undefined) {
      result.minHeight = minHeight
    } else if (minRows !== undefined) {
      result.minHeight = minRows * 22
    }

    if (maxHeight !== undefined) {
      result.maxHeight = maxHeight
    } else if (maxRows !== undefined) {
      result.maxHeight = maxRows * 22
    }

    return Object.keys(result).length > 0 ? result : props.autosize
  })

  /** Field 组件的 formatter */
  const fieldFormatter = computed(() => {
    // 对于 number/digit 类型，使用内置的格式化
    if (props.type === "number" || props.type === "digit") {
      const isNumber = props.type === "number"
      return (value: string) => formatNumber(value, isNumber, isNumber)
    }

    // 否则使用用户提供的 formatter
    return props.formatter
  })

  /** 处理值更新 */
  const handleUpdateModelValue = (value: string): void => {
    let processedValue = value

    // 数字类型在 blur 时处理 min/max，这里不处理
    // 由 handleBlur 统一处理

    props.onChange?.(processedValue)
    emit("update:value", processedValue)
    emit("change", processedValue)
  }

  /** 聚焦事件 */
  const handleFocus = (event: FocusEvent): void => {
    props.onFocus?.(event)
    emit("focus", event)
  }

  /** 失焦事件 */
  const handleBlur = (event: FocusEvent): void => {
    // 数字类型在 blur 时处理 min/max
    if ((props.type === "number" || props.type === "digit") && internalValue.value !== "") {
      const { min, max } = props
      const numValue = parseFloat(internalValue.value)

      if (!isNaN(numValue)) {
        const clampedValue = Math.min(
          Math.max(numValue, min ?? -Infinity),
          max ?? Infinity
        )

        if (numValue !== clampedValue) {
          const stringValue = String(clampedValue)
          internalValue.value = stringValue
          props.onChange?.(stringValue)
          emit("update:value", stringValue)
          emit("change", stringValue)
        }
      }
    }

    props.onBlur?.(event)
    emit("blur", event)
  }

  /** 键盘事件 */
  const handleKeypress = (event: KeyboardEvent): void => {
    emit("keypress", event)
  }

  /** 点击输入框 */
  const handleClickInput = (event: MouseEvent): void => {
    emit("click-input", event)
  }

  /** 点击左侧图标 */
  const handleClickLeftIcon = (event: MouseEvent | KeyboardEvent): void => {
    emit("click-left-icon", event)
  }

  /** 点击右侧图标 */
  const handleClickRightIcon = (event: MouseEvent | KeyboardEvent): void => {
    emit("click-right-icon", event)
  }

  /** 清除按钮点击 */
  const handleClear = (event: TouchEvent | MouseEvent): void => {
    props.onChange?.("")
    emit("update:value", "")
    emit("clear", event)
  }

  /** 点击非交互展示区域时聚焦输入框 */
  const handleClickRoot = (event: MouseEvent): void => {
    if (props.disabled) return

    const target = event.target as Element

    if (!(target instanceof Element)) return

    const interactiveSelector = [
      "input",
      "textarea",
      "button",
      "a",
      "select",
      "option",
      "label",
      "[role='button']",
      "[tabindex]",
      "[contenteditable='true']",
      ".van-field__clear",
      ".van-field__button",
      ".van-field__left-icon",
      ".van-field__right-icon",
    ].join(",")

    if (target.closest(interactiveSelector)) return

    focus()
  }

  /** 聚焦方法 */
  const focus = (): void => {
    const input = fieldRef.value?.$el?.querySelector?.("input, textarea") as
      | HTMLInputElement
      | HTMLTextAreaElement
      | null
    input?.focus?.()
  }

  /** 失焦方法 */
  const blur = (): void => {
    const input = fieldRef.value?.$el?.querySelector?.("input, textarea") as
      | HTMLInputElement
      | HTMLTextAreaElement
      | null
    input?.blur?.()
  }

  defineExpose({
    focus,
    blur,
    get inputRef() {
      // Field 组件通过 ref 可以获取到 input 元素
      return fieldRef.value?.$el?.querySelector?.("input, textarea") || null
    },
  })

  // 监听外部值变化，同步内部值
  watch(
    () => props.value,
    (newVal) => {
      const stringVal = String(newVal ?? "")
      if (stringVal !== internalValue.value) {
        internalValue.value = stringVal
      }
    }
  )
</script>
