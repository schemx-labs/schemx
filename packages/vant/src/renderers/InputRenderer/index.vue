<template>
  <Wrapper
    :class="['schemx-renderer', 'schemx-input-renderer', props.className]"
    :readonly="props.readonly"
    :disabled="props.disabled"
  >
    <template #readonly>
      {{ getReadonlyDisplayValue(modelValue, props.readonlyPlaceholder) }}
    </template>
    <SchemxInput
      ref="inputRef"
      v-bind="inputProps"
      v-model:value="inputValue"
      :align="contentAlign"
    >
      <template v-if="$slots['left-icon']" #left-icon>
        <slot name="left-icon" />
      </template>
      <template v-if="$slots['right-icon']" #right-icon>
        <slot name="right-icon" />
      </template>
      <template v-if="$slots.button" #button>
        <slot name="button" />
      </template>
      <template v-if="$slots.extra" #extra>
        <slot name="extra" />
      </template>
    </SchemxInput>
  </Wrapper>
</template>

<script setup lang="ts">
  import { computed, ref } from "vue"

  import { Wrapper } from "@schemx/vue"

  import SchemxInput from "@/components/Input"
  import { getFieldProps, getReadonlyDisplayValue } from "@/utils"

  import type { InputRendererProps, InputValue } from "./types"

  defineOptions({
    name: "InputRendererComponent",
    inheritAttrs: false,
  })

  const props = withDefaults(defineProps<InputRendererProps>(), {
    value: "",
    onChange: undefined,
    onBlur: undefined,
    onFocus: undefined,
    type: "text",
    placeholder: "",
    disabled: false,
    readonly: false,
    autofocus: false,
    maxlength: undefined,
    min: undefined,
    max: undefined,
    rows: undefined,
    autosize: false,
    formatter: undefined,
    formatTrigger: "onChange",
    clearable: false,
    clearIcon: "clear",
    clearTrigger: "focus",
    leftIcon: "",
    rightIcon: "",
    showWordLimit: false,
    autocomplete: undefined,
    autocapitalize: undefined,
    autocorrect: undefined,
    enterkeyhint: undefined,
    spellcheck: null,
    inputmode: undefined,
    align: "left",
    className: "",
    readonlyPlaceholder: "-",
  })

  const inputValue = defineModel<InputValue>("value")

  const inputRef = ref<InstanceType<typeof SchemxInput> | null>(null)

  const modelValue = computed(() => String(inputValue.value ?? props.value ?? ""))

  const contentAlign = computed(
    () =>
      getFieldProps(props?.formItemProps, "contentAlign", "right") ??
      getFieldProps(props, "align", "right")
  ) as any

  const inputProps = computed(() => {
    const rendererProps = props as typeof props & { formInstance?: unknown }

    const {
      value: _value,
      className: _className,
      formItemProps: _formItemProps,
      formInstance: _formInstance,
      ...rest
    } = rendererProps

    return rest
  })

  defineExpose({
    focus: () => inputRef.value?.focus?.(),
    blur: () => inputRef.value?.blur?.(),
  })
</script>
