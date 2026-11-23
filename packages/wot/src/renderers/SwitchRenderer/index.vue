<template>
  <div
    v-if="readonly"
    class="schemx-switch-renderer"
    :class="className"
    :style="{ justifyContent: align }"
  >
    {{ fieldValue }}
  </div>
  <div
    v-else
    class="schemx-renderer schemx-switch-renderer"
    :class="[
      className,
      {
        'schemx-renderer-readonly': readonly,
        'schemx-renderer-disabled': disabled,
      },
    ]"
    :style="{ justifyContent: align }"
  >
    <WdSwitch
      v-bind="switchProps"
      size="22px"
      :model-value="displayValue"
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
   * 基于 Wot UI Switch 封装，支持自定义开关状态文本、
   * 异步值更新、只读/禁用状态继承等能力。
   *
   * @module renderers/SwitchRenderer
   */
  import { computed, ref, useAttrs } from "vue"

  import WdSwitch from "@wot-ui/ui/components/wd-switch/wd-switch.vue"

  import { getFieldProps } from "../../utils"

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
    disabled: false,
  })

  const attrs = useAttrs()

  const switchValue = defineModel<SwitchValue>("value")

  const switchLoading = ref(false)

  const displayValue = computed<SwitchValue>(() => switchValue.value ?? props.value ?? false)

  // 剔除 Schemx 契约字段，避免内部事件和表单元信息透传给 Wot 组件。
  const switchProps = computed(() => {
    const {
      value: _value,
      onChange: _onChange,
      className: _className,
      formItemProps: _formItemProps,
      ...rest
    } = props

    return { ...attrs, ...rest }
  })

  const disabled = computed(() => props.disabled)
  const readonly = computed(() => props.readonly)
  const align = computed(
    () => getFieldProps(attrs as Record<string, any>, "align", "right") as
      | "left"
      | "center"
      | "right"
  )

  const fieldValue = computed(() => {
    return switchValue.value === props.activeValue ? props.activeText : props.inactiveText
  })

  /**
   * 处理开关值变化
   */
  const handleChange = async (value: SwitchValue): Promise<void> => {
    if (readonly.value || disabled.value) return

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
