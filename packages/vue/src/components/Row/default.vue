<script setup lang="ts">
  import { computed, useAttrs } from "vue"
  import type { CSSProperties } from "vue"

  import { normalizeSchemxGutter } from "../../utils/layout"

  import type { SchemxGutter, SchemxRowConfig } from "../../types/layout"

  // 内置行仅实现公共布局语义，不约束外部 Row 组件的样式。
  interface Props {
    gutter?: SchemxGutter
    justify?: SchemxRowConfig["justify"]
    align?: SchemxRowConfig["align"]
  }

  defineOptions({ name: "SchemxDefaultRow", inheritAttrs: false })

  // 包装层解析后的行配置与调用方属性。
  const props = defineProps<Props>()

  const attrs = useAttrs()

  // 四边间距和对齐只在内置实现中转换为 CSS。
  const rowStyle = computed<CSSProperties>(() => {
    const [top, right, bottom, left] = normalizeSchemxGutter(props.gutter)

    const justifyContent =
      props.justify === "start"
        ? "flex-start"
        : props.justify === "end"
          ? "flex-end"
          : props.justify

    const alignItems =
      props.align === "top"
        ? "flex-start"
        : props.align === "middle"
          ? "center"
          : props.align === "bottom"
            ? "flex-end"
            : undefined

    return {
      "--schemx-gutter-top": `${top / 2}px`,
      "--schemx-gutter-right": `${right / 2}px`,
      "--schemx-gutter-bottom": `${bottom / 2}px`,
      "--schemx-gutter-left": `${left / 2}px`,
      margin: `-${top / 2}px -${right / 2}px -${bottom / 2}px -${left / 2}px`,
      justifyContent,
      alignItems,
    }
  })
</script>

<template>
  <div v-bind="attrs" :style="[attrs.style, rowStyle]">
    <slot />
  </div>
</template>

<style scoped>
  .schemx-row {
    display: flex;
    flex-wrap: wrap;
    box-sizing: border-box;
  }
</style>
