<script setup lang="ts">
  import { computed, useAttrs } from "vue"
  import type { CSSProperties } from "vue"

  import { normalizeSchemxGutter } from "../../utils"

  import type { SchemxGutter, SchemxRowConfig } from "../../types"

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

    // 将公共主轴对齐值转换为 Flex 对齐值，其他 CSS 值直接透传。
    let justifyContent: CSSProperties["justifyContent"] = props.justify

    if (props.justify === "start") {
      justifyContent = "flex-start"
    } else if (props.justify === "end") {
      justifyContent = "flex-end"
    }

    // 未配置交叉轴对齐时保留浏览器默认行为。
    let alignItems: CSSProperties["alignItems"]

    if (props.align === "top") {
      alignItems = "flex-start"
    } else if (props.align === "middle") {
      alignItems = "center"
    } else if (props.align === "bottom") {
      alignItems = "flex-end"
    }

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
