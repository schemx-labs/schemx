<template>
  <div :class="['schemx-sensitive-input', props.className]">
    <SchemxInput
      v-if="showInput"
      ref="inputRef"
      v-bind="inputProps"
      :value="formattedValue"
      :on-change="handleInputChange"
      :on-blur="handleInputBlur"
    >
      <template #button>
        <button
          v-if="canReveal"
          type="button"
          class="schemx-sensitive-input__toggle"
          data-testid="sensitive-toggle"
          :aria-label="props.hideText"
          @click.stop="toggleReveal"
        >
          <Icon v-if="props.hideIcon" :name="props.hideIcon" />
          <span>{{ props.hideText }}</span>
        </button>
      </template>
    </SchemxInput>

    <SchemxCell
      v-else
      :value="displayValue"
      :placeholder="props.placeholder"
      :readonly-placeholder="props.readonlyPlaceholder"
      :readonly="props.readonly"
      :disabled="props.disabled"
      :is-link="false"
      :align="props.align"
    >
      <template #suffix>
        <button
          v-if="canReveal"
          type="button"
          class="schemx-sensitive-input__toggle"
          data-testid="sensitive-toggle"
          :aria-label="props.revealText"
          @click.stop="toggleReveal"
        >
          <Icon v-if="props.revealIcon" :name="props.revealIcon" />
          <span>{{ props.revealText }}</span>
        </button>
      </template>
    </SchemxCell>
  </div>
</template>

<script setup lang="ts">
  import { computed, nextTick, ref } from "vue"

  import { Icon } from "vant"

  import SchemxCell from "@/components/Cell/index.vue"
  import SchemxInput from "@/components/Input"
  import { isEmptyDisplayValue } from "@/utils"

  import { defaultMaskFormatter } from "./helper"

  import type { SensitiveInputRendererProps } from "./types"

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
    revealable: true,
    revealText: "",
    hideText: "",
    revealIcon: "eye-o",
    hideIcon: "closed-eye",
    focusOnReveal: true,
    hideOnBlur: false,
    revealWhenReadonly: true,
    placeholder: "",
    readonlyPlaceholder: "-",
    disabled: false,
    readonly: false,
    align: "right",
    className: "",
  })

  const emit = defineEmits<{
    "update:value": [value: string]
    change: [value: string]
    "reveal-change": [revealed: boolean]
    blur: [event: FocusEvent]
  }>()

  const inputRef = ref<InstanceType<typeof SchemxInput> | null>(null)

  const revealed = ref(props.defaultRevealed)

  const rawValue = computed(() => String(props.value ?? ""))

  const isEmpty = computed(() => isEmptyDisplayValue(rawValue.value))

  const canReveal = computed(() => {
    if (isEmpty.value || !props.revealable || props.disabled) return false
    if (props.readonly && !props.revealWhenReadonly) return false

    return true
  })

  const formattedValue = computed(
    () => props.formatter?.(rawValue.value.trim().replace(/\s/g, "")) ?? rawValue.value
  )

  const maskedValue = computed(() =>
    props.maskFormatter(rawValue.value.trim().replace(/\s/g, ""), {
      placeholder: props.placeholder,
      readonlyPlaceholder: props.readonlyPlaceholder,
    })
  )

  const displayValue = computed(() => {
    if (props.readonly && revealed.value) {
      return formattedValue.value
    }

    return maskedValue.value
  })

  const showInput = computed(() => {
    if (props.readonly || props.disabled) return false

    return !props.revealable || isEmpty.value || revealed.value
  })

  const inputProps = computed(() => {
    const rendererProps = props as typeof props & { formInstance?: unknown }

    const {
      value: _value,
      onChange: _onChange,
      onBlur: _onBlur,
      className: _className,
      revealed: _revealed,
      onRevealChange: _onRevealChange,
      defaultRevealed: _defaultRevealed,
      revealable: _revealable,
      revealText: _revealText,
      hideText: _hideText,
      revealIcon: _revealIcon,
      hideIcon: _hideIcon,
      focusOnReveal: _focusOnReveal,
      hideOnBlur: _hideOnBlur,
      revealWhenReadonly: _revealWhenReadonly,
      maskFormatter: _maskFormatter,
      formItemProps: _formItemProps,
      formInstance: _formInstance,
      ...rest
    } = rendererProps

    return rest
  })

  const setRevealed = (next: boolean) => {
    if (revealed.value === next) return

    revealed.value = next
    emit("reveal-change", next)
  }

  const toggleReveal = () => {
    if (!canReveal.value) return

    const next = !revealed.value

    setRevealed(next)

    if (next && props.focusOnReveal && !props.readonly) {
      nextTick(() => inputRef.value?.focus?.())
    }
  }

  const handleInputChange = (value: string) => {
    // 空值状态会直接显示输入框。首次输入后需要保持展开，
    // 避免 value 从空变为非空时立即切回脱敏展示态。
    if (props.revealable && !isEmptyDisplayValue(value)) {
      setRevealed(true)
    }

    props.onChange?.(value)
    emit("update:value", value)
    emit("change", value)
  }

  const handleInputBlur = (event: FocusEvent) => {
    props.onBlur?.(event)
    emit("blur", event)

    if (props.hideOnBlur) {
      setRevealed(false)
    }
  }

  defineExpose({
    focus: () => inputRef.value?.focus?.(),
    blur: () => inputRef.value?.blur?.(),
  })
</script>

<style lang="scss">
  .schemx-sensitive-input {
    width: 100%;
  }

  .schemx-sensitive-input__toggle {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    border: 0;
    padding: 0;
    color: var(--schemx-sensitive-input-action-color, #1989fa);
    font: inherit;
    line-height: inherit;
    background: transparent;
    cursor: pointer;
  }

  .schemx-sensitive-input__toggle:focus-visible {
    border-radius: 4px;
    outline: 2px solid var(--schemx-sensitive-input-focus-color, #1989fa);
    outline-offset: 2px;
  }
</style>
