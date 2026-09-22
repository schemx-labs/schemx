<template>
  <Wrapper
    :class="['schemx-renderer', 'schemx-autocomplete-renderer', props.className]"
    :readonly="props.readonly"
    :disabled="props.disabled"
  >
    <template #readonly>
      {{ getReadonlyDisplayValue(displayValue, props.readonlyPlaceholder) }}
    </template>
    <ElAutocomplete
      ref="autocompleteRef"
      v-bind="autocompleteProps"
      :model-value="currentValue"
      @update:model-value="handleUpdate"
      @select="handleSelect"
      @blur="handleBlur"
      @focus="handleFocus"
    >
      <template v-if="$slots.default" #default="slotProps">
        <slot name="default" v-bind="slotProps" />
      </template>
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
    </ElAutocomplete>
  </Wrapper>
</template>

<script setup lang="ts">
  /** 使用 Element Plus ElAutocomplete 渲染自动补全字段。 */
  import { computed, ref, useAttrs } from "vue"

  import { Wrapper } from "@schemx/vue"
  import { ElAutocomplete } from "element-plus"

  import {
    getElementOptionLabel,
    normalizeElementOptions,
  } from "@/renderers/shared/options"
  import { getElementProps } from "@/renderers/shared/props"
  import { getReadonlyDisplayValue } from "@/utils"

  import type {
    AutocompleteOption,
    AutocompleteRendererProps,
    AutocompleteSuggestions,
    AutocompleteValue,
  } from "./types"
  import type { AutocompleteInstance } from "element-plus"

  defineOptions({
    name: "AutocompleteRendererComponent",
    inheritAttrs: false,
  })

  const props = withDefaults(defineProps<AutocompleteRendererProps>(), {
    value: "",
    readonly: false,
    disabled: false,
    placeholder: "",
    readonlyPlaceholder: "-",
    className: "",
    options: () => [],
    props: () => ({}),
  })

  const attrs = useAttrs() as Record<string, unknown>

  const valueModel = defineModel<AutocompleteValue>("value")

  const autocompleteRef = ref<AutocompleteInstance>()

  const currentValue = computed(() => valueModel.value ?? props.value ?? "")

  const normalizedOptions = computed(() =>
    normalizeElementOptions(props.options, props.props)
  )

  const displayValue = computed(() => currentValue.value)

  const localFetchSuggestions: AutocompleteSuggestions = (query, callback) => {
    const keyword = String(query).toLowerCase()

    const options = normalizedOptions.value.filter((option) =>
      getElementOptionLabel(option, props.props).toLowerCase().includes(keyword)
    )

    callback(options)
  }

  const fetchSuggestions = computed<AutocompleteSuggestions>(
    () => props.fetchSuggestions ?? localFetchSuggestions
  )

  const autocompleteProps = computed(() => ({
    ...getElementProps(props, attrs, [
      "options",
      "props",
      "onSelect",
      "onBlur",
      "onFocus",
    ]),
    fetchSuggestions: fetchSuggestions.value,
    valueKey: props.valueKey ?? props.props?.label ?? "label",
  }))

  /** 同步自动补全输入值。 */
  const handleUpdate = (value: string | number): void => {
    if (props.readonly || props.disabled) return

    valueModel.value = value
    props.onChange?.(value)
  }

  /** 处理建议项选择。 */
  const handleSelect = (item: AutocompleteOption): void => {
    props.onSelect?.(item)
  }

  /** 处理自动补全输入框失焦。 */
  const handleBlur = (event: FocusEvent): void => {
    props.onBlur?.(event)
  }

  /** 处理自动补全输入框聚焦。 */
  const handleFocus = (event: FocusEvent): void => {
    props.onFocus?.(event)
  }

  defineExpose({
    /** 聚焦内部自动补全输入框。 */
    focus: () => autocompleteRef.value?.focus(),
    /** 使内部自动补全输入框失焦。 */
    blur: () => autocompleteRef.value?.blur(),
  })
</script>

<style>
  .schemx-renderer {
    box-sizing: border-box;
    width: 100%;
  }
</style>
