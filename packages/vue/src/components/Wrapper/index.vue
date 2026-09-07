<script setup lang="ts">
  /**
   * Renderer 外层包装器。
   *
   * Wrapper 只负责 renderer 的外层属性、状态样式和 readonly 内容切换。
   * 具体控件布局与交互由 default 插槽中的子 renderer 负责。
   */
  import { computed, onMounted, ref, useAttrs, useSlots, watch } from "vue"

  interface Props {
    readonly?: boolean
    disabled?: boolean
  }

  defineOptions({
    name: "SchemxWrapper",
    inheritAttrs: false,
  })

  const props = withDefaults(defineProps<Props>(), {
    readonly: false,
    disabled: false,
  })

  const attrs = useAttrs()

  const slots = useSlots()

  const warnedReadonlySlot = ref(false)

  const rootClass = computed(() => [
    "schemx-wrapper",
    attrs.class,
    props.readonly && "schemx-wrapper--readonly",
    props.disabled && "schemx-wrapper--disabled",
  ])

  const forwardedAttrs = computed(() => {
    const { class: _class, ...rest } = attrs

    return rest
  })

  const warnIfReadonlySlotIsMissing = (readonly: boolean): void => {
    if (!readonly || slots.readonly || warnedReadonlySlot.value || !import.meta.env.DEV) {
      return
    }

    warnedReadonlySlot.value = true
    console.warn("[schemx] SchemxWrapper is readonly but no #readonly slot was provided.")
  }

  onMounted(() => warnIfReadonlySlotIsMissing(props.readonly))
  watch(() => props.readonly, warnIfReadonlySlotIsMissing)
</script>

<template>
  <div v-bind="forwardedAttrs" :class="rootClass">
    <template v-if="props.readonly">
      <slot name="readonly" :readonly="props.readonly" :disabled="props.disabled" />
    </template>
    <slot v-else :readonly="props.readonly" :disabled="props.disabled" />
  </div>
</template>

<style>
  .schemx-wrapper {
    box-sizing: border-box;
    width: 100%;
  }

  .schemx-wrapper--readonly {
    color: var(--schemx-wrapper-readonly-color, var(--schemx-readonly-color, #969799));
    cursor: default;
  }

  .schemx-wrapper--disabled {
    opacity: var(--schemx-disabled-opacity, 0.6);
    cursor: not-allowed;
  }

  .is-disabled .schemx-wrapper--disabled {
    opacity: 1;
  }
</style>
