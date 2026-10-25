import { computed, watch } from "vue"
import type { ComputedRef } from "vue"

import { getFormCreationConfig, isSchemxSchemas, mergeConfig } from "@schemx/core"
import { isEqual, omit, pick } from "es-toolkit"

import { createLegacyForm, defaultConfig, vueSchemaConfigKeys } from "../config"
import { provideFormContext, useConfigProviderContextRef } from "../context"

import { useForm, useFormModel } from "./index"

import type { SchemxFormProps, SchemxInstance } from "../types"
import type {
  CreateFormOptions,
  CreateSchemxOptions,
  FormConfig,
  SchemxApi,
  SchemxConfig,
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
      // 直接读取声明键，首次从缺省值新增的 Props 也建立响应式依赖。
      vueSchemaConfigKeys
        .map((key) => [key, props[key]])
        .filter(([, value]) => value !== undefined)
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

  // 这些能力在 Core 创建时固定，动态消费配置不能替换它们。
  const creationKeys = [
    "debug",
    "schedulerOptions",
    "validationConcurrency",
    "rendererRegistry",
    "presetRuleRegistry",
    "validatorAdapters",
    "defaultRendererType",
  ] as const

  const configKeys = [
    ...componentKeys,
    ...creationKeys,
    "submitter",
    "resetter",
    "rendererProps",
  ] as const

  const localConfig = computed(() => ({
    ...Object.fromEntries(configKeys.map((key) => [key, props[key]])),
    schemaConfig: schemaConfigProps.value,
  }))

  // 旧组件默认值在普通上下文合并后补入，保持其 Core 全局继承行为。
  const legacyCreator: SchemxApi["createForm"] = <TFormValues extends Values = Values>(
    options: CreateFormOptions<TFormValues> = {}
  ) =>
    createLegacyForm<TFormValues>({
      ...options,
      ...mergeConfig<TFormValues>(options, formFallbackConfig),
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

  // 展示配置也读取实际选定的引擎能力，后续 Props 更新不会伪装成已替换 Registry。
  const fixedCreationConfig = pick(creationSnapshot?.config ?? {}, creationKeys)

  // 动态覆盖撤销时使用捕获的继承层，不能回退到旧 Provider 的最终创建值。
  const effectiveConfig = computed(() =>
    mergeConfig<TValues>(
      fixedCreationConfig,
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

  useFormModel<TValues>(
    formInstance,
    () => props.modelValue,
    onModelValueChange,
    isExternalForm
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

  if (isExternalForm) {
    // 外部 Form 的完整配置属于调用方，只批量同步组件显式的 Schema 默认值。
    watch(
      schemaConfigProps,
      (next, previous) => {
        // 仅包含组件显式配置；整体提交也覆盖对象原地修改与标量撤销同时发生的情况。
        const patch: Partial<FormFieldDefaults> = { ...next }

        for (const key of Object.keys(previous ?? {})) {
          if (!Object.hasOwn(next, key)) {
            Reflect.set(patch, key, undefined)
          }
        }

        if (Object.keys(patch).length > 0) {
          formInstance.updateSchemaConfig(patch)
        }
      },
      { deep: true, immediate: true }
    )
  } else {
    // 仅提交运行期消费配置，创建选项始终由 Core 固定持有。
    const consumerConfig = computed<FormConfig<TValues>>((previous) => {
      const next = omit(effectiveConfig.value, creationKeys)

      // 固定选项变化或等价输入不提交；深层原地修改仍由下面的 deep watch 捕获。
      return previous && isEqual(previous, next) ? previous : next
    })

    // 旧全局路径保留“撤销曾提交属性即清除”的语义；独立工厂则恢复其固定继承值。
    const legacySchemaKeys =
      creationSnapshot?.defaults === undefined
        ? new Set(Object.keys(vueSchemaConfig.value))
        : undefined

    // 一次 Vue 更新只向 Core 提交一次，让 Schema 与 Renderer Props 在同一配置边界生效。
    watch(
      consumerConfig,
      (config) => {
        if (legacySchemaKeys === undefined) {
          formInstance.setConfig(config)

          return
        }

        for (const key of Object.keys(config.schemaConfig ?? {})) {
          legacySchemaKeys.add(key)
        }

        // 显式 undefined 持续保留旧入口的清除结果，不因其他属性更新而重新继承全局值。
        const schemaConfig: FormFieldDefaults = Object.fromEntries(
          [...legacySchemaKeys].map((key) => [
            key,
            Reflect.get(config.schemaConfig ?? {}, key),
          ])
        )

        formInstance.setConfig({ ...config, schemaConfig })
      },
      { deep: true }
    )
  }

  return { form: formInstance, config: effectiveConfig }
}
