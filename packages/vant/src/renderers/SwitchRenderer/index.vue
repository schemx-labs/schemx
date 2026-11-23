<template>
  <div
    :class="['schemx-renderer', 'schemx-switch-renderer', props.className]"
    :style="{ justifyContent: contentAlign }"
  >
    <SchemxCell
      v-if="props.readonly"
      :value="fieldValue"
      :placeholder="props.placeholder"
      :readonly-placeholder="props.readonlyPlaceholder"
      :readonly="props.readonly"
      :disabled="props.disabled"
    />
    <Switch
      v-else
      size="22px"
      v-bind="attrs"
      :model-value="switchValue"
      :loading="switchLoading"
      :disabled="disabled"
      @update:model-value="handleChange"
    />
  </div>
</template>

<script setup lang="ts">
  /**
   * 开关渲染器组件
   *
   * 基于 Vant Switch 封装，支持自定义开关状态文本、
   * 异步值更新、只读/禁用状态继承等能力。
   *
   * @module renderers/SwitchRenderer
   */
  import { computed, ref, useAttrs } from "vue"

  import { Switch } from "vant"

  import SchemxCell from "@/components/Cell/index.vue"
  import { getFieldProps } from "@/utils"

  import type { SwitchRendererProps, SwitchValue } from "./types"

  import "./index.scss"

  defineOptions({
    name: "SwitchRendererComponent",
    inheritAttrs: false,
  })

  const props = withDefaults(defineProps<SwitchRendererProps>(), {
    value: false,
    onChange: () => {},
    className: "",
    activeText: undefined,
    activeValue: true,
    inactiveValue: false,
    inactiveText: undefined,
    readonly: false,
    readonlyPlaceholder: "-",
    disabled: false,
  })

  const attrs = useAttrs()

  const switchValue = defineModel<SwitchValue>("value")

  const switchLoading = ref(false)

  const contentAlign = computed(
    () =>
      getFieldProps(attrs as Record<string, any>, "align", "right") as
        | "left"
        | "center"
        | "right"
  )

  const fieldValue = computed(() => {
    return (switchValue.value ?? props.value) === props.activeValue
      ? props.activeText
      : props.inactiveText
  })

  /**
   * 处理开关值变化
   */
  const handleChange = async (value: SwitchValue): Promise<void> => {
    if (props.readonly || props.disabled) return

    try {
      switchLoading.value = true

      const nextValue = await props.onChange?.(value)

      switchValue.value = nextValue ?? value

      switchLoading.value = false
    } catch (error) {
      switchLoading.value = false
    }
  }
</script>
