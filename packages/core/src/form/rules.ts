import { isFieldNode } from "../node"
import { isFieldInteractive } from "../utils/validation"

import type { FormConfigModel } from "../config/createFormConfig"
import type { NodeManager, ResolvedFieldSchema } from "../node"
import type { PresetRuleRegistry } from "../registry"
import type { NamePath, SchemxFormApi, SchemxInstance, Values } from "../types"
import type { FieldValidationConfig, Validator } from "../validator"

/**
 * 手动规则覆盖及命名规则的公开方法。
 * @typeParam TValues - 表单值类型。
 */
export type FormRulesApi<TValues extends Values> = Pick<
  SchemxInstance<TValues>,
  | "setFieldRules"
  | "setFieldsRules"
  | "removeFieldRules"
  | "removeFieldsRules"
  | "getPresetRule"
  | "registerPresetRule"
  | "hasPresetRule"
>

/**
 * 规则元数据及命名规则的依赖。
 * @typeParam TValues - 表单值类型。
 */
export interface CreateFormRulesOptions<TValues extends Values> {
  /**
   * 校验域创建并共享的校验器。
   */
  readonly validator: Validator<TValues>
  /**
   * 手动字段读取默认配置的来源。
   */
  readonly configuration: FormConfigModel<TValues>
  /**
   * 当前字段配置及稳定身份的索引。
   */
  readonly nodeManager: NodeManager<TValues>
  /**
   * 当前 Form 使用的命名规则表。
   */
  readonly presetRuleRegistry: PresetRuleRegistry
}

/**
 * 公开规则操作及校验编排使用的元数据能力。
 * @typeParam TValues - 表单值类型。
 */
export interface FormRules<TValues extends Values> {
  /**
   * 手动覆盖和命名规则的公开入口。
   */
  readonly api: FormRulesApi<TValues>
  /**
   * 读取字段当前配置，手动字段回退至表单默认值。
   * @param name - 当前字段路径。
   * @example const context = rules.getFieldContext("name")
   */
  getFieldContext(name: NamePath<TValues>): Partial<ResolvedFieldSchema<TValues>>
  /**
   * 在显式校验前刷新 Schema 字段元数据，手动字段保持原有配置。
   * @param name - 当前字段路径。
   * @example rules.updateFieldConfig("name")
   */
  updateFieldConfig(name: NamePath<TValues>): void
}

/**
 * 创建规则覆盖、命名规则和校验元数据操作。
 * @typeParam TValues - 表单值类型。
 * @param options - 校验器、字段索引和规则表。
 * @example const rules = createFormRules({ validator, configuration, nodeManager, presetRuleRegistry })
 */
export function createFormRules<TValues extends Values>(
  options: CreateFormRulesOptions<TValues>
): FormRules<TValues> {
  // 元数据始终按当前路径从同一节点索引读取。
  const { validator, configuration, nodeManager, presetRuleRegistry } = options

  /**
   * 公开路径入口通过共享节点索引解析字段身份。
   * @param name - 要读取 Schema 校验配置的当前路径。
   */
  const getSchemaContext = (
    name: NamePath<TValues>
  ): ResolvedFieldSchema<TValues> | undefined => {
    // 运行时字段路径唯一；无 Schema 的路径继续走手动字段配置。
    const [nodeId] = nodeManager.getNodeIds(name)

    // 路径可能对应数组根或数组行，只有活动普通字段提供字段配置。
    const node = nodeId === undefined ? undefined : nodeManager.get(nodeId)

    return isFieldNode(node) && !node.disposed.value
      ? node.resolvedSchema.value
      : undefined
  }

  /**
   * 无 Schema 的手动字段使用同一份表单默认配置。
   * @param name - 当前字段路径。
   */
  const getFieldContext = (
    name: NamePath<TValues>
  ): Partial<ResolvedFieldSchema<TValues>> =>
    getSchemaContext(name) ?? configuration.getConfig().schemaConfig

  /**
   * 为 Schema 校验与手动规则构造同一份元数据。
   * @typeParam TName - 当前字段路径。
   * @param name - 要更新校验元数据的字段路径。
   * @param context - Runtime 的当前 Schema；手动字段缺省时保持默认激活状态。
   */
  const createFieldValidationConfig = <TName extends NamePath<TValues>>(
    name: TName,
    context: ResolvedFieldSchema<TValues> | undefined
  ): FieldValidationConfig<TValues, TName> => ({
    name,
    label: context?.label ?? "",
    placeholder: context?.placeholder ?? "",
    // Runtime 已按当前路径定位字段；断言只恢复该路径对应的值类型。
    required: (context?.required ?? false) as FieldValidationConfig<
      TValues,
      TName
    >["required"],
    active: context === undefined || isFieldInteractive(context),
  })

  // 手动规则覆盖复用与显式校验相同的字段元数据解析。
  const setFieldRules: FormRulesApi<TValues>["setFieldRules"] = (name, rules) => {
    validator.setFieldConfig(createFieldValidationConfig(name, getSchemaContext(name)))
    validator.setManualFieldRules(name, rules)
  }

  /**
   * 批量设置手动规则覆盖。
   * @param fields - 字段地址及其消费端规则。
   * @example formApi.setFieldsRules([{ name: "email", rules: [] }])
   */
  const setFieldsRules: SchemxFormApi<TValues>["setFieldsRules"] = (fields) => {
    // field 是本次设置的字段和规则。
    for (const field of fields) {
      setFieldRules(field.name, field.rules)
    }
  }

  /**
   * 批量撤销手动规则覆盖，保留 Schema 原始规则。
   * @param names - 需要撤销覆盖的字段地址。
   * @example formApi.removeFieldsRules(["email"])
   */
  const removeFieldsRules: SchemxFormApi<TValues>["removeFieldsRules"] = (names) => {
    // name 是当前要撤销覆盖的字段。
    for (const name of names) {
      validator.removeManualFieldRules(name)
    }
  }

  // Form 支持运行期规则名称；Registry 的类型增强只约束其直接调用者。
  const getPresetRule = presetRuleRegistry.get.bind(
    presetRuleRegistry
  ) as SchemxInstance<TValues>["getPresetRule"]

  // 命名规则在运行期按字符串保存，此边界保留 Form 原有的注册契约。
  const registerPresetRule = presetRuleRegistry.register.bind(
    presetRuleRegistry
  ) as SchemxInstance<TValues>["registerPresetRule"]

  /**
   * 显式校验仅刷新仍然挂载的 Schema 字段。
   * @param name - 要校验的当前字段路径。
   */
  const updateFieldConfig = (name: NamePath<TValues>): void => {
    const context = getSchemaContext(name)

    if (context) {
      validator.setFieldConfig(createFieldValidationConfig(name, context))
    }
  }

  // 手动规则与命名规则共用原始校验器及 Registry。
  const api: FormRulesApi<TValues> = {
    setFieldRules,
    setFieldsRules,
    removeFieldRules: validator.removeManualFieldRules.bind(validator),
    removeFieldsRules,
    getPresetRule,
    registerPresetRule,
    hasPresetRule: presetRuleRegistry.has.bind(presetRuleRegistry),
  }

  return { api, getFieldContext, updateFieldConfig }
}
