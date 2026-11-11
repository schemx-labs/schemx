<script setup lang="ts">
  import { normalizeClass, useAttrs } from "vue"
  import type { CSSProperties } from "vue"

  // 包装层已经将 block 和缺省栅格配置归一化。
  interface Props {
    /**
     * 普通列占用的栅格数；null 表示自动列撤销跨度。
     */
    span?: number | null
    /**
     * 普通列的左侧栅格偏移；null 表示自动列撤销偏移。
     */
    offset?: number | null
  }

  defineOptions({ name: "SchemxDefaultCol", inheritAttrs: false })

  // 内置列的栅格配置与调用方属性。
  const props = withDefaults(defineProps<Props>(), { span: 24, offset: 0 })

  const attrs = useAttrs()

  /**
   * 普通列生成栅格样式；自动列交由公共类名控制，不产生内联宽度。
   * attrs 不支持 computed 订阅，在每次渲染时读取以响应类名切换。
   */
  const getColStyle = (): CSSProperties => {
    if (normalizeClass(attrs.class).split(/\s+/).includes("schemx-col--auto")) {
      return {}
    }

    // 普通列继续按照 24 栅格计算百分比。
    const width = `${((props.span ?? 24) / 24) * 100}%`

    return {
      flex: `0 0 ${width}`,
      maxWidth: width,
      marginLeft: `${((props.offset ?? 0) / 24) * 100}%`,
    }
  }
</script>

<template>
  <div v-bind="attrs" :style="[attrs.style, getColStyle()]">
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
