<template>
  <div
    :class="
      classNames('schemx-renderer', 'schemx-text-renderer', props.className, {
        'schemx-renderer-readonly': readonly,
        'schemx-renderer-disabled': disabled,
      })
    "
  >
    <SchemxCell
      v-if="props.readonly"
      :value="textValue"
      :placeholder="placeholder"
      :readonly-placeholder="props.readonlyPlaceholder"
      :readonly="props.readonly"
      :disabled="props.disabled"
    />
    <SchemxInput
      v-else
      ref="inputRef"
      v-model:value="textValue"
      :type="inputType"
      :placeholder="props.placeholder"
      :readonly-placeholder="props.readonlyPlaceholder"
      :readonly="props.readonly"
      :disabled="props.disabled"
      :align="props.align"
      :maxlength="props.maxlength"
      :min="props.min"
      :max="props.max"
      :formatter="props.formatter"
      :format-trigger="props.formatTrigger"
      :autocomplete="props.autocomplete"
      :autofocus="props.autofocus"
      :clearable="props.clearable"
      :clear-icon="props.clearIcon"
      :clear-trigger="props.clearTrigger"
      :left-icon="props.leftIcon"
      :right-icon="isPasswordMode || props.readonly ? '' : props.rightIcon"
      :show-word-limit="props.showWordLimit && !props.readonly && !props.disabled"
      @change="props.onChange"
      @blur="props.onBlur"
      @focus="props.onFocus"
    >
      <template v-if="slots['left-icon']" #left-icon>
        <slot name="left-icon" />
      </template>

      <template #right-icon>
        <Icon
          v-if="isPasswordMode && !props.readonly"
          :name="passwordIcon"
          class="schemx-text-renderer__password-icon"
          @click="handleTogglePassword"
        />
        <slot v-else-if="slots['right-icon']" name="right-icon" />
      </template>

      <template v-if="slots.button" #button>
        <slot name="button" />
      </template>
      <template v-if="slots.extra" #extra>
        <slot name="extra" />
      </template>
    </SchemxInput>
  </div>
</template>

<script setup lang="ts">
  /**
   * 文本输入渲染器组件
   *
   * 基于 InputRenderer 实现，支持密码可见性切换。
   *
   * @module renderers/TextRenderer
   */
  import { computed, ref, useSlots } from "vue"

  import { Icon } from "vant"

  import classNames from "classnames"

  import SchemxCell from "@/components/Cell/index.vue"
  import SchemxInput from "@/components/Input"

  import type { TextRendererProps } from "./types"

  import "./index.scss"

  defineOptions({
    name: "TextRendererComponent",
    inheritAttrs: false,
  })

  const props = withDefaults(defineProps<TextRendererProps>(), {
    className: "",
    placeholder: undefined,
    readonlyPlaceholder: "-",
    readonly: false,
    disabled: false,
    value: "",
    align: "right",
    clearable: false,
    clearIcon: "clear",
    clearTrigger: "focus",
    leftIcon: "",
    rightIcon: "",
    showWordLimit: false,
  })

  const textValue = defineModel<string>("value")

  const slots = useSlots()

  const inputRef = ref<InstanceType<typeof SchemxInput> | null>(null)
  const passwordVisible = ref(false)

  /** 判断是否为密码模式 */
  const isPasswordMode = computed(() => props.type === "password")

  /** 计算实际的输入类型 */
  const inputType = computed(() => {
    if (isPasswordMode.value) {
      return passwordVisible.value ? "text" : "password"
    }

    return props.type || "text"
  })

  /** 密码可见性图标 */
  const passwordIcon = computed(() => {
    return passwordVisible.value ? "eye-o" : "closed-eye"
  })

  /** 切换密码可见性 */
  const handleTogglePassword = (): void => {
    passwordVisible.value = !passwordVisible.value
  }

  defineExpose({
    focus: () => inputRef.value?.focus?.(),
    blur: () => inputRef.value?.blur?.(),
  })
</script>
