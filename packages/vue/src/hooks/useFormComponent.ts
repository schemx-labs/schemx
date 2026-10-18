import { computed, nextTick, onScopeDispose, toRaw, watch } from "vue"
import type { ComputedRef, WatchStopHandle } from "vue"

import {
  createForm as createCoreForm,
  getFormCreationConfig,
  isSchemxSchemas,
  mergeConfig,
} from "@schemx/core"
import { pick } from "es-toolkit"

import { defaultConfig, vueSchemaConfigKeys } from "../config/defaultConfig"
import { useConfigProviderContextRef } from "../context/configProviderContext"
import { provideFormContext } from "../context/formContext"

import { useForm } from "./useForm"
import { useFormSelector } from "./useFormSelector"

import type { SchemxFormProps } from "../types/form"
import type {
  CreateFormOptions,
  CreateSchemxOptions,
  SchemxApi,
  SchemxConfig,
  SchemxInstance,
  Values,
} from "@schemx/core"

// 组件已通过 withDefaults 补齐模型、初始值与 Schema 输入。
type FormComponentProps<TValues extends Values> = Readonly<SchemxFormProps<TValues>> &
  Required<Pick<SchemxFormProps<TValues>, "modelValue" | "initialValues" | "schemas">>

/**
 * 组件内部接入结果；实例来源与同步策略不暴露到展示层。
 * @typeParam TValues - 当前表单值类型。
 */
export interface FormComponentRuntime<TValues extends Values> {
  /**
   * 已注册最近表单上下文的 Vue 实例。
   */
  readonly form: SchemxInstance<TValues>
  /**
   * 当前展示配置，工厂继承层使用创建时快照。
   */
  readonly config: ComputedRef<Readonly<CreateSchemxOptions<TValues>>>
}

/**
 * 接入组件的内部或外部 Form，统一处理配置和双向同步。
 *
 * 内部实例由 useForm 持有并随 scope 销毁；外部实例只同步显式字段，不接管所有权。
 * 实例来源在 setup 捕获，配置、模型和 Schema 后续仍响应式同步。
 * @internal
 * @typeParam TValues - 当前表单值类型。
 * @param props - 已补齐默认值的响应式组件 Props。
 * @param onModelValueChange - 向组件消费端发送模型快照的回调。
 * @param formCreator - 组件定义绑定的可选创建器。
 * @example const runtime = useFormComponent(props, values => emit("update:modelValue", values))
 */
