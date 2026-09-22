<template>
  <Wrapper
    :class="['schemx-renderer', 'schemx-input-tag-renderer', props.className]"
    :readonly="props.readonly"
    :disabled="props.disabled"
  >
    <template #readonly>
      {{ getReadonlyDisplayValue(displayValue, props.readonlyPlaceholder) }}
    </template>
    <ElInputTag
      ref="inputTagRef"
      v-bind="inputTagProps"
      :model-value="currentValue"
      @update:model-value="handleUpdate"
      @add-tag="handleAddTag"
      @remove-tag="handleRemoveTag"
      @clear="handleClear"
      @blur="handleBlur"
      @focus="handleFocus"
    >
      <template v-if="$slots.tag" #tag="slotProps">
        <slot name="tag" v-bind="slotProps" />
      </template>
      <template v-if="$slots.prefix" #prefix>
        <slot name="prefix" />
      </template>
      <template v-if="$slots.suffix" #suffix>
        <slot name="suffix" />
      </template>
    </ElInputTag>
  </Wrapper>
</template>

<script setup lang="ts">
  /** 使用 Element Plus ElInputTag 渲染标签输入字段。 */
  import { computed, ref, useAttrs } from "vue"

  import { Wrapper } from "@schemx/vue"
  import { ElInputTag } from "element-plus"

  import { getElementProps } from "@/renderers/shared/props"
  import { getReadonlyDisplayValue } from "@/utils"

  import type { InputTagRendererProps, InputTagValue } from "./types"
  import type { InputTagInstance } from "element-plus"

  defineOptions({
    name: "InputTagRendererComponent",
    inheritAttrs: false,
  })

  const props = withDefaults(defineProps<InputTagRendererProps>(), {
    value: () => [],
    readonly: false,
    disabled: false,
    readonlyPlaceholder: "-",
    className: "",
  })

  const attrs = useAttrs() as Record<string, unknown>

  const valueModel = defineModel<InputTagValue>("value")

  const inputTagRef = ref<InputTagInstance>()

  const currentValue = computed(() => valueModel.value ?? props.value ?? [])

  const displayValue = computed(() => currentValue.value.join("、"))

  const inputTagProps = computed(() =>
    getElementProps(props, attrs, [
      "onAddTag",
      "onRemoveTag",
      "onClear",
      "onBlur",
      "onFocus",
    ])
  )

  /** 同步标签列表。 */
  const handleUpdate = (value: string[] | undefined): void => {
    if (props.readonly || props.disabled) return

    const nextValue = value ?? []

    valueModel.value = nextValue
    props.onChange?.(nextValue)
  }

  /** 处理新增标签。 */
  const handleAddTag = (value: string | string[]): void => {
    props.onAddTag?.(value)
  }

  /** 处理删除标签。 */
  const handleRemoveTag = (value: string, index: number): void => {
    props.onRemoveTag?.(value, index)
  }

  /** 处理标签清空。 */
  const handleClear = (): void => {
    props.onClear?.()
  }

  /** 处理标签输入框失焦。 */
  const handleBlur = (event: FocusEvent): void => {
    props.onBlur?.(event)
  }

  /** 处理标签输入框聚焦。 */
  const handleFocus = (event: FocusEvent): void => {
    props.onFocus?.(event)
  }

  defineExpose({
    /** 聚焦内部标签输入框。 */
    focus: () => inputTagRef.value?.focus(),
    /** 使内部标签输入框失焦。 */
    blur: () => inputTagRef.value?.blur(),
  })
</script>

<style>
  .schemx-renderer {
    box-sizing: border-box;
    width: 100%;
  }
</style>
