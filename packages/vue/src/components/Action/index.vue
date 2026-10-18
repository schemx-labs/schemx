<script lang="ts" setup generic="TValues extends Values = Values">
  import { computed, useSlots } from "vue"

  import Button from "../Button"
  import Col from "../Col"

  import type {
    SchemxColConfig,
    SchemxFormActionConfig,
    SchemxFormProps,
  } from "../../types/index"
  import type { SchemxInstance, Values } from "@schemx/core"

  /**
   * 操作区复用表单的按钮与展示配置，并接收当前表单实例。
   * @typeParam TValues - 当前表单值类型。
   */
  interface ActionProps<TValues extends Values> extends Pick<
    SchemxFormProps<TValues>,
    "actionCol" | "loading" | "submitter" | "resetter"
  > {
    /**
     * 提交、重置及操作插槽使用的当前表单实例。
     */
    form: SchemxInstance<TValues>
  }

  defineOptions({ name: "SchemxAction" })

  // 操作配置的默认值由表单入口统一提供。
  const props = defineProps<ActionProps<TValues>>()

  // 插槽存在时替换对应的内置按钮。
  const slots = useSlots()

  // 操作区只读取布局属性，在组件边界擦除业务值泛型。
  const resolvedActionColConfig = computed(() => {
    return props.actionCol as SchemxColConfig | undefined
  })

  /**
   * 组件未受控时直接跟随 Core 提交状态；受控值仅覆盖操作区展示。
   */
  const effectiveLoading = computed(() => props.loading ?? props.form.isLoading())

  /**
   * 归一化启用状态下的操作配置。
   *
   * @param action - 布尔开关或操作按钮配置。
   * @returns 可直接用于渲染按钮的配置对象。
   */
  const normalizeActionConfig = (
    action: SchemxFormProps<TValues>["submitter"]
  ): SchemxFormActionConfig => (action === true ? {} : action || {})

  /**
   * 提交操作的归一化配置。
   */
  const submitterConfig = computed(() => normalizeActionConfig(props.submitter))

  /**
   * 重置操作的归一化配置。
   */
  const resetterConfig = computed(() => normalizeActionConfig(props.resetter))

  /**
   * 操作区管理原生按钮行为和点击事件，外观 type 保留给 UI 实现。
   *
   * @param config - 当前操作按钮的配置。
   * @returns 过滤内部事件和原生行为后的按钮属性。
   */
  const getButtonProps = (config: SchemxFormActionConfig) => {
    const buttonProps = Object.fromEntries(
      Object.entries(config.buttonProps ?? {}).filter(
        ([name]) => name !== "nativeType" && name !== "native-type" && name !== "onClick"
      )
    )

    return buttonProps
  }

  /**
   * 提交按钮可安全透传的原生属性。
   */
  const submitterButtonProps = computed(() => getButtonProps(submitterConfig.value))

  /**
   * 重置按钮可安全透传的原生属性。
   */
  const resetterButtonProps = computed(() => getButtonProps(resetterConfig.value))

  /**
   * 仅配置或提供对应插槽时展示提交操作。
   */
  const isSubmitterVisible = computed(
    () => props.submitter !== false && (props.submitter !== undefined || slots.submitter)
  )

  /**
   * 仅配置或提供对应插槽时展示重置操作。
   */
  const isResetterVisible = computed(
    () => props.resetter !== false && (props.resetter !== undefined || slots.resetter)
  )

  /**
   * 操作区的整体显示状态。
   */
  const isActionsVisible = computed(
    () => isSubmitterVisible.value || isResetterVisible.value
  )

  /**
   * 提交按钮在 loading 或显式 disabled 时不可点击。
   */
  const isSubmitterDisabled = computed(
    () => effectiveLoading.value || Boolean(submitterButtonProps.value.disabled)
  )

  /**
   * 重置按钮在 loading 或显式 disabled 时不可点击。
   */
  const isResetterDisabled = computed(
    () => effectiveLoading.value || Boolean(resetterButtonProps.value.disabled)
  )

  /**
   * 响应提交按钮点击，并返回 Core Promise 以让 Vue 处理异常。
   */
  const handleSubmit: SchemxInstance<TValues>["submit"] = () => props.form.submit()

  /**
   * 响应重置按钮点击。
   */
  const handleReset = (): void => {
    props.form.reset()
  }
</script>

<template>
  <Col v-if="isActionsVisible" :col="resolvedActionColConfig">
    <div class="schemx-actions">
      <slot
        v-if="isResetterVisible && slots.resetter"
        name="resetter"
        :form="props.form"
        :loading="effectiveLoading"
        :disabled="isResetterDisabled"
        :reset="handleReset"
      />
      <Button
        v-else-if="isResetterVisible"
        v-bind="resetterButtonProps"
        class="schemx-actions-button schemx-actions-button--reset"
        native-type="button"
        :disabled="isResetterDisabled"
        @click="handleReset"
      >
        {{ resetterConfig.text ?? "重置" }}
      </Button>
      <slot
        v-if="isSubmitterVisible && slots.submitter"
        name="submitter"
        :form="props.form"
        :loading="effectiveLoading"
        :disabled="isSubmitterDisabled"
        :submit="handleSubmit"
      />
      <Button
        v-else-if="isSubmitterVisible"
        v-bind="submitterButtonProps"
        class="schemx-actions-button schemx-actions-button--submit"
        native-type="button"
        :loading="effectiveLoading"
        :disabled="isSubmitterDisabled"
        @click="handleSubmit"
      >
        {{ submitterConfig.text ?? "提交" }}
      </Button>
    </div>
  </Col>
</template>
