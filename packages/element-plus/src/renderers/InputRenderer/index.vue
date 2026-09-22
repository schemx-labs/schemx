<template>
  <Wrapper
    :class="['schemx-renderer', 'schemx-input-renderer', props.className]"
    :readonly="props.readonly"
    :disabled="props.disabled"
  >
    <template #readonly>
      {{ getReadonlyDisplayValue(currentValue, props.readonlyPlaceholder) }}
    </template>
    <ElInput
      ref="inputRef"
      v-bind="inputProps"
      :model-value="currentValue"
      @update:model-value="handleUpdate"
      @blur="handleBlur"
      @focus="handleFocus"
      @clear="handleClear"
    >
      <template v-if="$slots.prefix" #prefix>
        <slot name="prefix" />
      </template>
      <template v-if="$slots.suffix" #suffix>
        <slot name="suffix" />
      </template>
      <template v-if="$slots.prepend" #prepend>
        <slot name="prepend" />
      </template>
      <template v-if="$slots.append" #append>
        <slot name="append" />
      </template>
      <template v-if="$slots['password-icon']" #password-icon="slotProps">
        <slot name="password-icon" v-bind="slotProps" />
      </template>
    </ElInput>
  </Wrapper>
</template>

<script setup lang="ts">
  /** 使用 Element Plus ElInput 渲染输入字段。 */
  import { computed, ref, useAttrs } from "vue"

  import { Wrapper } from "@schemx/vue"
  import { ElInput } from "element-plus"

  import { getElementProps } from "@/renderers/shared/props"
  import { getReadonlyDisplayValue } from "@/utils"

  import type { InputRendererProps, InputValue } from "./types"
  import type { InputInstance } from "element-plus"

  defineOptions({
    name: "InputRendererComponent",
    inheritAttrs: false,
  })

  const props = withDefaults(defineProps<InputRendererProps>(), {
    value: "",
    readonly: false,
    disabled: false,
    placeholder: "",
    readonlyPlaceholder: "-",
    className: "",
  })

  const attrs = useAttrs() as Record<string, unknown>

  const valueModel = defineModel<InputValue>("value")

  const currentValue = computed(() => valueModel.value ?? props.value ?? "")

  const inputRef = ref<InputInstance>()

  const inputProps = computed(() =>
    getElementProps(props, attrs, ["onBlur", "onFocus", "onClear"])
  )

  /** 同步输入值。 */
  const handleUpdate = (value: string | number | null | undefined): void => {
    const nextValue = String(value ?? "")

    valueModel.value = nextValue
    props.onChange?.(nextValue)
  }

  /** 转发输入框失焦事件。 */
  const handleBlur = (event: FocusEvent): void => {
    props.onBlur?.(event)
  }

  /** 转发输入框聚焦事件。 */
  const handleFocus = (event: FocusEvent): void => {
    props.onFocus?.(event)
  }

  /** 处理清空操作并同步空字符串。 */
  const handleClear = (): void => {
    valueModel.value = ""
    props.onChange?.("")
  }

  defineExpose({
    /** 聚焦内部输入框。 */
    focus: () => inputRef.value?.focus(),
    /** 使内部输入框失焦。 */
    blur: () => inputRef.value?.blur(),
  })
</script>

<style>
  .schemx-renderer {
    box-sizing: border-box;
    width: 100%;
  }
</style>
