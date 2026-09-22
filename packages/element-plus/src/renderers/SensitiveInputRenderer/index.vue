<template>
  <Wrapper
    :class="['schemx-renderer', 'schemx-sensitive-input', props.className]"
    :readonly="props.readonly"
    :disabled="props.disabled"
  >
    <template #readonly>
      {{ displayValue }}
      <button
        v-if="canReveal"
        type="button"
        class="schemx-sensitive-input__toggle"
        data-testid="sensitive-toggle"
        :aria-label="props.revealText"
        @click.stop="toggleReveal"
      >
        <ElIcon v-if="props.revealIcon">
          <component :is="props.revealIcon" />
        </ElIcon>
        <span>{{ props.revealText }}</span>
      </button>
    </template>

    <template v-if="!showInput">
      {{ displayValue }}
      <button
        v-if="canReveal"
        type="button"
        class="schemx-sensitive-input__toggle"
        data-testid="sensitive-toggle"
        :aria-label="props.revealText"
        @click.stop="toggleReveal"
      >
        <ElIcon v-if="props.revealIcon">
          <component :is="props.revealIcon" />
        </ElIcon>
        <span>{{ props.revealText }}</span>
      </button>
    </template>

    <ElInput
      v-if="showInput"
      ref="inputRef"
      v-bind="inputProps"
      :model-value="formattedValue"
      @update:model-value="handleInputChange"
      @blur="handleInputBlur"
      @focus="handleInputFocus"
    >
      <template #suffix>
        <button
          v-if="canReveal"
          type="button"
          class="schemx-sensitive-input__toggle"
          data-testid="sensitive-toggle"
          :aria-label="props.hideText"
          @click.stop="toggleReveal"
        >
          <ElIcon v-if="props.hideIcon">
            <component :is="props.hideIcon" />
          </ElIcon>
          <span>{{ props.hideText }}</span>
        </button>
      </template>
    </ElInput>
  </Wrapper>
</template>

