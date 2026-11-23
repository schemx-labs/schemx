/**
 * 内置默认校验规则工厂。
 *
 * 提供轻量的内置校验 schema 构造函数，
 * 用于替代直接依赖 Zod 等第三方库构造必填规则。
 *
 * @module core/validator/defaultRules
 *
 * @example
 * ```ts
 * import {
 *   createRequiredRule,
 *   createSelectRequiredRule,
 *   createUploadRequiredRule
 * } from '@schemx/core'
 *
 * // 在 validatorRegistry 中注册
 * const registry = createValidatorsRegistry()
 * registry.registerAll({
 *   required: createRequiredRule,
 *   selectRequired: createSelectRequiredRule,
 *   uploadRequired: createUploadRequiredRule
 * })
 *
 * // 在 schemas 中使用（通过名称引用）
 * const schemas = [
 *   {
 *     name: 'username',
 *     label: '用户名',
 *     componentType: 'input',
 *     rules: ['required'] // 使用内置规则
 *   },
 *   {
 *     name: 'city',
 *     label: '城市',
 *     componentType: 'select',
 *     rules: ['selectRequired']
 *   },
 *   {
 *     name: 'avatar',
 *     label: '头像',
 *     componentType: 'upload',
 *     rules: ['uploadRequired']
 *   }
 * ]
 *
 * // 直接使用（不通过 registry）
 * const schema = { name: 'username', label: '用户名', componentType: 'input' }
 * const rule = createRequiredRule(schema)
 * const result = rule['~standard'].validate('')
 * // result => { issues: [{ message: '请输入用户名' }] }
 * ```
 */

import type { SchemxBaseField, StandardSchemaV1, Values } from "../types"

/**
 * 创建内置必填校验 schema。
 *
 * 返回一个符合 StandardSchemaV1 接口的轻量校验对象。
 * 当值为 `undefined`、`null` 或空字符串时校验失败，返回包含提示信息的 issues。
 *
 * @param schema - 字段 schema，用于从 label 生成默认提示文案。
 *
 * @returns 符合 StandardSchemaV1 接口的必填校验 schema
 *
 * @example
 * ```ts
 * const schema = createRequiredRule({ label: '用户名', ... })
 *
 * schema['~standard'].validate('')        // => { issues: [{ message: '请输入用户名' }] }
 * schema['~standard'].validate(undefined) // => { issues: [{ message: '请输入用户名' }] }
 * schema['~standard'].validate('hello')   // => { value: 'hello' }
 * ```
 */
export function createRequiredRule<TValues extends Values = Values>(
  schema?: SchemxBaseField<TValues>
): StandardSchemaV1<unknown, unknown> {
  /**
   * 校验空值并返回 Standard Schema v1 结果。
   */
  const validate = (value: unknown): StandardSchemaV1.Result<unknown> => {
    if (value === undefined || value === null || value === "") {
      const label = schema?.label ?? ""

      return standardIssueResult(label ? `请输入${label}` : "此项为必填项")
    }

    return standardValueResult(value)
  }

  return buildStandardSchema(validate)
}

/**
 * 创建选择类必填校验 schema。
 *
 * 适用于下拉选择、级联选择等组件。
 * 当值为 `undefined`、`null`、空字符串或空数组时校验失败。
 *
 * @param schema - 字段 schema，用于从 label 生成默认提示文案。
 *
 * @returns 符合 StandardSchemaV1 接口的选择必填校验 schema
 *
 * @example
 * ```ts
 * const schema = createSelectRequiredRule({ label: '城市', ... })
 *
 * schema['~standard'].validate(undefined) // => { issues: [{ message: '请选择城市' }] }
 * schema['~standard'].validate(null)      // => { issues: [{ message: '请选择城市' }] }
 * schema['~standard'].validate('')        // => { issues: [{ message: '请选择城市' }] }
 * schema['~standard'].validate([])        // => { issues: [{ message: '请选择城市' }] }
 * schema['~standard'].validate('beijing') // => { value: 'beijing' }
 * schema['~standard'].validate([1, 2])    // => { value: [1, 2] }
 * ```
 */
export function createSelectRequiredRule<TValues extends Values = Values>(
  schema?: SchemxBaseField<TValues>
): StandardSchemaV1 {
  /**
   * 校验选择类空值并返回 Standard Schema v1 结果。
   */
  const validate = (value: unknown): StandardSchemaV1.Result<unknown> => {
    if (
      value === undefined ||
      value === null ||
      value === "" ||
      (Array.isArray(value) && value.length === 0)
    ) {
      const label = schema?.label ?? ""

      return standardIssueResult(label ? `请选择${label}` : "此项为必选项")
    }

    return standardValueResult(value)
  }

  return buildStandardSchema(validate)
}

/**
 * 创建上传类必填校验 schema。
 *
 * 适用于文件上传组件，值通常为数组。
 * 当值为 `undefined`、`null` 或空数组时校验失败。
 *
 * @param schema - 字段 schema，用于从 label 生成默认提示文案。
 *
 * @returns 符合 StandardSchemaV1 接口的上传必填校验 schema
 *
 * @example
 * ```ts
 * const schema = createUploadRequiredRule({ label: '文件', ... })
 *
 * schema['~standard'].validate(undefined) // => { issues: [{ message: '请上传文件' }] }
 * schema['~standard'].validate(null)      // => { issues: [{ message: '请上传文件' }] }
 * schema['~standard'].validate([])        // => { issues: [{ message: '请上传文件' }] }
 * schema['~standard'].validate([file])    // => { value: [file] }
 * ```
 */
export function createUploadRequiredRule<TValues extends Values = Values>(
  schema?: SchemxBaseField<TValues>
): StandardSchemaV1<unknown, unknown> {
  /**
   * 校验上传类空值并返回 Standard Schema v1 结果。
   */
  const validate = (value: unknown): StandardSchemaV1.Result<unknown> => {
    if (
      value === undefined ||
      value === null ||
      (Array.isArray(value) && value.length === 0)
    ) {
      const label = schema?.label ?? ""

      return standardIssueResult(label ? `请上传${label}` : "此项为必传项")
    }

    return standardValueResult(value)
  }

  return buildStandardSchema(validate)
}

const buildStandardSchema = (
  validate: StandardSchemaV1.Props["validate"]
): StandardSchemaV1<unknown, unknown> => {
  return {
    "~standard": {
      version: 1,
      vendor: "schemx",
      validate,
    },
  }
}

const standardIssueResult = (message: string): StandardSchemaV1.Result<unknown> => {
  return {
    issues: [{ message }],
  }
}

const standardValueResult = (value: unknown): StandardSchemaV1.Result<unknown> => {
  return { value }
}
