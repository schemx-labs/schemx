<!--
  schemx - 主组件

  基于 Schema 配置的表单组件，使用 useForm Hook 管理状态。

  @module schemx
-->

<script lang="ts" setup generic="TValues extends Values = Values">
  import { computed, reactive, useSlots, watch } from "vue"

  import { defaultSchemxConfigKeys, isSchemxSchemas } from "@schemx/core"
  import { pick } from "es-toolkit"

  import Button from "./components/Button"
  import FormItem from "./components/FormItem"
  import {
    createFormConfigContext,
    createFormContext,
    useForm,
    useFormSelector,
    useViewSchemas,
  } from "./hooks"
  import { getSectionPosition } from "./utils/helpers"

  import type { SchemxFormActionConfig, SchemxFormProps } from "./types/index"
  import type {
    SchemxInstance,
    SchemxSchemaConfig,
    SchemxViewSchema,
    Values,
  } from "@schemx/core"

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
    submitter: undefined,
    resetter: undefined,
    rendererProps: undefined,
    rendererRegistry: undefined,
    validationRuleRegistry: undefined,
    visible: true,
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

  /**
   * 提取需要同步到 Core 的表单级 schema 配置。
   */
  const pickSchemaConfig = (): Partial<SchemxSchemaConfig> => {
    // Vue 保留 `required` 对当前 TValues 的泛型约束；Core 的表单级配置使用
    // unknown 表示任意字段值。运行时该回调只会接收当前 Form 的字段值，因此在
    // Vue 到 Core 的适配边界收窄为 Core 配置类型。
    return pick(props, defaultSchemxConfigKeys) as Partial<SchemxSchemaConfig>
  }

  /**
   * 保存供后代组件读取的响应式表单级 schema 配置。
   */
  const formSchemaConfig = reactive<Partial<SchemxSchemaConfig>>(pickSchemaConfig())

  /**
   * 创建 FormContext 上下文
   *
   * 为子组件提供表单配置信息。
   */
  createFormConfigContext({ schemaConfig: formSchemaConfig })

  /**
   * 获取或创建表单实例
   *
   * 优先使用外部传入的 form，否则内部通过 useForm 创建。
   * 必须在 setup 同步阶段调用，确保 provide 正确注入。
   */
  const providedForm = props.form
    ? props.form
    : useForm<TValues>({
        schemas: props.schemas,
        schemaConfig: pickSchemaConfig(),
        initialValues:
          Object.keys(props.modelValue).length > 0
            ? props.modelValue
            : props.initialValues,

        rendererProps: props.rendererProps,
        rendererRegistry: props.rendererRegistry,
        defaultRendererType: props.defaultRendererType,
        validationRuleRegistry: props.validationRuleRegistry,
        validatorAdapters: props.validatorAdapters,

        /**
         * 转发提交成功回调。
         *
         * @param values - 提交成功时的完整表单快照。
         */
        onFinish: (values) => props.onFinish?.(values),
        /**
         * 转发提交失败回调。
         *
         * @param errors - 提交失败时的字段错误集合。
         */
        onFinishFailed: (errors) => props.onFinishFailed?.(errors),
        /**
         * 转发完整表单重置回调。
         */
        onReset: () => {
          props.onReset?.()
        },
        /**
         * 转发 Core 发出的提交 loading 状态。
         *
         * 外部传入 Form 时不会注入该回调，保持实例的创建期边界。
         *
         * @param loading - 当前是否处于提交流程中。
         */
        onLoadingChange: (loading) => {
          props.onLoadingChange?.(loading)
        },
        /**
         * 转发值变化回调。
         *
         * @param changedValues - 本次变更涉及的字段值。
         * @param latestSnapshot - 变更后的完整表单快照。
         */
        onValuesChange: (changedValues, latestSnapshot) => {
          props.onValuesChange?.(changedValues, latestSnapshot)
        },
        /**
         * 转发字段变化回调。
         *
         * @param changedPaths - 本次发生变化的字段路径。
         * @param allPaths - 当前已变更字段路径集合。
         */
        onFieldsChange: (changedPaths, allPaths) => {
          props.onFieldsChange?.(changedPaths, allPaths)
        },
      })

  const isExternalForm = props.form !== undefined

  /**
   * 注册表单上下文。
   *
   * 无论实例来自 props.form 还是 useForm，都必须同步注册，
   * 从而保证 FormItem、useField 等后代逻辑能够获取同一个实例。
   */
  const formInstance = createFormContext(providedForm)

  /**
   * 组件未受控时直接跟随 Core 提交状态；受控值仅覆盖操作区展示。
   */
  const effectiveLoading = computed(() => props.loading ?? formInstance.isLoading())

  /**
   * 归一化启用状态下的操作配置。
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

  let syncingFromModel = false

  /**
   * 将外部 modelValue 同步到 Core，并标记窗口以阻止 v-model 回写。
   *
   * @param values - 外部传入的最新表单值。
   */
  watch(
    () => props.modelValue,
    (values) => {
      syncingFromModel = true
      formInstance.setFieldsValue(values)
      syncingFromModel = false
    },
    { deep: true }
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

  /**
   * 通过共享 selector bridge 订阅完整快照，避免组件树重复注册 Core 监听。
   *
   * @param values - 当前表单的完整快照。
   */
  const formValues = useFormSelector(formInstance, (values) => values)

  /**
   * 将 Core 值同步回 v-model；外部 modelValue 写入期间跳过回写，避免循环。
   *
   * @param latestSnapshot - Core 发布的最新完整表单快照。
   */
  watch(
    formValues,
    (latestSnapshot) => {
      if (syncingFromModel) return

      emit("update:modelValue", latestSnapshot)
    },
    { flush: "sync" }
  )

  /**
   * 将外部传入的原始 Schema 同步更新到 Core。
   *
   * @param schemas - 最新的 props.schemas 配置。
   */
  watch(
    () => props.schemas,
    (schemas) => {
      if (!isSchemxSchemas(schemas)) {
        formInstance.setSchemas(schemas)
      }
    },
    { deep: false, immediate: !!props.form }
  )

  const viewSchemas = useViewSchemas(formInstance)

  /**
   * 根据 ViewSchema 在当前列表中的位置生成首尾样式类。
   *
   * @param schema - 当前需要计算样式的 ViewSchema。
   * @returns 用于包裹元素的首尾位置 class 映射。
   */
  const getFormItemClass = (schema: SchemxViewSchema<TValues>) => {
    const { isFirst, isLast } = getSectionPosition(
      viewSchemas.value as SchemxViewSchema[],
      schema.key
    )

    return {
      "schemx-item-wrapper--first": isFirst,
      "schemx-item-wrapper--last": isLast,
    }
  }

  /**
   * 将公开配置快照写入本地上下文并同步到 Core。
   *
   * @param nextSchemaConfig - 最新的表单级 schema 配置。
   */
  watch(
    pickSchemaConfig,
    (nextSchemaConfig) => {
      Object.assign(formSchemaConfig, nextSchemaConfig)
      formInstance.updateSchemaConfig(nextSchemaConfig)
    },
    { deep: false, immediate: isExternalForm }
  )

  /**
   * 暴露当前表单 Facade 的完整控制 API，供模板 ref 调用。
   */
  defineExpose({
    ...formInstance,
    submit: handleSubmit,
    reset: handleReset,
  })
</script>

<template>
  <div :class="['schemx', props.class]" :style="props.style">
    <FormItem
      v-for="schema in viewSchemas"
      :key="schema.key"
      :schema="schema as SchemxViewSchema"
      :class="getFormItemClass(schema as SchemxViewSchema<TValues>)"
    >
      <template v-for="(_, slotName) in fieldSlots" #[slotName]="slotProps">
        <slot :name="slotName" v-bind="slotProps ?? {}" />
      </template>
    </FormItem>
    <div v-if="isActionsVisible" class="schemx-actions">
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
  </div>
</template>
