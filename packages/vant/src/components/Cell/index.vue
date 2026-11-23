<script setup lang="ts">
  /**
   * 单元格展示组件
   *
   * 统一处理 disabled、readonly 状态下的 Cell 展示，不依赖第三方 UI 组件。
   *
   * @module components/Cell
   */
  import { computed, useSlots } from "vue"

  import { isEmptyDisplayValue } from "@/utils"

  type CellAlign = "left" | "right" | "center"
  type CellAffixValue = string | number

  interface Props {
    value?: string | number | boolean
    placeholder?: string
    readonlyPlaceholder?: string
    disabled?: boolean
    readonly?: boolean
    isLink?: boolean
    align?: CellAlign | "top"
    className?: string
    customClass?: string
    prefix?: CellAffixValue
    suffix?: CellAffixValue
  }

  defineOptions({
    name: "SchemxCell",
    inheritAttrs: false,
  })

  const props = withDefaults(defineProps<Props>(), {
    value: "",
    placeholder: "",
    readonlyPlaceholder: "-",
    disabled: false,
    readonly: false,
    isLink: true,
    align: "right",
    className: "",
    customClass: "",
    prefix: "",
    suffix: "",
  })

  const emit = defineEmits<{
    click: [event?: MouseEvent]
  }>()

  const slots = useSlots()

  const isDisabled = computed(() => props.disabled)
  const isReadonly = computed(() => props.readonly)

  const isEditable = computed(() => !props.readonly && !props.disabled)

  const rootClass = computed(() => {
    return [
      "schemx-cell",
      props.className,
      isEditable.value && "schemx-cell--clickable",
      isDisabled.value && "schemx-cell--disabled",
      isReadonly.value && "schemx-cell--readonly",
      !props.value && "schemx-cell--placeholder",
    ]
  })

  const customClass = computed(() =>
    ["schemx-cell__value", `schemx-cell__value--${valueAlign.value}`, props.customClass]
      .filter(Boolean)
      .join(" ")
  )

  const cellValue = computed(() => {
    if (isEmptyDisplayValue(props.value)) {
      return isReadonly.value ? props.readonlyPlaceholder : props.placeholder
    }

    return props.value.toString()
  })

  const valueAlign = computed<CellAlign>(() => {
    return props.align === "top" ? "right" : props.align
  })

  const hasPrefix = computed(
    () => Boolean(slots.prefix) || !isEmptyDisplayValue(props.prefix)
  )
  const hasSuffix = computed(
    () => Boolean(slots.suffix) || !isEmptyDisplayValue(props.suffix)
  )

  const handleClick = (event?: MouseEvent): void => {
    if (!isEditable.value) return

    emit("click", event)
  }

  const handleKeydown = (event: KeyboardEvent): void => {
    if (event.key !== "Enter" && event.key !== " ") return

    event.preventDefault()
    handleClick()
  }
</script>

<template>
  <div
    :class="rootClass"
    :role="isEditable ? 'button' : undefined"
    :tabindex="isEditable ? 0 : undefined"
    :aria-disabled="!isEditable ? 'true' : undefined"
    @click="handleClick"
    @keydown="handleKeydown"
  >
    <span v-if="hasPrefix" class="schemx-cell__prefix">
      <slot name="prefix">{{ props.prefix }}</slot>
    </span>

    <span :class="customClass">
      <slot>{{ cellValue }}</slot>
    </span>

    <span v-if="hasSuffix" class="schemx-cell__suffix">
      <slot name="suffix">{{ props.suffix }}</slot>
    </span>

    <span
      v-if="isEditable && props.isLink"
      class="schemx-cell__arrow"
      aria-hidden="true"
    />
  </div>
</template>

<style lang="scss">
  .schemx-cell {
    display: flex;
    align-items: center;
    gap: 6px;
    box-sizing: border-box;
    width: 100%;
    color: var(--schemx-cell-text-color, #323233);
    font-size: var(--schemx-cell-font-size, 14px);
    line-height: var(--schemx-cell-line-height, 24px);
    background: transparent;
    border: 0;
    outline: none;
    cursor: default;
  }

  .schemx-cell--clickable {
    cursor: pointer;
  }

  .schemx-cell--clickable:active {
    opacity: 0.72;
  }

  .schemx-cell--clickable:focus-visible {
    border-radius: 4px;
    outline: 2px solid var(--schemx-cell-focus-color, #1989fa);
    outline-offset: 2px;
  }

  .schemx-cell--disabled {
    color: var(--schemx-cell-disabled-color, #c8c9cc);
    cursor: not-allowed;
  }

  .schemx-cell--placeholder {
    color: var(--schemx-text-color-placeholder);
  }

  .schemx-cell__prefix,
  .schemx-cell__suffix {
    flex: none;
    color: inherit;
  }

  .schemx-cell__value {
    flex: 1 1 auto;
    min-width: 0;
    color: inherit;
    word-break: break-word;
  }

  .schemx-cell__value--left {
    text-align: left;
  }

  .schemx-cell__value--right {
    text-align: right;
  }

  .schemx-cell__value--center {
    text-align: center;
  }

  .schemx-cell__arrow {
    flex: none;
    width: 8px;
    height: 8px;
    border-top: 1px solid currentColor;
    border-right: 1px solid currentColor;
    color: var(--schemx-cell-arrow-color, #969799);
    transform: rotate(45deg);
  }
</style>
