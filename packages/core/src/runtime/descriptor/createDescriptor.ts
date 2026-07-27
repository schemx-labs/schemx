/**
 * Descriptor 创建函数。
 *
 * 该模块只负责把单个 schema 转换为 descriptor；递归编排、缓存和失效策略属于
 * compiler 模块。
 *
 * @module core/runtime/descriptor/createDescriptor
 */

import { isDependencySchema, isGroupSchema, NormalizedTrigger } from "../../utils"

import type { SchemaRuntimeContext } from "../context"
import type {
  ContainerDynamicPropsDescriptor,
  ContainerStaticState,
  DependencyDescriptor,
  DependencyRenderer,
  FieldDescriptor,
  FieldDynamicPropsDescriptor,
  FieldValidationDescriptor,
  FormDescriptor,
  GroupDescriptor,
} from "./types"
import type {
  NamePath,
  SchemxContainerDependencies,
  SchemxFieldDependencies,
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

/**
 * createDescriptor 的运行时上下文。
 * 仅依赖表单的默认属性配置与实例引用，不依赖完整 Runtime Context。
 */
type DescriptorContext<TValues extends Values = Values> = Pick<
  SchemaRuntimeContext<TValues>,
  "defaultProps" | "instance"
>

/**
 * 创建任意表单 descriptor。
 *
 * @param schema - schema 字段配置。
 * @param index - schema 在同级列表中的位置。
 * @param parentKey - 父级 descriptor key。
 * @param context - 当前表单实例默认配置与公开 API。
 * @returns 编译后的 descriptor。
 */
export function createDescriptor<TValues extends Values = Values>(
  schema: SchemxField<TValues>,
  index: number,
  parentKey: string | undefined,
  context: DescriptorContext<TValues>
): FormDescriptor<TValues> {
  const key = createDescriptorKey(schema, index, parentKey)

  // 根据 schema 类型分发到不同的 descriptor 构建函数
  if (isGroupSchema(schema)) {
    // 分组：递归处理所有子节点
    const children = schema.children.map((schemaChild, index) =>
      createDescriptor(schemaChild, index, key, context)
    )

    return createGroupDescriptor(schema, key, children, context)
  }

  if (isDependencySchema(schema)) {
    // 依赖：编译为含动态 renderer 的描述符
    return createDependencyDescriptor(schema, key, context)
  }

  // 普通字段：编译为含静态 schema + 校验 + 动态属性的描述符
  return createFieldDescriptor(schema, key, context)
}

/**
 * 创建字段 descriptor。
 *
 * @param schema - 字段 schema。
 * @param key - 已生成的 descriptor key。
 * @param context - 当前表单实例默认配置与公开 API。
 * @returns 字段 descriptor。
 */
function createFieldDescriptor<TValues extends Values = Values>(
  schema: SchemxBaseField<TValues>,
  key: string,
  context: DescriptorContext<TValues>
): FieldDescriptor<TValues> {
  // 先合并默认值得到规范化 schema，再提取校验与动态属性
  const normalizedSchema = buildNormalizedFieldSchema(schema, key, context)

  return {
    type: "field",
    key,
    name: schema.name,
    componentType: schema.componentType,
    staticSchema: normalizedSchema,
    dynamicProps: createFieldDynamicProps(schema.dependencies),
    validation: createFieldValidation(normalizedSchema),
  }
}

/**
 * 创建分组 descriptor。
 *
 * @param schema - 分组 schema。
 * @param key - 已生成的 descriptor key。
 * @param children - 子级 descriptors。
 * @returns 分组 descriptor。
 */
function createGroupDescriptor<TValues extends Values = Values>(
  schema: SchemxGroupField<TValues>,
  key: string,
  children: FormDescriptor<TValues>[],
  context: DescriptorContext<TValues>
): GroupDescriptor<TValues> {
  const {
    children: _rawChildren,
    dependencies,
    visible: _visible,
    readonly: _readonly,
    disabled: _disabled,
    ...schemaWithoutChildren
  } = schema

  const staticState = buildNormalizedContainerState(schema, context)

  return {
    type: "group",
    key,
    staticSchema: {
      ...schemaWithoutChildren,
      key,
      ...staticState,
      children: [],
    },
    staticState,
    dynamicProps: createContainerDynamicProps(dependencies),
    children,
  }
}

/**
 * 创建 dependency descriptor。
 *
 * @param schema - dependency schema。
 * @param key - 已生成的 descriptor key。
 * @returns dependency descriptor。
 */
function createDependencyDescriptor<TValues extends Values = Values>(
  schema: SchemxDependencyField<TValues>,
  key: string,
  context: DescriptorContext<TValues>
): DependencyDescriptor<TValues> {
  // 拷贝 trigger 字段列表快照，避免外部意外修改
  const trigger = [...schema.to]

  // 包装 renderer：注入 formApi 和 abortSignal，运行时由 compiler 调用
  const renderer: DependencyRenderer<TValues> = (formApi, abortSignal) => {
    const values = formApi.getValues()

    return schema.renderer(values, formApi, {
      abortSignal,
    })
  }

  return {
    type: "dependency",
    key,
    triggerFields: trigger,
    renderer,
    rendererIdentity: schema.renderer,
    staticState: buildNormalizedContainerState(schema, context),
    dynamicProps: createContainerDynamicProps(schema.dependencies),
  }
}

/**
 * 规范化容器的静态呈现状态。
 */
function buildNormalizedContainerState<TValues extends Values>(
  schema: Pick<
    SchemxGroupField<TValues> | SchemxDependencyField<TValues>,
    "visible" | "readonly" | "disabled"
  >,
  context: DescriptorContext<TValues>
): ContainerStaticState {
  return {
    visible: schema.visible ?? context.defaultProps.visible,
    readonly: schema.readonly ?? context.defaultProps.readonly,
    disabled: schema.disabled ?? context.defaultProps.disabled,
  }
}

/**
 * 创建容器动态属性描述。
 */
function createContainerDynamicProps<TValues extends Values>(
  dependencies: SchemxContainerDependencies<TValues> | undefined
): ContainerDynamicPropsDescriptor<TValues> | null {
  if (!dependencies) {
    return null
  }

  return {
    triggerFields: [...dependencies.triggerFields],
    dependencies,
  }
}

/**
 * 根据 componentType 和 placeholder 配置生成字段占位提示文本。
 *
 * 仅当 schema 与 `componentProps` 都未显式指定 placeholder 时自动生成；输入型组件用"请输入"，
 * 选择型组件用"请选择"，label 缺失时 fallback 到字段名。
 *
 * @param schema - 字段 schema。
 * @returns 占位提示文本。
 */
function getPlaceholder<TValues extends Values>(
  schema: SchemxBaseField<TValues>
): string {
  const existingplaceholder = schema.componentProps?.placeholder ?? schema.placeholder

  if (existingplaceholder == null) {
    return ["input", "text", "textarea"].includes(schema.componentType)
      ? `请输入${schema.label || schema.name}`
      : `请选择${schema.label || schema.name}`
  }

  return existingplaceholder
}

/**
 * 合并默认值与 schema 配置，生成规范化字段 schema。
 *
 * 合并优先级（高→低）：字段自身配置 > 已解析的表单级 defaultProps。
 * 只读态会强制 contentAlign 为 right、labelPosition 为 left。
 *
 * @param schema - 原始字段 schema。
 * @param context - 运行时上下文，提供 defaultProps 与表单实例。
 * @returns 规范化后的字段 schema。
 */
function buildNormalizedFieldSchema<TValues extends Values>(
  schema: SchemxBaseField<TValues>,
  key: string,
  context: DescriptorContext<TValues>
): SchemxResolvedBaseField<TValues> {
  const { defaultProps, instance } = context

  // 解构分离出需要单独合并的属性，其余（如 label、name）直接透传
  const {
    contentAlign,
    labelIcon,
    labelAlign,
    labelPosition,
    labelWidth,
    colon,
    componentProps: cp,
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

  // defaultProps 已在 createForm 装配阶段合并内置、全局与 Form 实例配置。
  const mergedVisible = visible ?? defaultProps.visible

  const mergedReadonly = readonly ?? defaultProps.readonly

  const mergedDisabled = disabled ?? defaultProps.disabled

  const mergedContentAlign = contentAlign ?? defaultProps.contentAlign

  const mergedAlign = mergedReadonly ? "right" : (cp?.align ?? mergedContentAlign)

  const mergedValidationTrigger = validationTrigger ?? defaultProps.validationTrigger

  const mergedPlaceholder = getPlaceholder(schema)

  const mergedRequired = required ?? defaultProps.required

  const mergedReadonlyPlaceholder = cp?.readonlyPlaceholder ?? readonlyPlaceholder

  // showRequiredMark 未设置时为 undefined，运行时由 effectiveSchema 回退到 Boolean(required)。
  const mergedShowRequiredMark = showRequiredMark ?? defaultProps.showRequiredMark

  const normalizedSchema = {
    ...(rest ?? {}),
    key,

    visible: mergedVisible,
    readonly: mergedReadonly,
    readonlyPlaceholder: mergedReadonlyPlaceholder,
    disabled: mergedDisabled,
    required: mergedRequired,
    placeholder: mergedPlaceholder,
    showRequiredMark: mergedShowRequiredMark,

    labelIcon: labelIcon ?? defaultProps.labelIcon,
    labelAlign: labelAlign ?? defaultProps.labelAlign,
    labelPosition: labelPosition ?? defaultProps.labelPosition,
    labelWidth: labelWidth ?? defaultProps.labelWidth,
    contentAlign: mergedContentAlign,
    colon: colon ?? defaultProps.colon,

    rules,
    validationTrigger: normalizeTrigger(mergedValidationTrigger),
  } as SchemxResolvedBaseField<TValues>

  // 只读模式下覆盖对齐方式，保证展示一致性
  if (mergedReadonly) {
    normalizedSchema.contentAlign = "right"
    normalizedSchema.labelPosition = "left"
  }

  // 将所有合并后的 props 灌入 componentProps，渲染器直接取用

  normalizedSchema.componentProps = {
    ...cp,
    align: mergedAlign,
    readonly: mergedReadonly,
    readonlyPlaceholder: mergedReadonlyPlaceholder,
    disabled: mergedDisabled,
    placeholder: mergedPlaceholder,
    formItemProps: normalizedSchema,
    formInstance: instance,
  }

  return normalizedSchema
}

/**
 * 根据字段 dependencies 配置构建动态属性描述。
 *
 * 动态属性描述是一个轻量声明，仅记录来源和触发字段，不包含运行期响应式逻辑。
 * 实际的依赖追踪与属性重算由 DynamicProps 领域层在 node 实例化后完成。
 *
 * @param dependencies - 字段 dependencies 配置，缺省时返回 null。
 * @returns 动态属性描述，或 null 表示字段无动态属性。
 */
function createFieldDynamicProps<
  TValues extends Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
>(
  dependencies: SchemxFieldDependencies<TValues, TName> | undefined
): FieldDynamicPropsDescriptor<TValues, TName> | null {
  if (!dependencies) {
    return null
  }

  return {
    source: "dependencies",
    triggerFields: dependencies.triggerFields,
    dependencies,
  }
}

/**
 * 从规范化 schema 中提取校验描述。
 *
 * 提取 `required`、rules 与 trigger，不在此处做校验规则的运行时编译——这些配置是纯声明式
 * 数据，由后续的 Validation 领域层按需消费。
 *
 * @param schema - 规范化字段 schema。
 * @returns 校验描述，或 null 表示字段无校验资源。
 */
function createFieldValidation<TValues extends Values>(
  schema: SchemxResolvedBaseField<TValues>
): FieldValidationDescriptor<TValues> | null {
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

/**
 * 规范化校验规则：空数组视为无规则，其他规则保持原声明。
 *
 * 规则本身不在此处做深层校验或转换，仅做 nullish/空数组到 `undefined` 的归一化。
 *
 * @param rules - 原始 rules 配置。
 * @returns 规范化后的 rules，或 `undefined` 表示无规则。
 */
function normalizeValidationRules<TValues extends Values>(
  rules: FieldRules<TValues, NamePath<TValues>> | undefined
): FieldRules<TValues, NamePath<TValues>> | undefined {
  if (rules == null) {
    return undefined
  }

  if (Array.isArray(rules)) {
    return rules.length > 0 ? rules : undefined
  }

  return rules
}

/**
 * 生成 descriptor 的稳定 key。
 *
 * 优先使用 schema 上显式指定的 key；普通字段使用 name 保持身份稳定，
 * group 和 dependency 按类型前缀与层级路径自动生成。
 * 依赖描述符的 key 中嵌入 trigger 字段列表，使得 trigger 变化时 key 改变，触发协调器重新挂载。
 *
 * @param schema - schema 字段配置联合类型。
 * @param index - schema 在同级列表中的位置。
 * @param parentKey - 父级 descriptor key。
 * @returns 分组 descriptor key。
 */
function createDescriptorKey<TValues extends Values = Values>(
  schema: SchemxField<TValues>,
  index: number,
  parentKey: string | undefined
): string {
  const currentKey = schema.key

  // 依赖描述符：key 中嵌入 trigger 字段串，使得 trigger 列表变化时 key 改变，触发重新挂载
  if (isDependencySchema(schema)) {
    const triggerKey = schema.to.map(serializeNamePath).join(",")

    const key = parentKey
      ? `dependency:${parentKey}/${index}/${triggerKey}`
      : `dependency:${index}/${triggerKey}`

    return currentKey ?? key
  }

  // 分组描述符：按层级路径生成 key
  if (isGroupSchema(schema)) {
    const key = parentKey ? `group:${parentKey}/${index}` : `group:${index}`

    return currentKey ?? key
  }

  // 字段描述符：使用必填的 name，避免同级 schema 插入或删除改变节点身份
  const nameKey = serializeNamePath(schema.name)

  return currentKey ?? (parentKey ? `field:${parentKey}/${nameKey}` : `field:${nameKey}`)
}

/**
 * 将 NamePath 序列化为字符串，数组用 `.` 连接。
 *
 * 例如 `["user", "address", "city"]` 序列化为 `"user.address.city"`。
 * 用于生成依赖描述符 key 中的 trigger 标识。
 *
 * @param name - 字段名路径。
 * @returns 序列化后的字符串。
 */
function serializeNamePath(name: NamePath): string {
  if (Array.isArray(name)) {
    return name.join(".")
  }

  return String(name)
}

/**
 * 把外部校验触发方式映射为内部 NormalizedTrigger，未识别值回落到 submit。
 *
 * 同时兼容 `onBlur`/`onChange`/`onSubmit`（组件库常见命名）和 `blur`/`change`/`submit`
 * 两种写法，统一为不带 `on` 前缀的短格式。
 *
 * @param trigger - 原始触发方式或其数组。
 * @returns 规范化后的触发方式或其数组。
 */
function normalizeTrigger(
  trigger: ValidationTrigger | ValidationTrigger[]
): NormalizedTrigger | NormalizedTrigger[] {
  const map: Record<ValidationTrigger, NormalizedTrigger> = {
    onBlur: "blur",
    onChange: "change",
    onSubmit: "submit",
    blur: "blur",
    change: "change",
    submit: "submit",
  }

  const TArray = Array.isArray(trigger) ? trigger : [trigger]

  return TArray.map((t) => map[t] ?? "submit")
}