<script setup lang="ts">
  /** 使用 Element Plus ElInput 实现与 Vant 一致的脱敏输入状态流。 */
  import { computed, nextTick, ref, useAttrs, watch } from "vue"

  import { Hide, View } from "@element-plus/icons-vue"
  import { Wrapper } from "@schemx/vue"
  import { ElIcon, ElInput } from "element-plus"

  import { getElementProps } from "@/renderers/shared/props"
  import { isEmptyDisplayValue } from "@/utils"

  import { defaultMaskFormatter } from "./helper"

  import type { SensitiveInputRendererProps, SensitiveInputValue } from "./types"
  import type { InputInstance } from "element-plus"

  defineOptions({
    name: "SensitiveInput",
    inheritAttrs: false,
  })

  const props = withDefaults(defineProps<SensitiveInputRendererProps>(), {
    value: "",
    onChange: undefined,
    onBlur: undefined,
    onFocus: undefined,
    formatter: undefined,
    maskFormatter: defaultMaskFormatter,
    defaultRevealed: false,
    revealed: undefined,
    revealable: true,
    revealText: "",
    hideText: "",
    revealIcon: View,
    hideIcon: Hide,
    focusOnReveal: true,
    hideOnBlur: false,
    revealWhenReadonly: true,
    placeholder: "",
    readonlyPlaceholder: "-",
    disabled: false,
    readonly: false,
    className: "",
  })

  const emit = defineEmits<{
    "reveal-change": [revealed: boolean]
    change: [value: SensitiveInputValue]
    blur: [event: FocusEvent]
  }>()

  const attrs = useAttrs() as Record<string, unknown>

  const inputRef = ref<InputInstance>()

  const valueModel = defineModel<SensitiveInputValue>("value")

  const revealedState = ref(props.revealed ?? props.defaultRevealed)

  const rawValue = computed(() => String(valueModel.value ?? props.value ?? ""))

  const isEmpty = computed(() => isEmptyDisplayValue(rawValue.value))

  const isRevealed = computed(() => props.revealed ?? revealedState.value)

  const canReveal = computed(() => {
    if (isEmpty.value || !props.revealable || props.disabled) return false
    if (props.readonly && !props.revealWhenReadonly) return false

    return true
  })

  const formattedValue = computed(
    () => props.formatter?.(normalizeValue(rawValue.value)) ?? rawValue.value
  )

  const maskedValue = computed(() =>
    props.maskFormatter(normalizeValue(rawValue.value), {
      placeholder: props.placeholder ?? "",
      readonlyPlaceholder: props.readonlyPlaceholder ?? "-",
    })
  )

  const displayValue = computed(() => {
    if (props.readonly && isRevealed.value) return formattedValue.value

    return maskedValue.value
  })

  const showInput = computed(() => {
    if (props.readonly || props.disabled) return false

    return !props.revealable || isEmpty.value || isRevealed.value
  })

  const inputProps = computed(() => ({
    ...getElementProps(props, attrs, [
      "type",
      "formatter",
      "onChange",
      "onBlur",
      "onFocus",
      "value",
      "revealed",
      "onRevealChange",
      "defaultRevealed",
      "revealable",
      "revealText",
      "hideText",
      "revealIcon",
      "hideIcon",
      "focusOnReveal",
      "hideOnBlur",
      "revealWhenReadonly",
      "maskFormatter",
    ]),
    type: "text" as const,
  }))

  watch(
    () => props.revealed,
    (value) => {
      if (value !== undefined) revealedState.value = value
    }
  )

  /**
   * 规范化真实值，保持与 Vant 适配包一致的格式化输入。
   *
   * @param value - 原始真实值。
   * @returns 去除首尾空格和内部空格的值。
   */
  function normalizeValue(value: string): string {
    return value.trim().replace(/\s/g, "")
  }

  /**
   * 设置显示状态并发送状态变化事件。
   *
   * @param next - 目标显示状态。
   */
  const setRevealed = (next: boolean): void => {
    if (isRevealed.value === next) return

    if (props.revealed === undefined) revealedState.value = next

    props.onRevealChange?.(next)
    emit("reveal-change", next)
  }

  /** 切换脱敏状态并在展开输入框后按配置聚焦。 */
  const toggleReveal = (): void => {
    if (!canReveal.value) return

    const next = !isRevealed.value

    setRevealed(next)

    if (next && props.focusOnReveal && !props.readonly) {
      void nextTick(() => inputRef.value?.focus?.())
    }
  }

  /**
   * 处理输入框值变化。
   *
   * @param value - 输入框产生的新真实值。
   */
  const handleInputChange = (value: string): void => {
    if (props.revealable && !isEmptyDisplayValue(value)) setRevealed(true)

    valueModel.value = value
    props.onChange?.(value)
    emit("change", value)
  }

  /**
   * 处理输入框失焦。
   *
   * @param event - 原生失焦事件。
   */
  const handleInputBlur = (event: FocusEvent): void => {
    props.onBlur?.(event)
    emit("blur", event)

    if (props.hideOnBlur) setRevealed(false)
  }

  /** 转发输入框聚焦事件。 */
  const handleInputFocus = (event: FocusEvent): void => {
    props.onFocus?.(event)
  }

  defineExpose({
    /** 聚焦内部输入框。 */
    focus: () => inputRef.value?.focus?.(),
    /** 使内部输入框失焦。 */
    blur: () => inputRef.value?.blur?.(),
  })
</script>

<style lang="scss">
  .schemx-renderer {
    box-sizing: border-box;
    width: 100%;
  }

  .schemx-sensitive-input {
    display: flex;
    align-items: center;
    justify-content: var(--schemx-content-align);
    gap: 6px;
    width: 100%;
  }

  .schemx-sensitive-input__toggle {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    border: 0;
    padding: 0;
    color: var(--schemx-sensitive-input-action-color, var(--el-color-primary));
    font: inherit;
    line-height: inherit;
    background: transparent;
    cursor: pointer;
  }

  .schemx-sensitive-input__toggle:focus-visible {
    border-radius: 4px;
    outline: 2px solid var(--el-color-primary);
    outline-offset: 2px;
  }
</style>
