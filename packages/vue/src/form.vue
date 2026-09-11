<!--
  schemx - 主组件

  基于 Schema 配置的表单组件，使用 useForm Hook 管理状态。

  @module schemx
-->

<script lang="ts" setup generic="TValues extends Values = Values">
  import { computed, nextTick, toRaw, useSlots, watch } from "vue"

  import {
    defaultSchemxConfigKeys,
    getGlobalSchemxConfig,
    isSchemxSchemas,
    mergeSchemxConfig,
    resolveSchemxConfig,
  } from "@schemx/core"
  import { pick } from "es-toolkit"

  import Button from "./components/Button"
  import SchemaList from "./components/SchemaList"
  import { getSchemxAppConfig } from "./config"
  import {
    defaultVueSchemaConfig,
    defaultVueSchemaConfigKeys,
  } from "./config/defaultVueSchemaConfig"
  import { provideFormContext, useConfigProviderContextRef } from "./context"
  import { useForm, useFormSelector, useViewSchemas } from "./hooks"
  import { registeredColComponent } from "./utils/colProvider"
  import { getSectionPosition } from "./utils/helpers"

  import type { SchemxFormActionConfig, SchemxFormProps } from "./types/index"
  import type {
    SchemxConfig,
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
    submitter: true,
    resetter: true,
    rendererProps: undefined,
    rendererRegistry: undefined,
    presetRuleRegistry: undefined,
    fieldRules: undefined,
    schedulerOptions: undefined,
    validationConcurrency: undefined,
    visible: undefined,
    validationTrigger: undefined,
    readonly: undefined,
    disabled: undefined,
    colon: undefined,
    showRequiredMark: undefined,
    colComponent: undefined,
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
   * Core 兼容键与 Vue 展示键的合并集合。
   */
  const schemaConfigKeys = [
    ...defaultSchemxConfigKeys,
    ...defaultVueSchemaConfigKeys,
  ] as (keyof SchemxSchemaConfig)[]

  /**
   * 提取需要同步到 Core 的表单级 schema 配置。
   */
  const pickSchemaConfig = (): Partial<SchemxSchemaConfig> => {
    // Vue 保留 `required` 对当前 TValues 的泛型约束；Core 的表单级配置使用
    // unknown 表示任意字段值。运行时该回调只会接收当前 Form 的字段值，因此在
    // Vue 到 Core 的适配边界收窄为 Core 配置类型。
    const schemaConfig = pick(props, schemaConfigKeys) as Partial<SchemxSchemaConfig>

    return Object.fromEntries(
      Object.entries(schemaConfig).filter(([, value]) => value !== undefined)
    ) as Partial<SchemxSchemaConfig>
  }

  // 是否由调用方传入并负责生命周期的外部 Form。
  const isExternalForm = props.form !== undefined

  // 当前组件显式传入的、待同步到 Core 的 schema 配置。
  const schemaConfigProps = computed(pickSchemaConfig)

  // 当前 Vue App 的安装级配置快照。
  const appConfig = getSchemxAppConfig()

  // 当前组件树中最近 Provider 的响应式配置。
  const providerConfig = useConfigProviderContextRef()

  /**
   * Core 全局配置只在内部 Form 创建时取快照，后续变更不影响已有实例。
   */
  const coreConfig = getGlobalSchemxConfig()

  /**
   * 保持 SchemxForm 既有默认行为、且允许 Provider/App 覆盖的最低优先级配置。
   */
  const formFallbackConfig: SchemxConfig<TValues> = {
    schemaConfig: {
      visible: true,
      validationTrigger: ["blur", "change"],
    },
  }

  /**
   * 合并配置来源；外部 Form 只接收组件显式配置与组件默认行为。
   */
  const mergedConfig = computed(() =>
    isExternalForm
      ? mergeSchemxConfig({ schemaConfig: schemaConfigProps.value }, formFallbackConfig)
      : mergeSchemxConfig(
          { schemaConfig: schemaConfigProps.value },
          (providerConfig?.value as SchemxConfig<TValues> | undefined) ?? {},
          appConfig as SchemxConfig<TValues>,
          formFallbackConfig,
          coreConfig as SchemxConfig<TValues>
        )
  )

  /**
   * 为后代 Field 补充 Vue 展示默认值。
   */
  const contextSchemaConfig = computed<Partial<SchemxSchemaConfig>>(() => ({
    ...defaultVueSchemaConfig,
    ...mergedConfig.value.schemaConfig,
  }))

  /**
   * 计算内部 Form 当前完整生效的配置，用于撤销局部覆盖和响应 Provider 变化。
   */
  const resolvedSchemaConfig = computed<SchemxSchemaConfig>(
    () => resolveSchemxConfig(mergedConfig.value).schemaConfig
  )

  /**
   * 判断配置对象是否显式包含指定 key。
   *
   * @param config - 待检查的配置对象。
   * @param key - 要检查的配置 key。
   * @returns 配置对象自身包含该 key 时返回 `true`。
   */
  const hasSchemaConfigKey = (
    config: Partial<SchemxSchemaConfig>,
    key: keyof SchemxSchemaConfig
  ): boolean => Object.prototype.hasOwnProperty.call(config, key)

  /**
   * 当前 Form 使用的 Col，按 Form、Provider、App、全局注册顺序解析。
   */
  const resolvedColComponent = computed(
    () =>
      props.colComponent ??
      providerConfig?.value.colComponent ??
      appConfig.colComponent ??
      registeredColComponent.value
  )

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
        schemaConfig: resolvedSchemaConfig.value,
        initialValues:
          Object.keys(props.modelValue).length > 0
            ? props.modelValue
            : props.initialValues,

        rendererProps: props.rendererProps,
        rendererRegistry: props.rendererRegistry,
        defaultRendererType: props.defaultRendererType,
        presetRuleRegistry: props.presetRuleRegistry,
        fieldRules: props.fieldRules,
        validatorAdapters: props.validatorAdapters,
        schedulerOptions: props.schedulerOptions,
        validationConcurrency: props.validationConcurrency,

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

  /**
   * 注册表单上下文。
   *
   * 无论实例来自 props.form 还是 useForm，都必须同步注册，
   * 从而保证 Field、useField 等后代逻辑能够获取同一个实例。
   */
  const formInstance = provideFormContext({
    form: providedForm,
    get schemaConfig() {
      return contextSchemaConfig.value
    },
  })

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

  let syncingFromModel = false

  /**
   * 记录 Core 发出的、等待标准 v-model 回传的一次性快照身份。
   */
  const internalModelEchoes = new Set<TValues>()

  /**
   * 发出内部模型更新，并记录等待父级原样回传的快照。
   *
   * @param values - 要发出的最新表单值快照。
   */
  const emitModelValue = (values: TValues): void => {
    const rawValues = toRaw(values)

    internalModelEchoes.add(rawValues)
    emit("update:modelValue", values)

    void nextTick(() => {
      internalModelEchoes.delete(rawValues)
    })
  }

  /**
   * 将外部 modelValue 同步到 Core，并标记窗口以阻止 v-model 回写。
   *
   * @param values - 外部传入的最新表单值。
   */
  watch(
    () => props.modelValue,
    (values) => {
      if (internalModelEchoes.delete(toRaw(values))) {
        return
      }

      syncingFromModel = true

      try {
        formInstance.setFieldsValue(values)
      } finally {
        syncingFromModel = false
      }
    },
    { deep: true, immediate: isExternalForm }
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
      if (syncingFromModel) {
        return
      }

      emitModelValue(latestSnapshot)
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
    { immediate: isExternalForm }
  )

  // 当前 Form 的响应式 ViewSchema 列表。
  const viewSchemas = useViewSchemas(formInstance)

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
   * 将内部 Form 的完整配置同步到 Context 和 Core。
   *
   * @param nextSchemaConfig - 合并后的完整 schema 配置。
   */
  const syncInternalSchemaConfig = (nextSchemaConfig: SchemxSchemaConfig): void => {
    formInstance.updateSchemaConfig(nextSchemaConfig)
  }

  /**
   * 将外部 Form 的组件级配置增量同步到 Context 和 Core。
   *
   * @param nextSchemaConfig - 当前组件显式配置。
   * @param previousSchemaConfig - 上一次组件显式配置，用于清理已移除的 key。
   */
  const syncExternalSchemaConfig = (
    nextSchemaConfig: Partial<SchemxSchemaConfig>,
    previousSchemaConfig: Partial<SchemxSchemaConfig> | undefined
  ): void => {
    const patch: Partial<SchemxSchemaConfig> = { ...nextSchemaConfig }

    if (previousSchemaConfig !== undefined) {
      for (const key of schemaConfigKeys) {
        if (
          hasSchemaConfigKey(previousSchemaConfig, key) &&
          !hasSchemaConfigKey(nextSchemaConfig, key)
        ) {
          patch[key] = undefined
        }
      }
    }

    if (Object.keys(patch).length > 0) {
      formInstance.updateSchemaConfig(patch)
    }
  }

  if (isExternalForm) {
    watch(schemaConfigProps, syncExternalSchemaConfig, {
      deep: true,
      immediate: true,
    })
  } else {
    watch(resolvedSchemaConfig, syncInternalSchemaConfig, { deep: true })
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
    <SchemaList
      :schemas="viewSchemas as SchemxViewSchema[]"
      :view-schemas="viewSchemas as SchemxViewSchema[]"
      :col-component="resolvedColComponent"
      :field-class-resolver="getFieldClass"
    >
      <template v-for="(_, slotName) in fieldSlots" #[slotName]="slotProps">
        <slot :name="slotName" v-bind="slotProps ?? {}" />
      </template>
    </SchemaList>

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
