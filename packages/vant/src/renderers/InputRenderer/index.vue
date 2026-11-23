<template>
  <div :class="['schemx-renderer', 'schemx-input-renderer', props.className]">
    <SchemxCell
      v-if="props.readonly"
      :value="modelValue"
      :placeholder="placeholder"
      :readonly-placeholder="props.readonlyPlaceholder"
      :readonly="props.readonly"
      :disabled="props.disabled"
    />
    <SchemxInput v-else ref="inputRef" v-bind="inputProps" v-model:value="inputValue">
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
  </div>
</template>

<script setup lang="ts">
  import { computed, ref } from "vue"

  import SchemxCell from "@/components/Cell/index.vue"
  import SchemxInput from "@/components/Input"

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

  const placeholder = computed(() => props.placeholder || "请选择")

  const inputProps = computed(() => {
    const { value: _value, ...rest } = props

    return rest
  })

  defineExpose({
    focus: () => inputRef.value?.focus?.(),
    blur: () => inputRef.value?.blur?.(),
  })
</script>
