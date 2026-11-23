<template>
  <div :class="['schemx-renderer', 'schemx-date-renderer', props.className]">
    <SchemxCell
      :placeholder="placeholder"
      :readonly-placeholder="props.readonlyPlaceholder"
      :readonly="props.readonly"
      :disabled="props.disabled"
      :content-align="align"
      :value="fieldValue"
      @click="handleClick"
    />

    <Popup
      v-if="!props.readonly && !props.disabled"
      v-model:show="showPicker"
      :class="classNames('schemx-date-popup-renderer', props.popupClassName)"
      v-bind="popupProps"
      safe-area-inset-bottom
    >
      <DatePicker
        :model-value="modelValue"
        v-bind="datePickerProps"
        @confirm="handleConfirm"
        @cancel="handleCancel"
      />
    </Popup>
  </div>
</template>

<script setup lang="ts">
  /**
   * 日期选择渲染器组件
   *
   * 支持 date、time、datetime、dateTime 类型，
   * 使用 Vant DatePicker + Popup + Cell 组合实现。
   *
   * @module renderers/DateRenderer
   */
  import { computed, ref, useAttrs } from "vue"

  import { DatePicker, type FieldTextAlign, Popup } from "vant"

  import classNames from "classnames"
  import dayjs from "dayjs"

  import SchemxCell from "@/components/Cell/index.vue"
  import { getFieldProps } from "@/utils"

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
    readonlyPlaceholder: "-",
    disabled: false,
  })

  const attrs = useAttrs()

  const dateValue = defineModel<DateValue>("value")

  const showPicker = ref(false)

  const placeholder = computed(() => props.placeholder || "请选择")

  const align = computed(
    () => getFieldProps(props, "contentAlign", "right") as FieldTextAlign
  )

  const title = computed(() => props.title || placeholder.value)

  const datePickerProps = computed(() => {
    const {
      value: _value,
      onChange: _onChange,
      onConfirm: _onConfirm,
      onClose: _onClose,
      format: _format,
      className: _className,
      popupClassName: _popupClassName,
      readonlyPlaceholder: _readonlyPlaceholder,
      contentAlign: _contentAlign,
      formItemProps: _formItemProps,
      popupProps: _popupProps,
      title: _title,
      ...rest
    } = props

    return { ...attrs, ...rest, title: title.value }
  })

  const popupProps = computed(() => ({
    round: true,
    position: "bottom" as const,
    safeAreaInsetBottom: true,
    teleport: "body",
    ...props.popupProps,
  }))

  /**
   * 获取值的函数
   *
   * 支持 String, Array, Date 三种类型。
   */
  const getValue = (value: string | string[] | Date | null | undefined): string => {
    if (!value) return ""

    let dateValue: dayjs.Dayjs

    if (typeof value === "string") {
      dateValue = dayjs(value)
    } else if (Array.isArray(value)) {
      if (value.length === 0) return ""
      dateValue = dayjs(value.join("-"))
    } else if (value instanceof Date) {
      dateValue = dayjs(value)
    } else {
      dateValue = dayjs(value)
    }

    const formatStr = typeof props.format === "string" ? props.format : "YYYY-MM-DD"

    return dateValue.format(formatStr)
  }

  const fieldValue = computed(() => {
    return getValue(dateValue.value)
  })

  const modelValue = computed(() => {
    const value = getValue(dateValue.value) || new Date().toISOString()
    const dateParts = dayjs(value).format("YYYY-MM-DD").split("-")

    return dateParts
  })

  const handleConfirm = ({ selectedValues }: { selectedValues: string[] }): void => {
    const formattedValue = getValue(selectedValues)
    dateValue.value = formattedValue
    props.onConfirm?.(formattedValue)
    props.onChange?.(formattedValue)
    showPicker.value = false
  }

  const handleCancel = (): void => {
    showPicker.value = false
  }

  const handleClick = (): void => {
    if (props.readonly || props.disabled) return
    showPicker.value = true
  }
</script>
