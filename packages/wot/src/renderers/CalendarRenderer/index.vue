<template>
  <div
    :class="
      classNames('schemx-renderer', 'schemx-calendar-renderer', props.className, {
        'schemx-renderer-readonly': readonly,
        'schemx-renderer-disabled': disabled,
      })
    "
    @click="handleClick"
  >
    <Cell
      :value="modelValue"
      :placeholder="placeholder"
      :readonly="readonly"
      :disabled="disabled"
      :content-align="align"
    />
  </div>

  <WdCalendar
    v-if="!readonly && !disabled"
    v-bind="calendarProps"
    :visible="showCalendar"
    :model-value="calendarModelValue"
    :type="props.type"
    :title="title"
    show-confirm
    @update:visible="showCalendar = $event"
    @confirm="handleConfirm"
  />
</template>

<script setup lang="ts">
  /**
   * 日历选择器渲染器组件
   *
   * 使用 Wot UI Calendar 实现。
   *
   * @module renderers/CalendarRenderer
   */
  import { computed, ref, useAttrs } from "vue"

  import WdCalendar from "@wot-ui/ui/components/wd-calendar/wd-calendar.vue"
  import classNames from "classnames"
  import dayjs from "dayjs"

  import Cell from "../../components/Cell/index.vue"

  import type {
    CalendarFormattedValue,
    CalendarRendererProps,
    CalendarValue,
  } from "./types"

  import "./index.scss"

  defineOptions({
    name: "CalendarRendererComponent",
    inheritAttrs: false,
  })

  const props = withDefaults(defineProps<CalendarRendererProps>(), {
    value: null,
    onConfirm: () => {},
    className: "",
    placeholder: "",
    onChange: () => {},
    readonly: false,
    disabled: false,
    type: "date",
    format: "YYYY-MM-DD",
    separator: " - ",
    contentAlign: "right",
  })

  const attrs = useAttrs()
  const calendarValue = defineModel<CalendarValue>("value")
  const showCalendar = ref(false)

  const placeholder = computed(() => props.placeholder || "请选择")
  const readonly = computed(() => props.readonly)
  const disabled = computed(() => props.disabled)

  const align = computed(() => props.contentAlign || "right")

  const title = computed(() => props.title || placeholder.value)

  // 剔除 Schemx 契约字段，避免内部事件和表单元信息透传给 Wot 组件。
  const calendarProps = computed(() => {
    const {
      value: _value,
      onChange: _onChange,
      onConfirm: _onConfirm,
      className: _className,
      format: _format,
      separator: _separator,
      contentAlign: _contentAlign,
      type: _type,
      formItemProps: _formItemProps,
      ...rest
    } = props

    return { ...attrs, ...rest }
  })

  const toTimestamp = (value: unknown): number | null => {
    if (value === null || value === undefined || value === "") return null
    if (typeof value === "number") return value

    const date = value instanceof Date ? value : dayjs(value as any).toDate()

    return Number.isNaN(date.getTime()) ? null : date.getTime()
  }

  const calendarModelValue = computed(() => {
    const value = calendarValue.value
    if (Array.isArray(value))
      return value.map(toTimestamp).filter((i): i is number => i !== null)

    return toTimestamp(value)
  })

  const getValue = (value: CalendarValue | undefined): CalendarFormattedValue => {
    if (!value) return ""
    if (Array.isArray(value)) {
      return value.map((item) => dayjs(item as any).format(props.format))
    }

    return dayjs(value as any).format(props.format)
  }

  const modelValue = computed(() => {
    const value = getValue(calendarValue.value)

    return Array.isArray(value) ? value.join(props.separator) : value
  })

  const handleConfirm = ({ value }: { value: number | number[] | null }): void => {
    if (props.readonly || props.disabled) return

    calendarValue.value = value
    const formattedValue = getValue(value)
    props.onConfirm?.(formattedValue)
    props.onChange?.(formattedValue)
    showCalendar.value = false
  }

  const handleClick = (): void => {
    if (props.readonly || props.disabled) return

    showCalendar.value = true
  }
</script>
