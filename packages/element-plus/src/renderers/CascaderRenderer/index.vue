<template>
  <Wrapper
    :class="['schemx-renderer', 'schemx-cascader-renderer', props.className]"
    :readonly="props.readonly"
    :disabled="props.disabled"
  >
    <template #readonly>
      {{ getReadonlyDisplayValue(displayValue, props.readonlyPlaceholder) }}
    </template>
    <ElCascader
      ref="cascaderRef"
      v-bind="cascaderProps"
      :model-value="currentValue"
      @update:model-value="handleUpdate"
      @blur="handleBlur"
      @focus="handleFocus"
    />
  </Wrapper>
</template>

<script setup lang="ts">
  /** 使用 Element Plus ElCascader 渲染级联字段。 */
  import { computed, ref, useAttrs } from "vue"

  import { Wrapper } from "@schemx/vue"
  import { ElCascader } from "element-plus"

  import { getElementProps } from "@/renderers/shared/props"
  import { findTreeItem, getReadonlyDisplayValue } from "@/utils"

  import type { CascaderRendererProps, CascaderValueType } from "./types"
  import type { CascaderInstance, CascaderOption, CascaderValue } from "element-plus"

  defineOptions({
    name: "CascaderRendererComponent",
    inheritAttrs: false,
  })

  const props = withDefaults(defineProps<CascaderRendererProps>(), {
    value: null,
    options: () => [],
    readonly: false,
    disabled: false,
    readonlyPlaceholder: "-",
    className: "",
    showAllLevels: true,
    separator: " / ",
  })

  const attrs = useAttrs() as Record<string, unknown>

  const valueModel = defineModel<CascaderValueType>("value")

  const cascaderRef = ref<CascaderInstance>()

  const valueKey = computed(() => props.props?.value ?? "value")

  const labelKey = computed(() => props.props?.label ?? "label")

  const childrenKey = computed(() => props.props?.children ?? "children")

  const cascaderProps = computed(() => getElementProps(props, attrs))

  const currentValue = computed(() => valueModel.value ?? props.value ?? null)

  const displayValue = computed(() => getDisplayValue(currentValue.value))

  /**
   * 获取级联值的只读文本。
   *
   * @param value - 当前级联值。
   * @returns 级联路径显示文本。
   */
  function getDisplayValue(value: CascaderValueType): string {
    if (value === null || value === undefined) return ""

    if (props.props?.multiple && Array.isArray(value) && Array.isArray(value[0])) {
      return (value as unknown[][]).map((path) => getDisplayPath(path)).join("、")
    }

    const targetValue = Array.isArray(value) ? value[value.length - 1] : value

    const result = findTreeItem(props.options as CascaderOption[], targetValue, {
      labelKey: labelKey.value,
      valueKey: valueKey.value,
      childrenKey: childrenKey.value,
    })

    if (result.labels.length === 0) return String(targetValue)

    return props.showAllLevels
      ? result.labels.join(props.separator)
      : (result.labels.at(-1) ?? "")
  }

  /**
   * 获取单条级联路径的只读文本。
   *
   * @param path - 当前级联路径的值列表。
   * @returns 级联路径显示文本。
   */
  function getDisplayPath(path: unknown[]): string {
    const targetValue = path[path.length - 1]

    const result = findTreeItem(props.options as CascaderOption[], targetValue, {
      labelKey: labelKey.value,
      valueKey: valueKey.value,
      childrenKey: childrenKey.value,
    })

    if (result.labels.length === 0) return String(targetValue)

    return props.showAllLevels
      ? result.labels.join(props.separator)
      : (result.labels.at(-1) ?? "")
  }

  /**
   * 同步 Element Plus 级联值。
   *
   * @param value - Element Plus 产生的新级联值。
   */
  const handleUpdate = (value: CascaderValue | null | undefined): void => {
    const nextValue = value ?? null

    valueModel.value = nextValue
    props.onChange?.(nextValue)
  }

  /**
   * 处理级联控件失焦。
   *
   * @param _event - Element Plus 产生的原生失焦事件。
   */
  const handleBlur = (_event: FocusEvent): void => {
    props.onBlur?.(currentValue.value)
  }

  /**
   * 处理级联控件聚焦。
   *
   * @param event - Element Plus 产生的原生聚焦事件。
   */
  const handleFocus = (event: FocusEvent): void => {
    props.onFocus?.(event)
  }

  defineExpose({
    /** 聚焦内部级联输入控件。 */
    focus: () => cascaderRef.value?.focus(),
    /** 使内部级联输入控件失焦。 */
    blur: () => cascaderRef.value?.blur(),
  })
</script>
<style>
  .schemx-renderer {
    box-sizing: border-box;
    width: 100%;
  }

  .schemx-cascader-renderer > .el-cascader {
    width: 100%;
  }
</style>
