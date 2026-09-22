<template>
  <Wrapper
    :class="['schemx-renderer', 'schemx-switch-renderer', props.className]"
    :readonly="props.readonly"
    :disabled="props.disabled"
  >
    <template #readonly>
      {{ getReadonlyDisplayValue(valueModel, props.readonlyPlaceholder) }}
    </template>
    <ElSwitch
      v-bind="switchProps"
      :model-value="currentValue"
      @update:model-value="handleUpdate"
    />
  </Wrapper>
</template>

<script setup lang="ts">
  /** 使用 Element Plus ElSwitch 渲染开关字段。 */
  import { computed, ref, useAttrs } from "vue"

  import { Wrapper } from "@schemx/vue"
  import { ElSwitch } from "element-plus"

  import { getElementProps } from "@/renderers/shared/props"
  import { getReadonlyDisplayValue } from "@/utils"

  import type { SwitchRendererProps, SwitchValue } from "./types"

  defineOptions({
    name: "SwitchRendererComponent",
    inheritAttrs: false,
  })

  const props = withDefaults(defineProps<SwitchRendererProps>(), {
    value: false,
    activeValue: true,
    inactiveValue: false,
    readonly: false,
    disabled: false,
    readonlyPlaceholder: "-",
    className: "",
  })

  const attrs = useAttrs() as Record<string, unknown>

  const valueModel = defineModel<SwitchValue>("value")

  const switchLoading = ref(false)

  const currentValue = computed(() => valueModel.value ?? props.value ?? false)

  const switchProps = computed(() => ({
    ...getElementProps(props, attrs, ["readonlyPlaceholder"]),
    loading: Boolean(props.loading || switchLoading.value),
  }))

  /**
   * 处理开关状态变化，并等待异步业务回调完成。
   *
   * @param value - Element Plus 产生的开关值。
   */
  const handleUpdate = async (value: SwitchValue): Promise<void> => {
    if (props.readonly || props.disabled || switchLoading.value) return

    switchLoading.value = true

    try {
      const nextValue = await props.onChange?.(value)

      valueModel.value = nextValue ?? value
    } finally {
      switchLoading.value = false
    }
  }
</script>

<style>
  .schemx-renderer {
    box-sizing: border-box;
    width: 100%;
  }
</style>
