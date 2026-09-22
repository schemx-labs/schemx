<template>
  <Wrapper
    :class="['schemx-renderer', 'schemx-input-otp-renderer', props.className]"
    :readonly="props.readonly"
    :disabled="props.disabled"
  >
    <template #readonly>
      {{ getReadonlyDisplayValue(currentValue, props.readonlyPlaceholder) }}
    </template>
    <ElInputOtp
      v-bind="inputOtpProps"
      :model-value="currentValue"
      @update:model-value="handleUpdate"
      @finish="handleFinish"
      @blur="handleBlur"
      @focus="handleFocus"
    >
      <template v-if="$slots.separator" #separator="slotProps">
        <slot name="separator" v-bind="slotProps" />
      </template>
    </ElInputOtp>
  </Wrapper>
</template>

<script setup lang="ts">
  /** 使用 Element Plus ElInputOtp 渲染一次性密码字段。 */
  import { computed, useAttrs } from "vue"

  import { Wrapper } from "@schemx/vue"
  import { ElInputOtp } from "element-plus"

  import { getElementProps } from "@/renderers/shared/props"
  import { getReadonlyDisplayValue } from "@/utils"

  import type { InputOtpRendererProps, InputOtpValue } from "./types"

  defineOptions({
    name: "InputOtpRendererComponent",
    inheritAttrs: false,
  })

  const props = withDefaults(defineProps<InputOtpRendererProps>(), {
    value: "",
    readonly: false,
    disabled: false,
    readonlyPlaceholder: "-",
    className: "",
  })

  const attrs = useAttrs() as Record<string, unknown>

  const valueModel = defineModel<InputOtpValue>("value")

  const currentValue = computed(() => valueModel.value ?? props.value ?? "")

  const inputOtpProps = computed(() =>
    getElementProps(props, attrs, ["onFinish", "onBlur", "onFocus"])
  )

  /** 同步一次性密码值。 */
  const handleUpdate = (value: string): void => {
    if (props.readonly || props.disabled) return

    valueModel.value = value
    props.onChange?.(value)
  }

  /** 处理一次性密码输入完成。 */
  const handleFinish = (value: string): void => {
    props.onFinish?.(value)
  }

  /** 处理一次性密码输入框失焦。 */
  const handleBlur = (event: FocusEvent): void => {
    props.onBlur?.(event)
  }

  /** 处理一次性密码输入框聚焦。 */
  const handleFocus = (event: FocusEvent): void => {
    props.onFocus?.(event)
  }
</script>

<style>
  .schemx-renderer {
    box-sizing: border-box;
    width: 100%;
  }
</style>
