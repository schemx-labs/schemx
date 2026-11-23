<template>
  <div
    :class="
      classNames('schemx-renderer', 'schemx-picker-renderer', props.className, {
        'schemx-renderer-readonly': readonly,
        'schemx-renderer-disabled': disabled,
      })
    "
    @click="handleClick"
  >
    <Cell
      :value="fieldValue"
      :placeholder="displayPlaceholder"
      :readonly="readonly"
      :disabled="disabled"
      :content-align="contentAlign"
    />
  </div>

  <WdPicker
    v-bind="pickerProps"
    :visible="showPicker"
    :model-value="modelValue"
    :title="props.title || displayPlaceholder"
    :columns="columns"
    :value-key="fieldNames.value || 'value'"
    :label-key="fieldNames.label || fieldNames.text || 'label'"
    :children-key="fieldNames.children || 'children'"
    @confirm="handleConfirm"
    @cancel="handleCancel"
  />
</template>

<script setup lang="ts">
  /**
   * 选择渲染器组件
   *
   * 使用 Wot UI Picker 实现。
   *
   * @module renderers/PickerRenderer
   */
  import { computed, ref, useAttrs } from "vue"

  import WdPicker from "@wot-ui/ui/components/wd-picker/wd-picker.vue"
  import classNames from "classnames"

  import Cell from "../../components/Cell/index.vue"
  import { findTreeItem } from "../../utils"

  import type {
    PickerConfirmEventParams,
    PickerRendererProps,
    PickerValue,
  } from "./types"

  import "./index.scss"

  defineOptions({
    name: "PickerRendererComponent",
    inheritAttrs: false,
  })

  const props = withDefaults(defineProps<PickerRendererProps>(), {
    separator: " - ",
    value: undefined,
    showAllLevels: false,
    emitPath: false,
    onConfirm: () => {},
    className: "",
    popupClassName: "",
    onChange: () => {},
    readonly: false,
    disabled: false,
    title: "",
    options: () => [],
    fieldNames: () => ({
      label: "label",
      value: "value",
      children: "children",
    }),
    contentAlign: "right",
  })

  const attrs = useAttrs()
  const pickerValue = defineModel<PickerValue>("value")
  const showPicker = ref(false)

  const displayPlaceholder = computed(() => props.placeholder || "请选择")
  const readonly = computed(() => props.readonly)
  const disabled = computed(() => props.disabled)
  const contentAlign = computed(() => props.contentAlign || "right")
  const fieldNames = computed(() => props.fieldNames || {})

  // 剔除 Schemx 契约字段，避免内部事件和表单元信息透传给 Wot 组件。
  const pickerProps = computed(() => {
    const {
      value: _value,
      onChange: _onChange,
      onConfirm: _onConfirm,
      className: _className,
      popupClassName: _popupClassName,
      emitPath: _emitPath,
      showAllLevels: _showAllLevels,
      separator: _separator,
      options: _options,
      columns: _columns,
      fieldNames: _fieldNames,
      contentAlign: _contentAlign,
      formItemProps: _formItemProps,
      ...rest
    } = props

    return { ...attrs, ...rest }
  })

  const columns = computed(() => {
    if (Array.isArray(props.options) && props.options.length > 0) return props.options

    return props.columns || []
  })

  const fieldValue = computed(() => {
    const result = findTreeItem(columns.value, pickerValue.value, {
      labelKey: fieldNames.value.label || fieldNames.value.text || "label",
      valueKey: fieldNames.value.value || "value",
      childrenKey: fieldNames.value.children || "children",
    })

    const labels = props.showAllLevels ? result.labels : result.labels.slice(-1)

    return result.labels.length
      ? labels.join(props.separator)
      : pickerValue.value?.toString()
  })

  const modelValue = computed<Array<string | number>>(() => {
    if (
      pickerValue.value === undefined ||
      pickerValue.value === null ||
      pickerValue.value === ""
    ) {
      return []
    }

    return Array.isArray(pickerValue.value) ? pickerValue.value : [pickerValue.value]
  })

  const handleConfirm = (detail: PickerConfirmEventParams): void => {
    const selectedValues = detail.value || []
    const value = props.emitPath
      ? selectedValues
      : selectedValues[selectedValues.length - 1]

    pickerValue.value = value
    props.onConfirm?.(value, detail)
    props.onChange?.(value, detail)
    showPicker.value = false
  }

  const handleCancel = (): void => {
    showPicker.value = false
  }

  const handleClick = (): void => {
    if (readonly.value || disabled.value) return
    showPicker.value = true
  }
</script>
