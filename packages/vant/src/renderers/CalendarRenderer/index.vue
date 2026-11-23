<template>
  <div :class="['schemx-renderer', 'schemx-calendar-renderer', props.className]">
    <SchemxCell
      :placeholder="placeholder"
      :readonly-placeholder="props.readonlyPlaceholder"
      :readonly="isReadonly"
      :disabled="props.disabled"
      :value="modelValue"
      :content-align="align"
      @click="handleClick"
    />

    <Calendar
      v-if="!isReadonly && !props.disabled"
      v-bind="calendarProps"
      v-model:show="showCalendar"
      @confirm="handleConfirm"
    />
  </div>
</template>

<script setup lang="ts">
  /**
   * 日历选择器渲染器组件
   *
   * 使用 Vant Calendar + Cell 组合实现。
   *
   * @module renderers/CalendarRenderer
   */
  import { computed, ref, useAttrs } from "vue"

  import { Calendar } from "vant"
  import type { FieldTextAlign } from "vant"

  import classNames from "classnames"
  import dayjs from "dayjs"

  import SchemxCell from "@/components/Cell/index.vue"
  import { getFieldProps } from "@/utils"

  import type { CalendarRendererProps, CalendarValue } from "./types"

  import "./index.scss"

  defineOptions({
    name: "CalendarRendererComponent",
    inheritAttrs: false,
  })

  const props = withDefaults(defineProps<CalendarRendererProps>(), {
    value: "",
    onConfirm: () => {},
    className: "",
    placeholder: "",
    onChange: () => {},
    readonly: false,
    readonlyPlaceholder: "-",
    disabled: false,
    type: "single",
    format: "YYYY-MM-DD",
    separator: " - ",
    safeAreaInsetBottom: true,
  })

  const attrs = useAttrs()

  const calendarValue = defineModel<CalendarValue>("value")

  const showCalendar = ref(false)

  const minSelectableDate = new Date(1970, 0, 1)
  const maxSelectableDate = dayjs().add(10, "year").toDate()

  const placeholder = computed(() => props?.placeholder || "请选择")

  const align = computed(
    () => getFieldProps(props, "contentAlign", "right") as FieldTextAlign
  )

  const title = computed(() => props.title || placeholder.value)
  const isReadonly = computed(() => props.readonly || Boolean(props.view))

  // 剔除 Schemx 契约字段，避免内部事件和表单元信息透传给 Vant 组件。
  const calendarProps = computed(() => {
    const {
      value: _value,
      onChange: _onChange,
      onConfirm: _onConfirm,
      className: _className,
      popupClassName: _popupClassName,
      format: _format,
      separator: _separator,
      contentAlign: _contentAlign,
      type: _type,
      formItemProps: _formItemProps,
      minDate = minSelectableDate,
      maxDate = maxSelectableDate,
      ...rest
    } = props

    return {
      ...attrs,
      ...rest,
      class: classNames("schemx-calendar-popup-renderer", props.popupClassName),
      minDate,
      maxDate,
      safeAreaInsetBottom: true,
      teleport: "body",
      title: title.value,
    }
  })

  const modelValue = computed(() => {
    const value = getValue(calendarValue.value)

    return Array.isArray(value) ? value.join(props.separator) : value
  })

  /**
   * 获取值的函数
   *
   * 支持 String, Array, Date 三种类型。
   */
  const getValue = (value: CalendarValue | null | undefined): string | string[] => {
    if (!value) return ""

    if (Array.isArray(value)) {
      return value.map((i) => dayjs(i).format(props.format))
    } else {
      return dayjs(value).format(props.format)
    }
  }

  const handleConfirm = (date: Date | Date[]): void => {
    if (isReadonly.value || props.disabled) return

    const value = getValue(date as any)

    calendarValue.value = date
    props.onConfirm?.(value)
    props.onChange?.(value)
    showCalendar.value = false
  }

  const handleClick = (): void => {
    if (isReadonly.value || props.disabled) return
    showCalendar.value = true
  }
</script>
