<!--
  schemx - 主组件

  基于 Schema 配置的表单组件，使用 useForm Hook 管理状态。

  @module schemx
-->

<script lang="ts" setup generic="TValues extends Values = Values">
  import { computed, useSlots } from "vue"

  import Button from "./components/Button"
  import Col from "./components/Col"
  import Row from "./components/Row"
  import SchemaList from "./components/SchemaList"
  import { useViewSchemas } from "./hooks"
  import { useFormComponent } from "./hooks/useFormComponent"
  import { useScrollToField } from "./hooks/useScrollToField"
  import { getSectionPosition } from "./utils/helpers"

  import type {
    SchemxColConfig,
    SchemxFormActionConfig,
    SchemxFormProps,
    SchemxRowConfig,
  } from "./types/index"
  import type { SchemxInstance, SchemxViewSchema, Values } from "@schemx/core"

  import "./styles/index.css"

  defineOptions({ name: "SchemxForm" })

  /**
   * 规范化表单组件的公开输入，并为未提供的可选项补充默认值。
   *
   * 具体字段语义由 `SchemxFormProps<TValues>` 定义；其中 `modelValue`、
   * `schemas` 和 `form` 共同决定表单数据与实例来源。
   */
  const props = withDefaults(defineProps<SchemxFormProps<TValues>>(), {
    modelValue: () => ({}) as TValues,
    initialValues: () => ({}) as TValues,
    form: undefined,
    schemas: () => [],
    class: "",
    style: () => ({}),
    onFinish: undefined,
    onFinishFailed: undefined,
    onReset: undefined,
    onLoadingChange: undefined,
    onValuesChange: undefined,
    onFieldsChange: undefined,
    loading: undefined,
    actionCol: undefined,
    submitter: true,
    resetter: true,
    rendererProps: undefined,
    rendererRegistry: undefined,
    presetRuleRegistry: undefined,
    fieldRules: undefined,
    debug: undefined,
    schedulerOptions: undefined,
    validationConcurrency: undefined,
    visible: undefined,
    validationTrigger: undefined,
    readonly: undefined,
    required: undefined,
    disabled: undefined,
    colon: undefined,
    showRequiredMark: undefined,
    bordered: undefined,
    col: undefined,
    colComponent: undefined,
    iconComponent: undefined,
    row: undefined,
    rowComponent: undefined,
  })

  /**
   * 定义表单 v-model 的同步事件。
   *
   * 仅在内部表单值变化且不是外部 `modelValue` 同步窗口时发出更新。
   */
  const emit = defineEmits<{
    "update:modelValue": [value: TValues]
  }>()

  /**
   * 读取组件保留操作区插槽，并据此决定是否渲染默认操作区。
   */
  const slots = useSlots()

  const { form: formInstance, config: effectiveConfig } = useFormComponent<TValues>(
    props,
    (values) => emit("update:modelValue", values)
  )

  const resolvedRowConfig = computed(
    () => effectiveConfig.value.schemaConfig?.row as SchemxRowConfig | undefined
  )

  // 操作区只读取布局属性，在组件边界擦除业务值泛型。
  const resolvedActionColConfig = computed(
    () => props.actionCol as SchemxColConfig | undefined
  )

  /**
   * 组件未受控时直接跟随 Core 提交状态；受控值仅覆盖操作区展示。
   */
  const effectiveLoading = computed(() => props.loading ?? formInstance.isLoading())

  /**
   * Form 根节点的 class 来源：组件内部标识与调用方自定义 class。
   */
  const formRootClass = computed(() => ["schemx", props.class])

  /**
   * Form 根节点的 style 来源；保留 Vue StyleValue 的对象/数组合并能力。
   */
  const formRootStyle = computed(() => props.style)

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
   * 操作区必须保护内部事件和 button type，不接受运行时透传的同名属性。
   *
   * @param config - 当前操作按钮的配置。
   * @returns 过滤内部事件和 type 后的按钮属性。
   */
  const getButtonProps = (config: SchemxFormActionConfig) => {
    const buttonProps = Object.fromEntries(
      Object.entries(config.buttonProps ?? {}).filter(
        ([name]) => name !== "type" && name !== "onClick"
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
   * 操作区保留插槽不能下传给字段，避免与同名字段插槽冲突。
   */
  const fieldSlots = computed(() =>
    Object.fromEntries(
      Object.entries(slots).filter(
        ([slotName]) => slotName !== "submitter" && slotName !== "resetter"
      )
    )
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
  const handleSubmit: SchemxInstance<TValues>["submit"] = () => formInstance.submit()

  /**
   * 响应重置按钮点击。
   */
  const handleReset = (): void => {
    formInstance.reset()
  }

  // 当前 Form 的响应式 ViewSchema 列表。
  const viewSchemas = useViewSchemas(formInstance)

  useScrollToField({ form: formInstance, viewSchemas })

  /**
   * 根据 ViewSchema 在当前列表中的位置生成首尾样式类。
   *
   * @param schema - 当前需要计算样式的 ViewSchema。
   * @returns 用于包裹元素的首尾位置 class 映射。
   */
  const getFieldClass = (schema: SchemxViewSchema) => {
    const { isFirst, isLast } = getSectionPosition(
      viewSchemas.value as SchemxViewSchema[],
      schema.key
    )

    return {
      "schemx-field-wrapper--first": isFirst,
      "schemx-field-wrapper--last": isLast,
    }
  }

  /**
   * 暴露当前表单 Instance 的完整控制 API，供模板 ref 调用。
   */
  const exposed: SchemxInstance<TValues> = {
    ...formInstance,
    submit: handleSubmit,
    reset: handleReset,
  }

  defineExpose(exposed)
</script>

<template>
  <div :class="formRootClass" :style="formRootStyle">
    <Row :row="resolvedRowConfig" class="schemx-schema-list">
      <SchemaList
        :schemas="viewSchemas as SchemxViewSchema[]"
        :view-schemas="viewSchemas as SchemxViewSchema[]"
        :row-enabled="false"
        :row-config="resolvedRowConfig"
        :field-class-resolver="getFieldClass"
      >
        <template v-for="(_, slotName) in fieldSlots" #[slotName]="slotProps">
          <slot :name="slotName" v-bind="slotProps ?? {}" />
        </template>
      </SchemaList>

      <Col v-if="isActionsVisible" :col="resolvedActionColConfig">
        <div class="schemx-actions">
          <slot
            v-if="isResetterVisible && slots.resetter"
            name="resetter"
            :form="formInstance"
            :loading="effectiveLoading"
            :disabled="isResetterDisabled"
            :reset="handleReset"
          />
          <Button
            v-else-if="isResetterVisible"
            v-bind="resetterButtonProps"
            class="schemx-actions-button schemx-actions-button--reset"
            type="button"
            :disabled="isResetterDisabled"
            @click="handleReset"
          >
            {{ resetterConfig.text ?? "重置" }}
          </Button>
          <slot
            v-if="isSubmitterVisible && slots.submitter"
            name="submitter"
            :form="formInstance"
            :loading="effectiveLoading"
            :disabled="isSubmitterDisabled"
            :submit="handleSubmit"
          />
          <Button
            v-else-if="isSubmitterVisible"
            v-bind="submitterButtonProps"
            class="schemx-actions-button schemx-actions-button--submit"
            type="button"
            :loading="effectiveLoading"
            :disabled="isSubmitterDisabled"
            @click="handleSubmit"
          >
            {{ submitterConfig.text ?? "提交" }}
          </Button>
        </div>
      </Col>
    </Row>
  </div>
</template>
