<template>
  <div
    :class="
      classNames('schemx-renderer', 'schemx-date-renderer', props.className, {
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
      :content-align="align"
    />
  </div>

  <WdDatetimePicker
    v-if="!readonly && !disabled"
    v-bind="datePickerProps"
    :visible="showPicker"
    :model-value="pickerModelValue"
    :title="placeholder"
    @update:visible="showPicker = $event"
    @confirm="handleConfirm"
    @cancel="handleCancel"
  />
</template>

<script setup lang="ts">
  /**
   * 日期选择渲染器组件
   *
   * 使用 Wot UI DatetimePicker 实现。
   *
   * @module renderers/DateRenderer
   */
  import { computed, ref, useAttrs } from "vue"

  import WdDatetimePicker from "@wot-ui/ui/components/wd-datetime-picker/wd-datetime-picker.vue"
  import classNames from "classnames"
  import dayjs from "dayjs"

  import Cell from "../../components/Cell/index.vue"

  import type { DateRendererProps, DateValue } from "./types"

  import "./index.scss"

  defineOptions({
    name: "DateRendererComponent",
    inheritAttrs: false,
  })

  const props = withDefaults(defineProps<DateRendererProps>(), {
    value: "",
    onConfirm: () => {},
    format: "YYYY-MM-DD",
    className: "",
    popupClassName: "",
    onChange: () => {},
    placeholder: undefined,
    readonly: false,
    disabled: false,
    contentAlign: "right",
  })

  const attrs = useAttrs()
  const dateValue = defineModel<DateValue>("value")
  const showPicker = ref(false)

  const placeholder = computed(() => props.placeholder || "请选择")
  const readonly = computed(() => props.readonly)
  const disabled = computed(() => props.disabled)
  const align = computed(() => props.contentAlign || "right")

  // 剔除 Schemx 契约字段，避免内部事件和表单元信息透传给 Wot 组件。
  const datePickerProps = computed(() => {
    const {
      value: _value,
      onChange: _onChange,
      onConfirm: _onConfirm,
      onClose: _onClose,
      className: _className,
      popupClassName: _popupClassName,
      format: _format,
      contentAlign: _contentAlign,
      formItemProps: _formItemProps,
      ...rest
    } = props

    return { ...attrs, ...rest }
  })

  const formatValue = (value: DateValue | null | undefined): string => {
    if (!value) return ""
    if (typeof props.format === "function") return props.format(value)

    const format = props.format || "YYYY-MM-DD"

    if (Array.isArray(value)) {
      return value.map((item) => dayjs(item as any).format(format)).join(" - ")
    }

    return dayjs(value as any).format(format)
  }

  const fieldValue = computed(() => formatValue(dateValue.value))

  const pickerModelValue = computed(() => {
    const value = dateValue.value
    if (Array.isArray(value))
      return value.map((item) =>
        typeof item === "number" ? item : dayjs(item as any).valueOf()
      )
    if (typeof value === "number") return value
    if (value instanceof Date) return value.getTime()
    if (typeof value === "string" && value) return dayjs(value).valueOf()

    return Date.now()
  })

  const handleConfirm = ({ value }: { value: DateValue }): void => {
    const formattedValue = formatValue(value)
    dateValue.value = value
    props.onConfirm?.(formattedValue)
    props.onChange?.(formattedValue)
    showPicker.value = false
  }

  const handleCancel = (): void => {
    showPicker.value = false
    props.onClose?.()
  }

  const handleClick = (): void => {
    if (readonly.value || disabled.value) return

    showPicker.value = true
  }
</script>
