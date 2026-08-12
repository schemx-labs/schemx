/**
 * Schema compiler 实现。
 *
 * 将用户传入的 SchemxField schema 编译为 RuntimeNodeInput。
 * 通过 WeakMap 以 schema 对象引用为键，并按父级与索引位置缓存输入。
 * version 机制在编译选项变化时失效缓存，使位置未变的 schema 复用输入。
 *
 * @module core/runtime/compiler/createCompile
 */

import { mergeAndResolveSchemxConfig } from "../../config"
import { isDependencySchema, isGroupSchema, NormalizedTrigger } from "../../utils"

import { type Compile, type CompileOptions } from "./types"

import type {
  NamePath,
  ResolvedSchemxSchemaConfig,
  SchemxComponentProps,
  SchemxContainerDependencies,
  SchemxFieldDependencies,
  SchemxInstance,
  SchemxResolvedBaseField,
  ValidationTrigger,
  Values,
} from "../../types"
import type { FieldRules } from "../../types/rule"
import type {
  SchemxBaseField,
  SchemxDependencyField,
  SchemxField,
  SchemxGroupField,
} from "../../types/schema"
import type {
  DependencyRenderer,
  FieldDynamicProps,
  FieldValidation,
  PresentationDynamicProps,
  PresentationStaticState,
  RuntimeNodeInput,
} from "../node"

/**
 * 创建 compiler 的私有输入缓存。
 */
function createCompileCache<TValues extends Values = Values>(): WeakMap<
  SchemxField<TValues>,
  Map<string, RuntimeNodeInput<TValues>>
> {
  return new WeakMap()
}

/**
 * 创建 schema compiler。
 *
 * 每个 compiler 实例维护自己的节点输入缓存。调用方通过 `invalidate()`
 * 失效缓存，而不是直接操作缓存版本。
 *
 * @param options - 编译选项，包含默认属性和表单实例。
 * @returns schema compiler 门面，提供 compileNode、invalidate 等方法。
 */
export function createCompile<TValues extends Values = Values>(
  options: Partial<Omit<CompileOptions<TValues>, "schemaConfig">> & {
    schemaConfig?: ResolvedSchemxSchemaConfig
  } = {}
): Compile<TValues> {
  const compileOptions: CompileOptions<TValues> = {
    // createForm 传入的是与 context 共享的已合并对象，必须保留其引用。
    schemaConfig: options.schemaConfig ?? mergeAndResolveSchemxConfig().schemaConfig,
    rendererProps: options.rendererProps,
    defaultRendererType: options.defaultRendererType,
    formInstance: options.formInstance ?? ({} as SchemxInstance<TValues>),
  }

  let compileCache = createCompileCache<TValues>()

  /**
   * 编译单个 schema 为 RuntimeNode 输入。
   *
   * 该输入不含 group 子节点，子树遍历由 reconciler 负责。
   */
  function compileNode(
    schema: SchemxField<TValues>,
    parentKey: string,
    index: number
  ): RuntimeNodeInput<TValues> {
    const key = createRuntimeNodeKey(schema, index, parentKey)

    const schemaEntries = compileCache.get(schema)

    const cached = schemaEntries?.get(key)

    if (cached) {
      return cached
    }

    const input = createRuntimeNodeInput(schema, index, parentKey, compileOptions)

    const nextSchemaEntries = schemaEntries ?? new Map()

    nextSchemaEntries.set(key, input)
    compileCache.set(schema, nextSchemaEntries)

    return input
  }

  /**
   * 替换完整 WeakMap，使旧缓存可以随 schema 引用一同回收。
   */
  function invalidate(): void {
    compileCache = createCompileCache<TValues>()
  }

  return {
    compileNode,
    invalidate,
  }
}

/**
 * 将单个 schema 编译为不含子树的 RuntimeNode 输入。
 */
function createRuntimeNodeInput<TValues extends Values>(
  schema: SchemxField<TValues>,
  index: number,
  parentKey: string,
  options: CompileOptions<TValues>
): RuntimeNodeInput<TValues> {
  const key = createRuntimeNodeKey(schema, index, parentKey)

  const configToken = Symbol(key)

  if (isGroupSchema(schema)) {
    const staticState = buildPresentationStaticState(schema, options)

    const {
      children: _children,
      dependencies,
      visible: _visible,
      readonly: _readonly,
      disabled: _disabled,
      ...staticSchema
    } = schema

    return {
      type: "group",
      key,
      configToken,
      staticSchema: {
        ...staticSchema,
        key,
        ...staticState,
        children: [],
      },
      staticState,
      dynamicProps: createPresentationDynamicProps(dependencies),
    }
  }

  if (isDependencySchema(schema)) {
    return createDependencyInput(schema, key, configToken, options)
  }

  return createFieldInput(schema, key, configToken, options)
}

