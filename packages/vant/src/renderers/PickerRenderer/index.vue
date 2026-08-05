<template>
  <div :class="['schemx-renderer', 'schemx-picker-renderer', props.className]">
    <SchemxCell
      :placeholder="placeholder"
      :readonly-placeholder="props.readonlyPlaceholder"
      :readonly="props.readonly"
      :disabled="props.disabled"
      :align="props.contentAlign"
      :value="fieldValue"
      @click="handleClick"
    />

    <Popup
      v-if="!props.readonly && !props.disabled"
      v-model:show="showPicker"
      :class="classNames('schemx-picker-popup-renderer', props.popupClassName)"
      v-bind="popupProps"
      safe-area-inset-bottom
      @close="handleClose"
    >
      <Picker
        :model-value="modelValue"
        :columns="columns"
        :columns-field-names="fieldNames"
        v-bind="pickerProps"
        @confirm="handleConfirm"
        @cancel="handleCancel"
      >
        <template #empty>
          <div class="schemx-picker-empty">No data</div>
        </template>
      </Picker>
    </Popup>
  </div>
</template>

<script setup lang="ts">
  /**
   * 选择渲染器组件
   *
   * 使用 Vant Picker + Popup + Cell 组合实现。
   *
   * @module renderers/PickerRenderer
   */
  import { computed, ref, useAttrs } from "vue"

  import { Picker, Popup } from "vant"
  import type { PickerConfirmEventParams, PickerOption } from "vant"

  import classNames from "classnames"

  import SchemxCell from "@/components/Cell/index.vue"
  import { findTreeItem } from "@/utils"

  import type { PickerFieldNames, PickerRendererProps, PickerValue } from "./types"

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
    readonlyPlaceholder: "-",
    readonly: false,
    disabled: false,
    title: "",
    options: () => [],
    fieldNames: () => ({ text: "text", value: "value", children: "children" }),
  })

  const attrs = useAttrs()

  const pickerValue = defineModel<PickerValue>("value")

  const showPicker = ref(false)

  const placeholder = computed(() => props?.placeholder || "请选择")

  const title = computed(() => props.title || placeholder.value)

  const pickerProps = computed(() => {
    const rendererProps = props as typeof props & { formInstance?: unknown }

    const {
      value: _value,
      onChange: _onChange,
      onBlur: _onBlur,
      onConfirm: _onConfirm,
      className: _className,
      popupClassName: _popupClassName,
      readonlyPlaceholder: _readonlyPlaceholder,
      separator: _separator,
      showAllLevels: _showAllLevels,
      emitPath: _emitPath,
      options: _options,
      columns: _columns,
      columnsFieldNames: _columnsFieldNames,
      fieldNames: _fieldNames,
      contentAlign: _contentAlign,
      readonly: _readonly,
      disabled: _disabled,
      placeholder: _placeholder,
      formItemProps: _formItemProps,
      popupProps: _popupProps,
      title: _title,
      formInstance: _formInstance,
      ...rest
    } = rendererProps

    const {
      value: _attrsValue,
      onChange: _attrsOnChange,
      onBlur: _attrsOnBlur,
      onConfirm: _attrsOnConfirm,
      className: _attrsClassName,
      popupClassName: _attrsPopupClassName,
      readonly: _attrsReadonly,
      readonlyPlaceholder: _attrsReadonlyPlaceholder,
      disabled: _attrsDisabled,
      placeholder: _attrsPlaceholder,
      separator: _attrsSeparator,
      showAllLevels: _attrsShowAllLevels,
      emitPath: _attrsEmitPath,
      options: _attrsOptions,
      columns: _attrsColumns,
      columnsFieldNames: _attrsColumnsFieldNames,
      fieldNames: _attrsFieldNames,
      contentAlign: _attrsContentAlign,
      formItemProps: _attrsFormItemProps,
      popupProps: _attrsPopupProps,
      formInstance: _attrsFormInstance,
      ...attrsRest
    } = attrs

    return { ...attrsRest, ...rest, title: title.value }
  })

  const popupProps = computed(() => ({
    round: true,
    position: "bottom" as const,
    safeAreaInsetBottom: true,
    teleport: "body",
    ...props.popupProps,
  }))

  /** 数据源 */
  const columns = computed<PickerOption[]>(() => {
    if (Array.isArray(props.options) && props.options?.length > 0) {
      return props.options
    }

    return props?.columns || []
  })

  /** 获取字段名 */
  const fieldNames = computed<PickerFieldNames>(
    () => props?.columnsFieldNames || props?.fieldNames
  )

  /** 获取字段值 */
  const fieldValue = computed(() => {
    const result = findTreeItem(columns.value, pickerValue.value, {
      labelKey: fieldNames.value?.text,
      valueKey: fieldNames.value?.value,
      childrenKey: fieldNames.value?.children,
    })

    const label = props.showAllLevels ? result?.labels : result?.labels.slice(-1)

    return result.labels.length
      ? label?.join(props.separator)
      : pickerValue.value?.toString()
  })

  const modelValue = computed(() => {
    if (
      pickerValue.value === undefined ||
      pickerValue.value === null ||
      pickerValue.value === ""
    ) {
      return []
    }

    return Array.isArray(pickerValue.value) ? pickerValue.value : [pickerValue.value]
  })

  /** 处理确认 */
  const handleConfirm = (values: PickerConfirmEventParams): void => {
    const value = props.emitPath
      ? values.selectedValues
      : values.selectedValues[values.selectedValues.length - 1]

    pickerValue.value = value

    props.onConfirm?.(value, values)
    props.onChange?.(value, values)
    showPicker.value = false
  }

  /** 处理取消 */
  const handleCancel = (): void => {
    showPicker.value = false
  }

  /** 处理点击 */
  const handleClick = (): void => {
    if (props.readonly || props.disabled) return
    showPicker.value = true
  }

  /** 弹窗关闭（确认/取消/遮罩）统一出口，触发 blur 校验 */
  const handleClose = (): void => {
    props.onBlur?.(modelValue.value)
  }
</script>
