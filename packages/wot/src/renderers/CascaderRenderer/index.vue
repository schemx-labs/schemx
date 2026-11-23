<template>
  <div
    :class="
      classNames('schemx-renderer', 'schemx-cascader-renderer', props.className, {
        'schemx-renderer-readonly': readonly,
        'schemx-renderer-disabled': disabled,
      })
    "
    @click="handleClick"
  >
    <Cell
      :value="fieldValue"
      :placeholder="placeholder"
      :readonly="readonly"
      :disabled="disabled"
      :content-align="contentAlign"
    />
  </div>

  <WdCascader
    v-if="!readonly && !disabled"
    v-bind="cascaderProps"
    :visible="showCascader"
    :model-value="cascaderValue"
    :options="columns"
    :title="props.title ?? placeholder"
    :value-key="fieldNames.value || 'value'"
    :text-key="fieldNames.label || fieldNames.text || 'text'"
    :children-key="fieldNames.children || 'children'"
    @update:visible="showCascader = $event"
    @confirm="handleConfirm"
    @close="handleClose"
  />
</template>

<script setup lang="ts">
  /**
   * 级联选择器渲染器组件
   *
   * 使用 Wot UI Cascader 实现。
   *
   * @module renderers/CascaderRenderer
   */
  import { computed, ref, useAttrs } from "vue"

  import WdCascader from "@wot-ui/ui/components/wd-cascader/wd-cascader.vue"
  import classNames from "classnames"

  import Cell from "../../components/Cell/index.vue"
  import { findTreeItem } from "../../utils"

  import type { CascaderFieldNames, CascaderRendererProps, CascaderValue } from "./types"

  import "./index.scss"

  defineOptions({
    name: "CascaderRendererComponent",
    inheritAttrs: false,
  })

  const props = withDefaults(defineProps<CascaderRendererProps>(), {
    value: () => [],
    onConfirm: undefined,
    className: "",
    showAllLevels: true,
    emitPath: true,
    fieldNames: () => ({
      label: "label",
      value: "value",
      children: "children",
    }),
    separator: " - ",
    placeholder: undefined,
    readonly: false,
    disabled: false,
    onChange: undefined,
    options: () => [],
    title: undefined,
    popupClassName: "",
    contentAlign: "right",
  })

  const attrs = useAttrs()
  const cascaderModel = defineModel<CascaderValue>("value")
  const showCascader = ref(false)

  const placeholder = computed(() => props.placeholder || "请选择")
  const readonly = computed(() => props.readonly)
  const disabled = computed(() => props.disabled)
  const contentAlign = computed(() => props.contentAlign || "right")
  const fieldNames = computed<CascaderFieldNames>(() => props.fieldNames || {})

  // 剔除 Schemx 契约字段，避免内部事件和表单元信息透传给 Wot 组件。
  const cascaderProps = computed(() => {
    const {
      value: _value,
      onChange: _onChange,
      onConfirm: _onConfirm,
      className: _className,
      popupClassName: _popupClassName,
      showAllLevels: _showAllLevels,
      emitPath: _emitPath,
      fieldNames: _fieldNames,
      separator: _separator,
      options: _options,
      contentAlign: _contentAlign,
      formItemProps: _formItemProps,
      ...rest
    } = props

    return { ...attrs, ...rest }
  })

  const columns = computed(() => {
    return Array.isArray(props.options) ? props.options : []
  })

  const cascaderValue = computed(() => {
    if (!Array.isArray(cascaderModel.value) || cascaderModel.value.length === 0)
      return undefined

    return props.emitPath
      ? cascaderModel.value
      : cascaderModel.value[cascaderModel.value.length - 1]
  })

  const fieldValue = computed(() => {
    const targetValue = Array.isArray(cascaderModel.value)
      ? cascaderModel.value[cascaderModel.value.length - 1]
      : cascaderModel.value

    const result = findTreeItem(columns.value, targetValue, {
      labelKey: fieldNames.value.label || fieldNames.value.text || "text",
      valueKey: fieldNames.value.value || "value",
      childrenKey: fieldNames.value.children || "children",
    })

    if (!result.labels.length) return ""

    const labels = props.showAllLevels ? result.labels : result.labels.slice(-1)

    return labels.join(props.separator)
  })

  const handleClick = (): void => {
    if (readonly.value || disabled.value) return

    showCascader.value = true
  }

  const handleConfirm = (data: {
    selectedItems?: any[]
    selectedOptions?: any[]
    value: any
  }): void => {
    if (readonly.value || disabled.value) return

    const selectedOptions = data.selectedItems || data.selectedOptions || []
    const valueKey = fieldNames.value.value || "value"
    const valuePath = selectedOptions.map((item) => item[valueKey])
    const value = props.emitPath ? valuePath : [data.value]

    cascaderModel.value = value
    props.onConfirm?.(value)
    props.onChange?.(value)
    showCascader.value = false
  }

  const handleClose = (): void => {
    showCascader.value = false
  }
</script>
