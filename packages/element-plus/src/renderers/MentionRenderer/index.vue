<template>
  <Wrapper
    :class="['schemx-renderer', 'schemx-mention-renderer', props.className]"
    :readonly="props.readonly"
    :disabled="props.disabled"
  >
    <template #readonly>
      {{ getReadonlyDisplayValue(currentValue, props.readonlyPlaceholder) }}
    </template>
    <ElMention
      ref="mentionRef"
      v-bind="mentionProps"
      :model-value="currentValue"
      @update:model-value="handleUpdate"
      @search="handleSearch"
      @select="handleSelect"
      @whole-remove="handleWholeRemove"
      @blur="handleBlur"
      @focus="handleFocus"
    >
      <template v-if="$slots.prepend" #prepend>
        <slot name="prepend" />
      </template>
      <template v-if="$slots.prefix" #prefix>
        <slot name="prefix" />
      </template>
      <template v-if="$slots.suffix" #suffix>
        <slot name="suffix" />
      </template>
      <template v-if="$slots.append" #append>
        <slot name="append" />
      </template>
      <template v-if="$slots['password-icon']" #password-icon="slotProps">
        <slot name="password-icon" v-bind="slotProps" />
      </template>
      <template v-if="$slots.header" #header>
        <slot name="header" />
      </template>
      <template v-if="$slots.footer" #footer>
        <slot name="footer" />
      </template>
      <template v-if="$slots.loading" #loading>
        <slot name="loading" />
      </template>
      <template v-if="$slots.label" #label="slotProps">
        <slot name="label" v-bind="slotProps" />
      </template>
    </ElMention>
  </Wrapper>
</template>

<script setup lang="ts">
  /** 使用 Element Plus ElMention 渲染提及字段。 */
  import { computed, ref, useAttrs } from "vue"

  import { Wrapper } from "@schemx/vue"
  import { ElMention } from "element-plus"

  import { getElementProps } from "@/renderers/shared/props"
  import { getReadonlyDisplayValue } from "@/utils"

  import type { MentionOptionItem, MentionRendererProps, MentionValue } from "./types"
  import type { MentionInstance } from "element-plus"

  defineOptions({
    name: "MentionRendererComponent",
    inheritAttrs: false,
  })

  const props = withDefaults(defineProps<MentionRendererProps>(), {
    value: "",
    readonly: false,
    disabled: false,
    readonlyPlaceholder: "-",
    className: "",
    options: () => [],
  })

  const attrs = useAttrs() as Record<string, unknown>

  const valueModel = defineModel<MentionValue>("value")

  const mentionRef = ref<MentionInstance>()

  const currentValue = computed(() => valueModel.value ?? props.value ?? "")

  const mentionProps = computed(() =>
    getElementProps(props, attrs, [
      "onSearch",
      "onSelect",
      "onWholeRemove",
      "onBlur",
      "onFocus",
    ])
  )

  /** 同步提及文本。 */
  const handleUpdate = (value: string): void => {
    if (props.readonly || props.disabled) return

    valueModel.value = value
    props.onChange?.(value)
  }

  /** 处理提及搜索。 */
  const handleSearch = (pattern: string, prefix: string): void => {
    props.onSearch?.(pattern, prefix)
  }

  /** 处理提及选项选择。 */
  const handleSelect = (option: MentionOptionItem, prefix: string): void => {
    props.onSelect?.(option, prefix)
  }

  /** 处理整体删除提及文本。 */
  const handleWholeRemove = (pattern: string, prefix: string): void => {
    props.onWholeRemove?.(pattern, prefix)
  }

  /** 处理提及输入框失焦。 */
  const handleBlur = (event: FocusEvent): void => {
    props.onBlur?.(event)
  }

  /** 处理提及输入框聚焦。 */
  const handleFocus = (event: FocusEvent): void => {
    props.onFocus?.(event)
  }

  defineExpose({
    /** 聚焦内部提及输入框。 */
    focus: () => mentionRef.value?.input?.focus(),
    /** 使内部提及输入框失焦。 */
    blur: () => mentionRef.value?.input?.blur(),
  })
</script>

<style>
  .schemx-renderer {
    box-sizing: border-box;
    width: 100%;
  }
</style>
