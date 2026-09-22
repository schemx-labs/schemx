<template>
  <Wrapper
    :class="['schemx-renderer', 'schemx-tree-select-renderer', props.className]"
    :readonly="props.readonly"
    :disabled="props.disabled"
  >
    <template #readonly>
      {{ getReadonlyDisplayValue(displayValue, props.readonlyPlaceholder) }}
    </template>
    <ElTreeSelect
      ref="treeSelectRef"
      v-bind="treeSelectProps"
      :model-value="currentValue"
      @update:model-value="handleUpdate"
      @check="handleCheck"
      @node-click="handleNodeClick"
      @node-expand="handleNodeExpand"
      @visible-change="handleVisibleChange"
      @clear="handleClear"
      @blur="handleBlur"
      @focus="handleFocus"
    >
      <template v-if="$slots.default" #default="slotProps">
        <slot name="default" v-bind="slotProps" />
      </template>
      <template v-if="$slots.header" #header>
        <slot name="header" />
      </template>
      <template v-if="$slots.footer" #footer>
        <slot name="footer" />
      </template>
      <template v-if="$slots.loading" #loading>
        <slot name="loading" />
      </template>
      <template v-if="$slots.tag" #tag="slotProps">
        <slot name="tag" v-bind="slotProps" />
      </template>
    </ElTreeSelect>
  </Wrapper>
</template>

<script setup lang="ts">
  /** 使用 Element Plus ElTreeSelect 渲染树形选择字段。 */
  import { computed, ref, useAttrs } from "vue"

  import { Wrapper } from "@schemx/vue"
  import { ElTreeSelect } from "element-plus"

  import { normalizeElementSelection } from "@/renderers/shared/options"
  import { getElementProps } from "@/renderers/shared/props"
  import { findTreeItem, getReadonlyDisplayValue } from "@/utils"

  import type { TreeSelectRendererProps, TreeSelectValue } from "./types"
  import type { CheckedInfo, TreeNodeData, TreeSelectInstance } from "element-plus"

  defineOptions({
    name: "TreeSelectRendererComponent",
    inheritAttrs: false,
  })

  const props = withDefaults(defineProps<TreeSelectRendererProps>(), {
    value: null,
    readonly: false,
    disabled: false,
    readonlyPlaceholder: "-",
    className: "",
    multiple: false,
  })

  const attrs = useAttrs() as Record<string, unknown>

  const valueModel = defineModel<TreeSelectValue>("value")

  const treeSelectRef = ref<TreeSelectInstance>()

  const currentValue = computed(() =>
    normalizeElementSelection(
      valueModel.value === undefined ? props.value : valueModel.value,
      props.multiple
    )
  )

  const treeData = computed<TreeNodeData[]>(() => props.options ?? props.data ?? [])

  const treeSelectProps = computed(() => ({
    ...getElementProps(props, attrs, [
      "options",
      "onCheck",
      "onNodeClick",
      "onNodeExpand",
      "onVisibleChange",
      "onClear",
      "onBlur",
      "onFocus",
    ]),
    data: treeData.value,
    nodeKey: props.nodeKey ?? "value",
    valueKey: props.valueKey ?? "value",
  }))

  const displayValue = computed(() => getTreeDisplayValue(currentValue.value))

  /** 将树节点值反查为路径文本。 */
  function getTreeDisplayValue(value: TreeSelectValue): string {
    const values = Array.isArray(value) ? value : [value]

    const valueKey = props.valueKey ?? "value"

    const labelKey = typeof props.props?.label === "string" ? props.props.label : "label"

    const childrenKey = props.props?.children ?? "children"

    return values
      .filter((item): item is string | number | boolean => item !== null)
      .map((item) => {
        const result = findTreeItem(treeData.value, item, {
          labelKey,
          valueKey,
          childrenKey,
        })

        return result.labels.length ? result.labels.join(" / ") : String(item)
      })
      .join("、")
  }

  /** 同步树形选择值。 */
  const handleUpdate = (value: unknown): void => {
    if (props.readonly || props.disabled) return

    const nextValue = normalizeElementSelection(value, props.multiple)

    valueModel.value = nextValue
    props.onChange?.(nextValue)
  }

  /** 处理树节点勾选。 */
  const handleCheck = (data: TreeNodeData, info: CheckedInfo): void => {
    props.onCheck?.(data, info)
  }

  /** 处理树节点点击。 */
  const handleNodeClick = (
    data: TreeNodeData,
    node: unknown,
    event: MouseEvent
  ): void => {
    props.onNodeClick?.(data, node, event)
  }

  /** 处理树节点展开。 */
  const handleNodeExpand = (
    data: TreeNodeData,
    node: unknown,
    instance: unknown
  ): void => {
    props.onNodeExpand?.(data, node, instance)
  }

  /** 处理树形选择下拉面板显示状态变化。 */
  const handleVisibleChange = (visible: boolean): void => {
    props.onVisibleChange?.(visible)
  }

  /** 处理树形选择清空。 */
  const handleClear = (): void => {
    props.onClear?.()
  }

  /** 处理树形选择器失焦。 */
  const handleBlur = (event: FocusEvent): void => {
    props.onBlur?.(event)
  }

  /** 处理树形选择器聚焦。 */
  const handleFocus = (event: FocusEvent): void => {
    props.onFocus?.(event)
  }

  defineExpose({
    /** 聚焦内部树形选择器。 */
    focus: () => treeSelectRef.value?.selectRef?.focus(),
    /** 使内部树形选择器失焦。 */
    blur: () => treeSelectRef.value?.selectRef?.blur(),
  })
</script>

<style>
  .schemx-renderer {
    box-sizing: border-box;
    width: 100%;
  }
</style>
