<template>
  <Wrapper
    :class="['schemx-renderer', 'schemx-radio-renderer', props.className]"
    :readonly="props.readonly"
    :disabled="props.disabled"
  >
    <template #readonly>
      {{ getReadonlyDisplayValue(selectedLabel, props.readonlyPlaceholder) }}
    </template>
    <ElRadioGroup
      v-bind="radioProps"
      :model-value="selectedValue"
      @update:model-value="handleUpdate"
    >
      <ElRadio
        v-for="option in props.options"
        :key="String(getOptionValue(option))"
        v-bind="getOptionProps(option)"
      >
        {{ getOptionLabel(option) }}
      </ElRadio>
    </ElRadioGroup>
  </Wrapper>
</template>

<script setup lang="ts">
  /** 使用 Element Plus ElRadioGroup 渲染单选字段。 */
  import { computed, useAttrs } from "vue"

  import { Wrapper } from "@schemx/vue"
  import { ElRadio, ElRadioGroup } from "element-plus"

  import { getElementProps } from "@/renderers/shared/props"
  import { getReadonlyDisplayValue } from "@/utils"

  import type { RadioOption, RadioRendererProps, RadioValue } from "./types"

  defineOptions({
    name: "RadioRendererComponent",
    inheritAttrs: false,
  })

  const props = withDefaults(defineProps<RadioRendererProps>(), {
    value: undefined,
    options: () => [],
    readonly: false,
    disabled: false,
    readonlyPlaceholder: "-",
    className: "",
  })

  const attrs = useAttrs() as Record<string, unknown>

  const valueModel = defineModel<RadioValue>("value")

  const labelKey = computed(() => props.props?.label ?? "label")

  const valueKey = computed(() => props.props?.value ?? "value")

  const disabledKey = computed(() => props.props?.disabled ?? "disabled")

  const radioProps = computed(() => getElementProps(props, attrs))

  const selectedValue = computed(() => valueModel.value ?? props.value)

  const selectedLabel = computed(() => {
    const option = props.options.find(
      (item) => getOptionValue(item) === selectedValue.value
    )

    return option ? getOptionLabel(option) : selectedValue.value
  })

  /**
   * 获取选项值。
   *
   * @param option - 当前单选选项。
   * @returns 选项值。
   */
  const getOptionValue = (option: RadioOption): RadioValue =>
    option[valueKey.value] as RadioValue

  /** 获取传给单个 Element Plus Radio 的完整配置。 */
  const getOptionProps = (option: RadioOption): Record<string, unknown> => ({
    ...option,
    label: getOptionLabel(option),
    value: getOptionValue(option),
    disabled: props.disabled || getOptionDisabled(option),
  })

  /**
   * 获取选项显示文本。
   *
   * @param option - 当前单选选项。
   * @returns 选项显示文本。
   */
  const getOptionLabel = (option: RadioOption): string =>
    String(option[labelKey.value] ?? getOptionValue(option))

  /**
   * 获取选项禁用状态。
   *
   * @param option - 当前单选选项。
   * @returns 是否禁用。
   */
  const getOptionDisabled = (option: RadioOption): boolean =>
    Boolean(option[disabledKey.value])

  /**
   * 同步 Element Plus 单选值。
   *
   * @param value - Element Plus 产生的新值。
   */
  const handleUpdate = (value: RadioValue | undefined): void => {
    if (value === undefined || props.readonly || props.disabled) return

    valueModel.value = value
    props.onChange?.(value)
  }
</script>
<style>
  .schemx-renderer {
    box-sizing: border-box;
    width: 100%;
  }

  .schemx-radio-renderer > .el-radio-group {
    display: flex;
    flex-wrap: wrap;
    gap: 10px 20px;
  }
  .schemx-radio-renderer > .el-radio-group .el-radio {
    margin-right: 0px;
  }

  .schemx-radio-renderer > .el-radio-group {
    justify-content: var(--schemx-content-align);
  }
</style>