/** 创建字段节点的运行时输入，包含静态配置、动态依赖和校验配置。 */
function createFieldInput<TValues extends Values>(
  schema: SchemxBaseField<TValues>,
  key: string,
  configToken: symbol,
  options: CompileOptions<TValues>
): RuntimeNodeInput<TValues> {
  const staticSchema = buildFieldStaticSchema(schema, key, options)

  return {
    type: "field",
    key,
    configToken,
    name: schema.name,
    componentType: schema.componentType,
    staticSchema,
    dynamicProps: createFieldDynamicProps(schema.dependencies),
    validation: createFieldValidation(staticSchema),
  }
}

/** 创建依赖节点的运行时输入，并包装其 renderer 的中止信号。 */
function createDependencyInput<TValues extends Values>(
  schema: SchemxDependencyField<TValues>,
  key: string,
  configToken: symbol,
  options: CompileOptions<TValues>
): RuntimeNodeInput<TValues> {
  const renderer: DependencyRenderer<TValues> = (formApi, abortSignal) => {
    return schema.renderer(formApi.getValues(), formApi, { abortSignal })
  }

  return {
    type: "dependency",
    key,
    configToken,
    triggerFields: [...schema.to],
    renderer,
    rendererIdentity: schema.renderer,
    staticState: buildPresentationStaticState(schema, options),
    dynamicProps: createPresentationDynamicProps(schema.dependencies),
  }
}

/** 合并容器节点的可见性、只读和禁用静态状态。 */
function buildPresentationStaticState<TValues extends Values>(
  schema: Pick<
    SchemxGroupField<TValues> | SchemxDependencyField<TValues>,
    "visible" | "readonly" | "disabled"
  >,
  options: CompileOptions<TValues>
): PresentationStaticState {
  return {
    visible: schema.visible ?? options.schemaConfig.visible,
    readonly: schema.readonly ?? options.schemaConfig.readonly,
    disabled: schema.disabled ?? options.schemaConfig.disabled,
  }
}

/** 将容器依赖配置转换为运行时动态属性描述。 */
function createPresentationDynamicProps<TValues extends Values>(
  dependencies: SchemxContainerDependencies<TValues> | undefined
): PresentationDynamicProps<TValues> | null {
  if (!dependencies) {
    return null
  }

  return {
    triggerFields: [...dependencies.triggerFields],
    dependencies,
  }
}

/** 合并字段 Schema 与全局默认值，生成编译后的静态字段配置。 */
function buildFieldStaticSchema<TValues extends Values>(
  schema: SchemxBaseField<TValues>,
  key: string,
  options: CompileOptions<TValues>
): SchemxResolvedBaseField<TValues> {
  const { schemaConfig, formInstance } = options

  const {
    contentAlign,
    labelIcon,
    labelAlign,
    labelPosition,
    labelWidth,
    colon,
    componentProps,
    visible,
    readonly,
    readonlyPlaceholder,
    disabled,
    required,
    rules,
    showRequiredMark,
    validationTrigger,
    dependencies: _dependencies,
    ...rest
  } = schema

  // 按当前 Schema 的精确类型读取默认值，不切换到 Registry fallback key。
  const rendererComponentProps = options.rendererProps?.[schema.componentType]

  // Renderer 默认值先于字段 Props 展开，保留字段级覆盖语义。
  const mergedComponentProps = {
    ...rendererComponentProps,
    ...componentProps,
  } as SchemxComponentProps<TValues>

  const mergedReadonly = readonly ?? schemaConfig.readonly

  const mergedContentAlign = contentAlign ?? schemaConfig.contentAlign

  const mergedPlaceholder = getPlaceholder(schema, rendererComponentProps)

  // 字段显式配置优先于 Renderer 默认值，并沿用 Component Props 高于顶层字段的语义。
  const mergedReadonlyPlaceholder =
    componentProps?.readonlyPlaceholder ??
    readonlyPlaceholder ??
    rendererComponentProps?.readonlyPlaceholder

  const mergedAlign =
    componentProps?.align ??
    contentAlign ??
    rendererComponentProps?.align ??
    schemaConfig.contentAlign

  const normalizedSchema = {
    ...rest,
    key,
    visible: visible ?? schemaConfig.visible,
    readonly: mergedReadonly,
    readonlyPlaceholder: mergedReadonlyPlaceholder,
    disabled: disabled ?? schemaConfig.disabled,
    required: required ?? schemaConfig.required,
    placeholder: mergedPlaceholder,
    showRequiredMark: showRequiredMark ?? schemaConfig.showRequiredMark,
    labelIcon: labelIcon ?? schemaConfig.labelIcon,
    labelAlign: labelAlign ?? schemaConfig.labelAlign,
    labelPosition: labelPosition ?? schemaConfig.labelPosition,
    labelWidth: labelWidth ?? schemaConfig.labelWidth,
    contentAlign: mergedContentAlign,
    colon: colon ?? schemaConfig.colon,
    rules,
    validationTrigger: normalizeTrigger(
      validationTrigger ?? schemaConfig.validationTrigger
    ),
  } as SchemxResolvedBaseField<TValues>

  if (mergedReadonly) {
    normalizedSchema.contentAlign = "right"
    normalizedSchema.labelPosition = "left"
  }

  normalizedSchema.componentProps = {
    ...mergedComponentProps,
    align: mergedReadonly ? "right" : mergedAlign,
    readonly: mergedReadonly,
    readonlyPlaceholder: mergedReadonlyPlaceholder,
    disabled: disabled ?? schemaConfig.disabled,
    placeholder: mergedPlaceholder,
    formItemProps: { ...normalizedSchema },
    formInstance,
  }

  return normalizedSchema
}