export function useFormComponent<TValues extends Values>(
  props: FormComponentProps<TValues>,
  onModelValueChange: (values: TValues) => void,
  formCreator?: SchemxApi["createForm"]
): FormComponentRuntime<TValues> {
  // Core 同步边界的字段默认值类型，从当前配置契约读取。
  type FormFieldDefaults = NonNullable<SchemxConfig<TValues>["schemaConfig"]>

  /**
   * 提取需要同步到 Core 的表单级 schema 配置。
   */
  const pickSchemaConfig = (): FormFieldDefaults =>
    Object.fromEntries(
      Object.entries(pick(props, vueSchemaConfigKeys)).filter(
        ([, value]) => value !== undefined
      )
    )

  // 是否由调用方传入并负责生命周期的外部 Form。
  const externalForm = props.form

  const isExternalForm = externalForm !== undefined

  // 当前组件显式传入的、待同步到 Core 的 schema 配置。
  const schemaConfigProps = computed(pickSchemaConfig)

  // 所有适配包共享普通 App/Provider 上下文。
  const providerConfig = useConfigProviderContextRef()

  /**
   * 保持 SchemxForm 既有默认行为、且允许 Provider/App 覆盖的最低优先级配置。
   */
  const formFallbackConfig = {
    submitter: true,
    resetter: true,
    schemaConfig: {
      visible: true,
      validationTrigger: ["blur", "change"],
    },
  } satisfies SchemxConfig

  /**
   * 仅合并 Vue 配置来源；外部 Form 的字段默认值仅同步组件显式配置。
   */
  const componentKeys = [
    "colComponent",
    "rowComponent",
    "buttonComponent",
    "iconComponent",
  ] as const

  const configKeys = [
    ...componentKeys,
    "submitter",
    "resetter",
    "debug",
    "schedulerOptions",
    "validationConcurrency",
    "rendererProps",
    "rendererRegistry",
    "presetRuleRegistry",
    "validatorAdapters",
    "defaultRendererType",
  ] as const

  const localConfig = computed(() => ({
    ...pick(props, configKeys),
    schemaConfig: schemaConfigProps.value,
  }))

  // 旧组件默认值在普通上下文合并后补入，保持其 Core 全局继承行为。
  const legacyCreator: SchemxApi["createForm"] = <TFormValues extends Values = Values>(
    options: CreateFormOptions<TFormValues> = {}
  ) =>
    createCoreForm<TFormValues>({
      ...options,
      ...mergeConfig<TFormValues>(options, formFallbackConfig, {
        schemaConfig: defaultConfig,
      }),
    })

  /**
   * 获取或创建表单实例
   *
   * 优先使用外部传入的 form，否则内部通过 useForm 创建。
   * 必须在 setup 同步阶段调用，确保 provide 正确注入。
   */
  const providedForm =
    externalForm ??
    useForm<TValues>(
      {
        schemas: props.schemas,
        initialValues:
          Object.keys(props.modelValue).length > 0
            ? props.modelValue
            : props.initialValues,

        fieldRules: props.fieldRules,
        onRuleError: props.onRuleError,
        lifecycleHooks: props.lifecycleHooks,

        // 只有内部创建会绑定组件回调，读取最新 Props；外部实例保持原回调。
        onFinish: (values) => props.onFinish?.(values),
        onFinishFailed: (failure) => props.onFinishFailed?.(failure),
        onReset: () => {
          props.onReset?.()
        },
        onLoadingChange: (loading) => {
          props.onLoadingChange?.(loading)
        },
        onValuesChange: (changedValues, latestSnapshot) => {
          props.onValuesChange?.(changedValues, latestSnapshot)
        },
        onFieldsChange: (changedPaths, allPaths) => {
          props.onFieldsChange?.(changedPaths, allPaths)
        },
        ...localConfig.value,
      },
      formCreator ?? legacyCreator
    )

  const creationSnapshot = getFormCreationConfig(providedForm)

  // 动态覆盖撤销时使用捕获的继承层，不能回退到旧 Provider 的最终创建值。
  const effectiveConfig = computed(() =>
    mergeConfig<TValues>(
      localConfig.value,
      isExternalForm
        ? pick(providerConfig?.value ?? {}, componentKeys)
        : ((providerConfig?.value as CreateSchemxOptions<TValues> | undefined) ?? {}),
      isExternalForm
        ? (creationSnapshot?.config ?? {})
        : (creationSnapshot?.defaults ?? {}),
      formFallbackConfig,
      { schemaConfig: defaultConfig }
    )
  )

  const vueSchemaConfig = computed(() => effectiveConfig.value.schemaConfig ?? {})

  /**
   * 注册表单上下文。
   *
   * 无论实例由外部传入还是内部创建，都必须同步注册，
   * 从而保证 Field、useField 等后代逻辑能够获取同一个实例。
   */
  const formInstance = provideFormContext({
    form: providedForm,
    get schemaConfig() {
      return vueSchemaConfig.value
    },
    get iconComponent() {
      return effectiveConfig.value.iconComponent
    },
    get colComponent() {
      return effectiveConfig.value.colComponent
    },
    get rowComponent() {
      return effectiveConfig.value.rowComponent
    },
    get buttonComponent() {
      return effectiveConfig.value.buttonComponent
    },
  })

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
    onModelValueChange(values)

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

  // 每个字段独立监听，避免其他配置变化导致重复同步。
  const syncedSchemaConfig = isExternalForm ? schemaConfigProps : vueSchemaConfig

  const fieldWatchers = new Map<string, WatchStopHandle>()

  const watchFieldDefault = (key: string, immediate: boolean): void => {
    if (fieldWatchers.has(key)) return

    const fieldDefault = computed<unknown>(() =>
      Reflect.get(syncedSchemaConfig.value, key)
    )

    const stop = watch(
      fieldDefault,
      (nextValue, previousValue) => {
        const sameValue = Object.is(nextValue, previousValue)

        const isObject = nextValue !== null && typeof nextValue === "object"

        if (sameValue && !isObject) return

        // 深度监听能捕获同一对象的嵌套修改；复制外层让 Core 识别本次变化。
        const value =
          sameValue && isObject
            ? Array.isArray(nextValue)
              ? [...nextValue]
              : { ...nextValue }
            : nextValue

        formInstance.updateSchemaConfig({ [key]: value })
      },
      { deep: true, immediate }
    )

    fieldWatchers.set(key, stop)
  }

  for (const key of new Set([
    ...vueSchemaConfigKeys,
    ...Object.keys(syncedSchemaConfig.value),
  ])) {
    watchFieldDefault(key, isExternalForm)
  }

  // 默认值扩展也可在 Provider 更新时新增；覆盖撤销提交 undefined，由 Core 回退内置默认值。
  watch(
    () => Object.keys(syncedSchemaConfig.value),
    (keys) => {
      for (const key of keys) watchFieldDefault(key, true)
    }
  )
  onScopeDispose(() => {
    for (const stop of fieldWatchers.values()) stop()
  })

  return { form: formInstance, config: effectiveConfig }
}
