<script setup lang="ts">
  import { computed, useAttrs } from "vue"
  import type { CSSProperties } from "vue"

  // 包装层已经将 block 和缺省栅格配置归一化。
  interface Props {
    span?: number
    offset?: number
  }

  defineOptions({ name: "SchemxDefaultCol", inheritAttrs: false })

  // 内置列的栅格配置与调用方属性。
  const props = withDefaults(defineProps<Props>(), { span: 24, offset: 0 })

  const attrs = useAttrs()

  // 栅格宽度和偏移只应用于内置列。
  const colStyle = computed<CSSProperties>(() => {
    const width = `${(props.span / 24) * 100}%`

    return {
      flex: `0 0 ${width}`,
      maxWidth: width,
      marginLeft: `${(props.offset / 24) * 100}%`,
    }
  })
</script>

<template>
  <div v-bind="attrs" :style="[attrs.style, colStyle]">
    <slot />
  </div>
</template>

<style scoped>
  .schemx-col {
    box-sizing: border-box;
    min-width: 0;
    padding-top: var(--schemx-gutter-top, 0px);
    padding-right: var(--schemx-gutter-right, 0px);
    padding-bottom: var(--schemx-gutter-bottom, 0px);
    padding-left: var(--schemx-gutter-left, 0px);
  }
</style>
