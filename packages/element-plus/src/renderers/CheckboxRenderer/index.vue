<template>
  <Wrapper
    :class="['schemx-renderer', 'schemx-checkbox-renderer', props.className]"
    :readonly="props.readonly"
    :disabled="props.disabled"
  >
    <template #readonly>
      {{ getReadonlyDisplayValue(selectedLabels, props.readonlyPlaceholder) }}
    </template>
    <ElCheckboxGroup
      v-bind="checkboxProps"
      :model-value="groupValues"
      @update:model-value="handleUpdate"
    >
      <ElCheckbox
        v-for="option in props.options"
        :key="String(getOptionValue(option))"
        v-bind="getOptionProps(option)"
      >
        {{ getOptionLabel(option) }}
      </ElCheckbox>
    </ElCheckboxGroup>
  </Wrapper>
</template>

<script setup lang="ts">
  /** 使用 Element Plus ElCheckboxGroup 渲染复选字段。 */
  import { computed, useAttrs } from "vue"

  import { Wrapper } from "@schemx/vue"
  import { ElCheckbox, ElCheckboxGroup } from "element-plus"

  import { getElementProps } from "@/renderers/shared/props"
  import { getReadonlyDisplayValue } from "@/utils"

  import type {
    CheckboxOption,
    CheckboxOptionValue,
    CheckboxRendererProps,
    CheckboxValue,
  } from "./types"

  defineOptions({
    name: "CheckboxRendererComponent",
    inheritAttrs: false,
  })

  const props = withDefaults(defineProps<CheckboxRendererProps>(), {
    value: () => [],
    options: () => [],
    readonly: false,
    disabled: false,
    readonlyPlaceholder: "-",
    className: "",
  })

  const attrs = useAttrs() as Record<string, unknown>

  const valueModel = defineModel<CheckboxValue>("value")

  const labelKey = computed(() => props.props?.label ?? "label")

  const valueKey = computed(() => props.props?.value ?? "value")

  const disabledKey = computed(() => props.props?.disabled ?? "disabled")

  const checkboxProps = computed(() => getElementProps(props, attrs))

  const selectedValues = computed(() => valueModel.value ?? props.value ?? [])

  const groupValues = computed(() => selectedValues.value.map(encodeValue))

  const selectedLabels = computed(() =>
    selectedValues.value.map((value) => {
      const option = props.options.find((item) => getOptionValue(item) === value)

      return option ? getOptionLabel(option) : String(value)
    })
  )

  /**
   * 获取选项值。
   *
   * @param option - 当前复选选项。
   * @returns 选项值。
   */
  const getOptionValue = (option: CheckboxOption): CheckboxOptionValue | undefined =>
    option[valueKey.value] as CheckboxOptionValue | undefined

  /** 获取传给单个 Element Plus Checkbox 的完整配置。 */
  const getOptionProps = (option: CheckboxOption): Record<string, unknown> => ({
    ...option,
    label: getOptionLabel(option),
    value: encodeValue(getOptionValue(option)),
    disabled: props.disabled || getOptionDisabled(option),
  })

  /**
   * 将 boolean 选项值编码为 Element Plus CheckboxGroup 支持的值。
   *
   * @param value - Schemx 对外选项值。
   * @returns CheckboxGroup 可接受的字符串或数字值。
   */
  const encodeValue = (value: CheckboxOptionValue | undefined): string | number => {
    if (typeof value === "boolean") return value ? "__schemx_true__" : "__schemx_false__"

    return value ?? ""
  }

  /**
   * 将 Element Plus CheckboxGroup 值还原为 Schemx 选项值。
   *
   * @param value - CheckboxGroup 产生的字符串或数字值。
   * @returns Schemx 对外选项值。
   */
  const decodeValue = (value: string | number): CheckboxOptionValue => {
    if (value === "__schemx_true__") return true
    if (value === "__schemx_false__") return false

    return value
  }

  /**
   * 获取选项显示文本。
   *
   * @param option - 当前复选选项。
   * @returns 选项显示文本。
   */
  const getOptionLabel = (option: CheckboxOption): string =>
    String(option[labelKey.value] ?? getOptionValue(option))

  /**
   * 获取选项禁用状态。
   *
   * @param option - 当前复选选项。
   * @returns 是否禁用。
   */
  const getOptionDisabled = (option: CheckboxOption): boolean =>
    Boolean(option[disabledKey.value])

  /**
   * 同步 Element Plus 复选值。
   *
   * @param value - Element Plus 产生的新值列表。
   */
  const handleUpdate = (value: Array<string | number>): void => {
    if (props.readonly || props.disabled) return

    const nextValue = value.map(decodeValue) as CheckboxValue

    valueModel.value = nextValue
    props.onChange?.(nextValue)
  }
</script>
<style>
  .schemx-renderer {
    box-sizing: border-box;
    width: 100%;
  }

  .schemx-checkbox-renderer > .el-checkbox-group {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 8px;
  }

  .schemx-checkbox-renderer > .el-checkbox-group {
    justify-content: var(--schemx-content-align);
  }
</style>
