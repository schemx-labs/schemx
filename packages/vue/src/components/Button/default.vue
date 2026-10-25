<script setup lang="ts">
  import { computed, useAttrs } from "vue"

  import type { SchemxDefaultButtonOptions } from "./index"

  defineOptions({ name: "SchemxDefaultButton", inheritAttrs: false })

  const props = withDefaults(defineProps<SchemxDefaultButtonOptions>(), {
    loading: false,
    loadingText: undefined,
    disabled: false,
    size: "medium",
    type: undefined,
    nativeType: "button",
  })

  // 透传给原生 button 的非组件 Props 属性。
  const attrs = useAttrs()

  // loading 或 disabled 任一为真时锁定按钮交互。
  const isDisabled = computed(() => props.disabled || props.loading)

  // 根据按钮尺寸生成内置样式类。
  const buttonClass = computed(() => [
    "schemx-button",
    `schemx-button--${props.size}`,
    props.type ? `schemx-button--${props.type}` : undefined,
  ])
</script>

<template>
  <button
    v-bind="attrs"
    :class="buttonClass"
    :type="props.nativeType"
    :aria-busy="props.loading || undefined"
    :data-loading="props.loading || undefined"
    :disabled="isDisabled"
  >
    <span v-if="$slots.prefix" class="schemx-button__prefix">
      <slot name="prefix" />
    </span>
    <svg
      v-if="props.loading"
      class="schemx-button__loading"
      xmlns="http://www.w3.org/2000/svg"
      width="1em"
      height="1em"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M12 2v4" />
      <path d="m16.2 7.8 2.9-2.9" />
      <path d="M18 12h4" />
      <path d="m16.2 16.2 2.9 2.9" />
      <path d="M12 18v4" />
      <path d="m4.9 19.1 2.9-2.9" />
      <path d="M2 12h4" />
      <path d="m4.9 4.9 2.9 2.9" />
    </svg>

    <template v-if="props.loading && props.loadingText">
      {{ props.loadingText }}
    </template>
    <slot v-else />
    <span v-if="$slots.suffix" class="schemx-button__suffix">
      <slot name="suffix" />
    </span>
  </button>
</template>

<style scoped>
  .schemx-button {
    box-sizing: border-box;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--schemx-padding-xs);
    min-width: 72px;
    height: 34px;
    padding: var(--schemx-padding-base) var(--schemx-padding-md);
    border: 1px solid var(--schemx-border-color);
    border-radius: var(--schemx-border-radius-sm);
    background: var(--schemx-background-color);
    color: var(--schemx-text-color);
    cursor: pointer;
    transition:
      border-color 0.15s ease,
      background-color 0.15s ease,
      color 0.15s ease,
      transform 0.1s ease;
  }

  .schemx-button:not(:disabled):hover {
    opacity: 0.8;
  }

  .schemx-button:not(:disabled):active {
    transform: scale(0.98);
  }

  .schemx-button--small {
    min-width: 56px;
    height: 24px;
    padding: var(--schemx-padding-base) var(--schemx-padding-sm);
    font-size: var(--schemx-font-size-sm);
  }

  .schemx-button--large {
    min-width: 88px;
    height: 40px;
    padding: var(--schemx-padding-sm) var(--schemx-padding-lg);
    font-size: var(--schemx-font-size-lg);
  }

  .schemx-button__loading {
    display: inline-block;
    border-radius: 50%;
    vertical-align: -0.15em;
    animation: schemx-button-loading 0.8s linear infinite;
  }

  .schemx-button--primary,
  .schemx-actions-button--submit:not(.schemx-button--default) {
    border-color: var(--schemx-primary-color);
    background: var(--schemx-primary-color);
    color: #ffffff;
  }

  .schemx-button--primary:not(:disabled):hover,
  .schemx-actions-button--submit:not(.schemx-button--default):not(:disabled):hover {
    filter: brightness(0.92);
    color: #ffffff;
  }

  .schemx-button:disabled {
    cursor: not-allowed;
    opacity: var(--schemx-disabled-opacity);
  }

  @keyframes schemx-button-loading {
    to {
      transform: rotate(360deg);
    }
  }
</style>
