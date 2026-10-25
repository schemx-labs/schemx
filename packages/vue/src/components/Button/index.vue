<script setup lang="ts">
  import { computed, markRaw, toRaw, useAttrs } from "vue"

  import { useOptionalFormContextValue } from "../../context"

  import { DefaultButton } from "./index"

  import type { SchemxButtonOptions } from "./index"

  defineOptions({ name: "SchemxButton", inheritAttrs: false })

  // 公共状态不包含任何内置按钮样式。
  const props = withDefaults(defineProps<SchemxButtonOptions>(), {
    loading: false,
    loadingText: undefined,
    disabled: false,
  })

  const attrs = useAttrs()

  // 外部实现优先，未配置时回退到独立的内部组件。
  const formContext = useOptionalFormContextValue()

  const resolvedComponent = computed(() => {
    const component = formContext?.buttonComponent

    return component ? markRaw(toRaw(component)) : DefaultButton
  })

  // 加载期间仍由包装层保护交互。
  const isDisabled = computed(() => props.disabled || props.loading)
</script>

<template>
  <component
    :is="resolvedComponent"
    v-bind="attrs"
    :loading="props.loading"
    :loading-text="props.loadingText"
    :disabled="isDisabled"
    :aria-busy="props.loading || undefined"
    :data-loading="props.loading || undefined"
  >
    <template v-for="(_, name) in $slots" #[name]="slotProps">
      <slot :name="name" v-bind="slotProps ?? {}" />
    </template>
  </component>
</template>
