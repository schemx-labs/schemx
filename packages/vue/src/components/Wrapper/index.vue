<script setup lang="ts">
  /**
   * Renderer 外层包装器。
   *
   * Wrapper 只负责 renderer 的外层属性、状态样式和 readonly 内容切换。
   * 具体控件布局与交互由 default 插槽中的子 renderer 负责。
   */
  import { computed, onMounted, ref, useAttrs, useSlots, watch } from "vue"

  interface Props {
    /**
     * 是否以只读插槽替换默认 Renderer 内容。
     */
    readonly?: boolean
    /**
     * 是否应用禁用状态样式。
     */
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

  // 当前 Wrapper 的非组件属性。
  const attrs = useAttrs()

  // 用于判断是否提供只读插槽。
  const slots = useSlots()

  // 防止同一 Wrapper 在开发环境重复输出提示。
  const warnedReadonlySlot = ref(false)

  // 根据状态合并 Wrapper 根节点 class。
  const rootClass = computed(() => [
    "schemx-wrapper",
    attrs.class,
    props.readonly && "schemx-wrapper--readonly",
    props.disabled && "schemx-wrapper--disabled",
  ])

  // 转发给根节点但排除已单独处理的 class。
  const forwardedAttrs = computed(() => {
    const { class: _class, ...rest } = attrs

    return rest
  })

  /**
   * 在开发环境提示只读状态缺少 `#readonly` 插槽。
   *
   * @param readonly - 当前 Wrapper 是否处于只读状态。
   */
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
