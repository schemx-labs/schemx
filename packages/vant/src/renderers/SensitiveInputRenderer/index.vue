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
          :aria-label="hideAriaLabel"
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
          :aria-label="showAriaLabel"
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

  import { defaultMaskFormatter } from "./types"

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
    revealed: undefined,
    onRevealChange: undefined,
    revealable: true,
    revealText: "显示",
    hideText: "隐藏",
    revealIcon: "eye-o",
    hideIcon: "closed-eye",
    focusOnReveal: true,
    hideOnBlur: false,
    revealWhenReadonly: false,
    placeholder: "",
    readonlyPlaceholder: "-",
    disabled: false,
    readonly: false,
    align: "right",
    className: "",
  })

  const emit = defineEmits<{
    "update:value": [value: string]
    "update:revealed": [revealed: boolean]
    change: [value: string]
    "reveal-change": [revealed: boolean]
    blur: [event: FocusEvent]
  }>()

  const inputRef = ref<InstanceType<typeof SchemxInput> | null>(null)
  const innerRevealed = ref(props.defaultRevealed)

  const rawValue = computed(() => String(props.value ?? ""))
  const isRevealed = computed(() => props.revealed ?? innerRevealed.value)
  const canReveal = computed(() => {
    if (!props.revealable || props.disabled) return false
    if (props.readonly && !props.revealWhenReadonly) return false

    return !isEmptyDisplayValue(rawValue.value)
  })

  const formattedValue = computed(() => {
    if (isEmptyDisplayValue(rawValue.value)) return ""

    return props.formatter ? props.formatter(rawValue.value) : rawValue.value
  })

  const maskedValue = computed(() => {
    if (isEmptyDisplayValue(rawValue.value)) return ""

    return props.maskFormatter(rawValue.value, {
      placeholder: props.placeholder,
      readonlyPlaceholder: props.readonlyPlaceholder,
    })
  })

  const displayValue = computed(() =>
    isRevealed.value && props.readonly ? formattedValue.value : maskedValue.value
  )

  const showInput = computed(() => isRevealed.value && !props.readonly && !props.disabled)

  const inputProps = computed(() => {
    const {
      value: _value,
      onChange: _onChange,
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
      ...rest
    } = props

    return rest
  })

  const showAriaLabel = computed(() => props.revealText || "显示完整内容")
  const hideAriaLabel = computed(() => props.hideText || "隐藏完整内容")

  const setRevealed = (next: boolean) => {
    if (props.revealed === undefined) {
      innerRevealed.value = next
    }

    props.onRevealChange?.(next)
    emit("update:revealed", next)
    emit("reveal-change", next)
  }

  const toggleReveal = () => {
    if (!canReveal.value) return

    const next = !isRevealed.value
    setRevealed(next)

    if (next && props.focusOnReveal && !props.readonly) {
      nextTick(() => inputRef.value?.focus?.())
    }
  }

  const handleInputChange = (value: string) => {
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