/**
 * 按字段配置和组件类型计算最终占位文案。
 *
 * @param schema - 当前已规范化的字段 Schema。
 * @param rendererComponentProps - 当前 Renderer 的静态默认 Props。
 * @returns 字段最终传给 Renderer 的占位文案。
 */
function getPlaceholder<TValues extends Values>(
  schema: SchemxBaseField<TValues>,
  rendererComponentProps: Partial<SchemxComponentProps<TValues>> | undefined
): string {
  const placeholder =
    schema.componentProps?.placeholder ??
    schema.placeholder ??
    rendererComponentProps?.placeholder

  if (placeholder != null) {
    return placeholder
  }

  return ["input", "text", "textarea"].includes(schema.componentType)
    ? `请输入${schema.label || schema.name}`
    : `请选择${schema.label || schema.name}`
}

/** 将字段依赖配置转换为运行时动态属性描述。 */
function createFieldDynamicProps<TValues extends Values>(
  dependencies: SchemxFieldDependencies<TValues> | undefined
): FieldDynamicProps<TValues> | null {
  if (!dependencies) {
    return null
  }

  return {
    source: "dependencies",
    triggerFields: dependencies.triggerFields,
    dependencies,
  }
}

/** 根据字段的 required 与 rules 配置生成校验描述。 */
function createFieldValidation<TValues extends Values>(
  schema: SchemxResolvedBaseField<TValues>
): FieldValidation<TValues> | null {
  const rules = normalizeValidationRules(schema.rules)

  if (!schema.required && !rules) {
    return null
  }

  return {
    trigger: schema.validationTrigger,
    required: schema.required,
    rules,
  }
}

/** 将空规则数组归一化为未配置，避免注册无效校验任务。 */
function normalizeValidationRules<TValues extends Values>(
  rules: FieldRules<TValues, NamePath<TValues>> | undefined
): FieldRules<TValues, NamePath<TValues>> | undefined {
  if (rules == null) {
    return undefined
  }

  return Array.isArray(rules) && rules.length === 0 ? undefined : rules
}

/** 根据显式 key 或节点路径生成稳定的运行时节点 key。 */
function createRuntimeNodeKey<TValues extends Values>(
  schema: SchemxField<TValues>,
  index: number,
  parentKey: string
): string {
  if (schema.key) {
    return schema.key
  }

  if (isDependencySchema(schema)) {
    const triggerKey = schema.to.map(serializeNamePath).join(",")

    return parentKey
      ? `dependency:${parentKey}/${index}/${triggerKey}`
      : `dependency:${index}/${triggerKey}`
  }

  if (isGroupSchema(schema)) {
    return parentKey ? `group:${parentKey}/${index}` : `group:${index}`
  }

  const nameKey = serializeNamePath(schema.name)

  return parentKey ? `field:${parentKey}/${nameKey}` : `field:${nameKey}`
}

/** 将字符串或数组形式的字段路径序列化为稳定字符串。 */
function serializeNamePath(name: NamePath): string {
  return Array.isArray(name) ? name.join(".") : String(name)
}

/** 将旧版 onXxx 校验触发器归一化为运行时触发器名称。 */
function normalizeTrigger(
  trigger: ValidationTrigger | ValidationTrigger[]
): NormalizedTrigger | NormalizedTrigger[] {
  const normalized: Record<ValidationTrigger, NormalizedTrigger> = {
    onBlur: "blur",
    onChange: "change",
    onSubmit: "submit",
    blur: "blur",
    change: "change",
    submit: "submit",
  }

  const triggers = Array.isArray(trigger) ? trigger : [trigger]

  return triggers.map((item) => normalized[item] ?? "submit")
}
