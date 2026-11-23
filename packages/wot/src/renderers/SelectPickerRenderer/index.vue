<template>
  <div
    :class="
      classNames('schemx-renderer', 'schemx-select-picker-renderer', props.className, {
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

  <WdSelectPicker
    v-bind="selectPickerProps"
    :visible="showPicker"
    :model-value="displayValue"
    :columns="columns"
    :type="type"
    :title="props.title || displayPlaceholder"
    :value-key="fieldNames.value || 'value'"
    :label-key="fieldNames.label || 'label'"
    @update:visible="showPicker = $event"
    @confirm="handleConfirm"
    @cancel="handleCancel"
  />
</template>

<script setup lang="ts">
  /**
   * 选择弹窗渲染器组件
   *
   * 基于 Wot UI SelectPicker 实现单选/多选弹窗。
   *
   * @module renderers/SelectPickerRenderer
   */
  import { computed, ref, useAttrs } from "vue"

  import WdSelectPicker from "@wot-ui/ui/components/wd-select-picker/wd-select-picker.vue"
  import classNames from "classnames"

  import Cell from "../../components/Cell/index.vue"

  import type {
    SelectPickerConfirmEventParams,
    SelectPickerOption,
    SelectPickerRendererProps,
    SelectPickerValue,
  } from "./types"

  import "./index.scss"

  defineOptions({
    name: "SelectPickerRendererComponent",
    inheritAttrs: false,
  })

  const props = withDefaults(defineProps<SelectPickerRendererProps>(), {
    value: undefined,
    onChange: () => {},
    onConfirm: () => {},
    className: "",
    readonly: false,
    disabled: false,
    options: () => [],
    columns: () => [],
    fieldNames: () => ({
      label: "label",
      value: "value",
    }),
    type: "checkbox",
    contentAlign: "right",
  })

  const attrs = useAttrs()
  const selectPickerValue = defineModel<SelectPickerValue>("value")
  const showPicker = ref(false)

  const readonly = computed(() => props.readonly)
  const disabled = computed(() => props.disabled)
  const type = computed(() => props.type || "checkbox")
  const contentAlign = computed(() => props.contentAlign || "right")
  const displayPlaceholder = computed(() => props.placeholder || "请选择")
  const fieldNames = computed(() => props.fieldNames || {})

  const columns = computed<SelectPickerOption[]>(() => {
    if (Array.isArray(props.options) && props.options.length > 0) return props.options

    return props.columns || []
  })

  const normalizeValue = (value: SelectPickerValue | undefined): SelectPickerValue => {
    if (type.value === "checkbox") return Array.isArray(value) ? value : []

    return value ?? ""
  }

  const displayValue = computed<SelectPickerValue>(() =>
    normalizeValue(selectPickerValue.value ?? props.value)
  )

  // 剔除 Schemx 契约字段，避免内部事件和表单元信息透传给 Wot 组件。
  const selectPickerProps = computed(() => {
    const {
      value: _value,
      onChange: _onChange,
      onConfirm: _onConfirm,
      className: _className,
      options: _options,
      columns: _columns,
      fieldNames: _fieldNames,
      contentAlign: _contentAlign,
      formItemProps: _formItemProps,
      ...rest
    } = props

    return { ...attrs, ...rest }
  })

  const getOptionLabel = (value: unknown): string => {
    const valueKey = fieldNames.value.value || "value"
    const labelKey = fieldNames.value.label || "label"
    const option = columns.value.find((item) => item[valueKey] === value)

    return String(option?.[labelKey] ?? value ?? "")
  }

  const fieldValue = computed(() => {
    const value = displayValue.value

    if (Array.isArray(value)) {
      return value.map((item) => getOptionLabel(item)).filter(Boolean).join("、")
    }

    return getOptionLabel(value)
  })

  const handleClick = (): void => {
    if (readonly.value || disabled.value) return

    showPicker.value = true
  }

  const handleConfirm = (detail: SelectPickerConfirmEventParams): void => {
    const value = detail.value

    selectPickerValue.value = value
    props.onConfirm?.(value, detail)
    props.onChange?.(value, detail)
    showPicker.value = false
  }

  const handleCancel = (): void => {
    showPicker.value = false
  }
</script>
