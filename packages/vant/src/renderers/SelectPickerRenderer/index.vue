<template>
  <Wrapper
    :class="['schemx-renderer', 'schemx-select-picker-renderer', props.className]"
    :readonly="isReadonly"
    :disabled="props.disabled"
  >
    <template #readonly>
      {{ getReadonlyDisplayValue(fieldValue, props.readonlyPlaceholder) }}
    </template>

    <Cell :clickable="!props.disabled" is-link @click="handleClick">
      <template #value>
        <span :style="`text-align: ${props.contentAlign}`">
          {{ getReadonlyDisplayValue(fieldValue, placeholder) }}
        </span>
      </template>
    </Cell>

    <Popup
      v-if="!isReadonly && !props.disabled"
      v-model:show="showPicker"
      :class="classNames('schemx-select-picker-popup-renderer', props.popupClassName)"
      v-bind="popupProps"
      safe-area-inset-bottom
      @close="handleClose"
    >
      <div class="schemx-select-picker">
        <div class="schemx-select-picker-actions">
          <div class="schemx-select-picker-title">
            {{ props.title || placeholder }}
          </div>
        </div>

        <div class="schemx-select-picker-options">
          <template v-if="columns.length">
            <CheckboxGroup
              v-if="type === 'checkbox'"
              :model-value="checkboxValue"
              @update:model-value="handleCheckboxChange"
            >
              <Checkbox
                v-for="option in columns"
                :key="option[valueName]"
                shape="square"
                :name="option[valueName]"
                :disabled="disabled || option[disabledName]"
                v-bind="getOptionProps(option)"
              >
                {{ option[labelName] }}
              </Checkbox>
            </CheckboxGroup>

            <RadioGroup
              v-else
              :model-value="radioValue"
              @update:model-value="handleRadioChange"
            >
              <Radio
                v-for="option in columns"
                :key="option[valueName]"
                :name="option[valueName]"
                :disabled="disabled || option[disabledName]"
                v-bind="getOptionProps(option)"
              >
                {{ option[labelName] }}
              </Radio>
            </RadioGroup>
          </template>

          <div v-else class="schemx-select-picker-empty">No data</div>
        </div>

        <div class="schemx-select-picker-footer">
          <Button type="primary" block @click="handleConfirm">确认</Button>
        </div>
      </div>
    </Popup>
  </Wrapper>
</template>

<script setup lang="ts">
  /**
   * 弹窗选择渲染器组件
   *
   * 使用 Vant Cell + Popup + Checkbox/Radio 组合实现单选/多选弹窗。
   *
   * @module renderers/SelectPickerRenderer
   */
  import { computed, ref } from "vue"

  import { Button, Cell, Checkbox, CheckboxGroup, Popup, Radio, RadioGroup } from "vant"

  import { Wrapper } from "@schemx/vue"
  import classNames from "classnames"

  import { getReadonlyDisplayValue } from "@/utils"

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
    popupClassName: "",
    readonlyPlaceholder: "-",
    readonly: false,
    disabled: false,
    title: "",
    options: () => [],
    columns: () => [],
    fieldNames: () => ({}),
    type: "checkbox",
  })

  const selectPickerValue = defineModel<SelectPickerValue>("value")

  const pendingValue = ref<SelectPickerValue>()

  const showPicker = ref(false)

  const placeholder = computed(() => props.placeholder || "请选择")

  const type = computed(() => props.type || "checkbox")

  const labelName = computed(() => props.fieldNames?.label || "label")

  const valueName = computed(() => props.fieldNames?.value || "value")

  const disabledName = computed(() => props.fieldNames?.disabled || "disabled")

  const isReadonly = computed(() => props.readonly)

  const popupProps = computed((): SelectPickerRendererProps["popupProps"] => {
    const {
      value: _value,
      onChange: _onChange,
      onBlur: _onBlur,
      onConfirm: _onConfirm,
      className: _className,
      popupClassName: _popupClassName,
      options: _options,
      columns: _columns,
      fieldNames: _fieldNames,
      type: _type,
      readonly: _readonly,
      readonlyPlaceholder: _readonlyPlaceholder,
      disabled: _disabled,
      title: _title,
      contentAlign: _contentAlign,
      popupProps: popupPropsConfig,
      formItemProps: _formItemProps,
      formInstance: _formInstance,
      ..._rest
    } = props

    const { show: _show, ...popupRest } = (popupPropsConfig || {}) as NonNullable<
      SelectPickerRendererProps["popupProps"]
    > & { show?: boolean }

    return {
      round: true,
      position: "bottom" as const,
      safeAreaInsetBottom: true,
      teleport: "body",
      closeable: true,
      closeIconPosition: "top-right",
      ...popupRest,
    }
  })

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

  const activeValue = computed<SelectPickerValue>(() =>
    normalizeValue(pendingValue.value ?? displayValue.value)
  )

  const checkboxValue = computed(() =>
    Array.isArray(activeValue.value) ? activeValue.value : []
  )

  const radioValue = computed(() =>
    Array.isArray(activeValue.value) ? "" : activeValue.value
  )

  const getOption = (value: unknown): SelectPickerOption | undefined => {
    return columns.value.find((option) => option[valueName.value] === value)
  }

  const getOptionProps = (option: SelectPickerOption): SelectPickerOption => {
    const {
      [labelName.value]: _label,
      [valueName.value]: _value,
      [disabledName.value]: _disabled,
      ...rest
    } = option

    return rest
  }

  const getOptionLabel = (value: unknown): string => {
    const option = getOption(value)

    return String(option?.[labelName.value] ?? value ?? "")
  }

  const fieldValue = computed(() => {
    const value = displayValue.value

    if (Array.isArray(value)) {
      return value
        .map((item) => getOptionLabel(item))
        .filter(Boolean)
        .join("、")
    }

    return getOptionLabel(value)
  })

  const selectedItems = computed<SelectPickerOption | SelectPickerOption[]>(() => {
    const value = activeValue.value

    if (Array.isArray(value)) {
      return value.map((item) => getOption(item)).filter(Boolean) as SelectPickerOption[]
    }

    return getOption(value) || {}
  })

  const handleClick = (): void => {
    if (isReadonly.value || props.disabled) return

    pendingValue.value = displayValue.value
    showPicker.value = true
  }

  const handleCheckboxChange = (value: SelectPickerValue): void => {
    pendingValue.value = value
  }

  const handleRadioChange = (value: SelectPickerValue): void => {
    pendingValue.value = value
  }

  const handleClose = (): void => {
    pendingValue.value = undefined
    showPicker.value = false
    props.onBlur?.(activeValue.value)
  }

  const handleConfirm = (): void => {
    if (isReadonly.value || props.disabled) return

    const value = activeValue.value

    const detail: SelectPickerConfirmEventParams = {
      value,
      selectedItems: selectedItems.value,
    }

    selectPickerValue.value = value
    props.onChange(value, detail)
    props.onConfirm(value, detail)
    pendingValue.value = undefined
    showPicker.value = false
  }
</script>
