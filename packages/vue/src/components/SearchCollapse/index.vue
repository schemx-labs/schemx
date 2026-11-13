<script setup lang="ts">
  import { computed, getCurrentInstance, ref, useSlots, watchEffect } from "vue"
  import type { Slot } from "vue"

  import { useSearchCollapse } from "../../hooks/useSearchCollapse"
  import { useSearchLayout } from "../../hooks/useSearchLayout"
  import { useSearchTransition } from "../../hooks/useSearchTransition"
  import Button from "../Button"

  import type {
    SchemxSearchCollapseAction,
    SchemxSearchCollapseSlotProps,
  } from "../../types"

  /**
   * 搜索折叠容器配置；内容和操作区由插槽提供。
   */
  interface Props {
    /**
     * 折叠开关、受控状态、文案和按钮配置，默认启用。
     */
    collapse?: SchemxSearchCollapseAction
  }

  defineOptions({ name: "SchemxSearchCollapse", inheritAttrs: false })

  // 调用方传入的折叠策略，不接收或修改业务 Schema。
  const props = withDefaults(defineProps<Props>(), { collapse: true })

  // 操作区可独立关闭，触发器插槽沿用 Search 的公开契约。
  const slots = useSlots()

  console.log(" > ~ slots:", slots)

  /**
   * 默认插槽放置根级 SchemaList，actions 放置查询和重置操作。
   */
  defineSlots<{
    default?: Slot
    actions?: Slot
    collapse?: Slot<SchemxSearchCollapseSlotProps>
  }>()

  // 外层控制可见高度，内层始终保持自然布局以供测量。
  const fieldsRef = ref<HTMLElement | null>(null)

  // 自然内容层，不与外层高度动画共享测量目标。
  const contentRef = ref<HTMLElement | null>(null)

  // 根级列的实测尺寸及首行范围。
  const layout = useSearchLayout(contentRef)

  // 超过首行才允许折叠，布局变化不改写用户保存的状态。
  const hasOverflow = computed(() =>
    Boolean(layout.value && layout.value.firstRowCount < layout.value.columns.length)
  )

  // 受控与非受控折叠沿用同一套状态规则。
  const {
    collapseConfig,
    canCollapse,
    isCollapsed,
    requestedCollapsed,
    toggleCollapse,
    prepareFieldForScroll,
  } = useSearchCollapse({ getCollapse: () => props.collapse, hasOverflow })

  // 动画目标读取自然内容高度，避免从被裁剪容器反推完整高度。
  const targetHeight = computed(() =>
    isCollapsed.value ? layout.value?.collapsedHeight : layout.value?.expandedHeight
  )

  // 收起后从键盘和辅助技术中移除后续行，保留组件实例与自然尺寸。
  watchEffect(
    () => {
      // 当前测量包含的根级列，不遍历分组内部字段。
      const measurement = layout.value

      // column 和 index 是根级列及其在完整列表中的顺序。
      measurement?.columns.forEach((column, index) => {
        // 首行之外的列仅在实际收起时禁用交互。
        const hidden = isCollapsed.value && index >= measurement.firstRowCount

        column.toggleAttribute("inert", hidden)
        if (hidden) {
          column.setAttribute("aria-hidden", "true")
        } else {
          column.removeAttribute("aria-hidden")
        }
      })
    },
    { flush: "post" }
  )

  // 只透传按钮外观，原生行为和折叠点击由容器固定管理。
  const collapseButtonProps = computed(() =>
    Object.fromEntries(
      Object.entries(collapseConfig.value.buttonProps ?? {}).filter(
        // name 是调用方提供的按钮属性名。
        ([name]) => name !== "nativeType" && name !== "native-type" && name !== "onClick"
      )
    )
  )

  useSearchTransition({
    element: fieldsRef,
    height: targetHeight,
  })

  // 多个根级条件才可能需要折叠入口。
  const showToggle = computed(
    () => props.collapse !== false && (layout.value?.columns.length ?? 0) > 1
  )

  // 每份折叠区域使用独立 ID 关联触发按钮。
  const fieldsId = `schemx-search-${getCurrentInstance()?.uid}-fields`

  // 内部组件只暴露定位前展开，表单 API 仍由 Search 对外提供。
  defineExpose({ prepareFieldForScroll })
</script>

<template>
  <div v-bind="$attrs" class="schemx-search">
    <div
      :id="fieldsId"
      ref="fieldsRef"
      class="schemx-search-fields"
      :class="{ 'is-collapsed': isCollapsed }"
      :style="isCollapsed ? { height: `${targetHeight}px` } : undefined"
    >
      <div ref="contentRef" class="schemx-search-content">
        <slot />
      </div>
    </div>
    <div v-if="slots.actions || showToggle" class="schemx-search-actions">
      <slot name="actions" />
      <span
        v-if="showToggle"
        v-show="canCollapse"
        class="schemx-search-toggle"
        :class="{ 'is-placeholder': !canCollapse }"
        :inert="!canCollapse"
        :aria-hidden="!canCollapse || undefined"
      >
        <component
          :is="slots.collapse"
          v-if="slots.collapse"
          :collapsed="isCollapsed"
          :toggle="toggleCollapse"
        />
        <Button
          v-else
          v-bind="collapseButtonProps"
          :class="
            canCollapse ? 'schemx-search-collapse' : 'schemx-search-collapse-placeholder'
          "
          native-type="button"
          :aria-expanded="!isCollapsed"
          :aria-controls="fieldsId"
          @click="toggleCollapse"
        >
          {{
            requestedCollapsed
              ? (collapseConfig.expandText ?? "展开")
              : (collapseConfig.collapseText ?? "收起")
          }}
        </Button>
      </span>
    </div>
  </div>
</template>

<style scoped>
  .schemx-search {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: var(--schemx-space-md);
  }

  .schemx-search-fields {
    flex: 1 1 20rem;
    min-width: 0;
  }
  .schemx-search-content {
    display: flow-root;
  }

  /*
   * 仅裁剪后续行，避免定位字段时把折叠容器当作可滚动祖先并留下偏移。
   */
  .schemx-search-fields.is-collapsed {
    overflow: clip;
  }

  .schemx-search-toggle {
    display: inline-flex;
  }

  /*
   * 不可折叠时触发器不可见；展开和收起状态共用同一入口。
   */
  .schemx-search-toggle.is-placeholder {
    visibility: hidden;
  }

  /*
   * 操作区不消耗字段栅格，窄容器中可以换行。
   */
  .schemx-search-actions {
    display: flex;
    align-items: center;
    gap: var(--schemx-space-sm);
    flex: 0 0 auto;
    flex-wrap: wrap;
    max-width: 100%;
    margin-left: auto;
    padding: 0;
    min-height: var(--schemx-control-height);
  }
  /*
   * 仅提供操作插槽但所有操作均关闭时，不保留空的操作区。
   */
  .schemx-search-actions:empty {
    display: none;
  }
</style>
