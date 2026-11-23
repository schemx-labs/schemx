/**
 * 表单校验器。
 *
 * 管理校验规则（rules）和校验错误（errors），基于 Standard Schema 接口进行字段校验。
 * 使用 ReactiveMap 管理错误状态，支持 effect 自动追踪依赖。
 * 支持所有实现了 StandardSchemaV1 接口的验证库（Zod v4、Valibot、ArkType 等）。
 *
 * @module core/validator
 *
 * @example
 * ```typescript
 * import { createValidator } from '@schemx/core'
 *
 * const validator = createValidator()
 *
 * // 注册校验规则
 * validator.register('email', emailSchema)
 *
 * // 注册校验规则并指定空值提示
 * validator.register('address', addressSchema, '请输入收货地址')
 *
 * // 校验单个字段
 * const result = await validator.validateField('email', latestValues)
 * ```
 */

import { batchUpdates, createSignalMap } from "../reactivity"
import { getByPath } from "../utils"

import type { NamePath, StandardSchemaV1, Values } from "../types"

/**
 * 单个字段的校验错误。
 */
export interface FieldError {
  field: string
  message: string[]
}

/**
 * 表单校验失败结果。
 *
 * 包含所有失败字段以及校验时使用的值快照。
 */
export interface ValidateError<TValues extends Values = Values> {
  errors: FieldError[]
  values: TValues
}

/**
 * 表单校验结果。
 *
 * 成功分支返回通过校验的 values，失败分支返回字段错误集合。
 */
export type ValidateResult<TValues extends Values = Values> =
  | { ok: true; values: TValues }
  | { ok: false; error: ValidateError<TValues> }

/**
 * 校验规则条目。
 *
 * 包含一组 StandardSchemaV1 schema 和可选的空值默认错误提示。
 * 当字段值为 `undefined`/`null` 时，使用 `defaultMessage` 作为错误提示，
 * 避免验证库报出类型错误（如 Zod 的 "expected string, received undefined"）。
 */
export interface ValidateEntry<_TValues extends Values = Values> {
  /** 符合 StandardSchemaV1 接口的校验 schema 列表 */
  schemas: StandardSchemaV1[]
  /**
   * 空值（undefined/null）时的默认错误提示。
   *
   * 设置后，当字段值为 undefined/null 时直接返回此提示，不调用 schema 校验。
   * 未设置时将原始值直接传给 schema。
   */
  defaultMessage?: string
}

/**
 * 表单校验器。
 *
 * 不持有 store 引用，所有值由调用方传入。
 * 基于 Standard Schema 接口进行字段校验，支持同步和异步规则。
 * 兼容所有实现了 StandardSchemaV1 接口的验证库。
 *
 * 每个字段可配置 `defaultMessage`，当值为 `undefined`/`null` 时
 * 跳过 schema 校验并返回该提示，避免验证库报类型错误。
 *
 * @typeParam TValues - 表单值类型，默认为 Values
 *
 * @example
 * ```typescript
 * const validator = new Validator<Values>()
 * validator.register('email', emailSchema)
 * validator.register('address', addressSchema, '请输入收货地址')
 * const result = await validator.validateField('email', formValues)
 * ```
 *
 * @remarks
 * 校验规则通过纯 Map 管理，错误状态通过 ReactiveMap 管理，
 * 在 effect 内调用 getFieldError 时自动追踪依赖。
 */
class ValidatorImpl<
  TValues extends Values = Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
> {
  /** 校验规则映射表：字段路径 → 规则条目 */
  private rules = new Map<TName, ValidateEntry<TValues>>()

  /** 校验错误映射表：字段路径 → 错误信息数组（响应式） */
  private errors = createSignalMap<TName, string[]>()

  /**
   * 注册单个字段的校验规则。
   *
   * 支持传入单个 schema 或 schema 数组，多次调用会追加规则而非覆盖。
   *
   * @param path - 字段路径
   * @param rules - 单个或多个 StandardSchemaV1 校验 schema
   * @param defaultMessage - 可选，空值（undefined/null）时的默认错误提示
   *
   * @example
   * ```typescript
   * validator.register('email', emailSchema)
   * validator.register('name', [minLenSchema, maxLenSchema], '请输入姓名')
   * ```
   */
  public register(
    path: TName,
    rules: StandardSchemaV1 | StandardSchemaV1[],
    defaultMessage?: string
  ): void {
    const schemas = Array.isArray(rules) ? rules : [rules]
    const existing = this.rules.get(path)

    if (existing) {
      existing.schemas.push(...schemas)

      if (defaultMessage) {
        existing.defaultMessage = defaultMessage
      }
    } else {
      this.rules.set(path, { schemas, defaultMessage })
    }
  }

  /**
   * 注销单个字段的校验规则，同时清除该字段的错误信息。
   *
   * @param path - 字段路径
   *
   * @example
   * ```typescript
   * validator.unregister('email')
   * ```
   */
  public unregister(path: TName): void {
    this.rules.delete(path)
    this.errors.delete(path)
  }

  /**
   * 获取指定字段的错误信息。
   *
   * @param path - 字段路径
   * @returns 错误信息数组，无错误时返回 undefined
   *
   * @example
   * ```typescript
   * validator.getFieldError('email') // => ['邮箱格式不正确']
   * ```
   */
  public getFieldError(path: TName): string[] | undefined {
    return this.errors.get(path)
  }

  /**
   * 手动设置指定字段的错误信息。
   *
   * @param path - 字段路径
   * @param errors - 错误信息数组
   *
   * @example
   * ```typescript
   * validator.setFieldError('email', ['该邮箱已被注册'])
   * ```
   */
  public setFieldError(path: TName, errors: string[]): void {
    this.errors.set(path, errors)
  }

  /**
   * 校验指定字段。
   *
   * 支持传入单个路径或路径数组，逐个校验后返回汇总结果。
   *
   * @param path - 字段路径或路径数组
   * @param latestValues - 当前表单全量值
   * @returns 校验结果
   *
   * @example
   * ```typescript
   * const result = await validator.validateField('email', formValues)
   * const result = await validator.validateField(['name', 'email'], formValues)
   *
   * if (!result.ok) console.log(result.error.errors)
   * ```
   */
  async validateField(
    path: TName | TName[],
    latestValues: TValues
  ): Promise<ValidateResult<TValues>> {
    const paths = (Array.isArray(path) ? path : [path]) as TName[]

    this.reset(paths)

    let allValid = true

    for (const p of paths) {
      const result = await this.validateSingleRule(p as TName, latestValues)
      if (!result.ok) allValid = false
    }

    return this.buildResult(allValid, latestValues)
  }

  /**
   * 校验所有已注册规则的字段。
   *
   * 校验前清空所有错误，逐个校验后返回汇总结果。
   *
   * @param latestValues - 当前表单全量值
   * @returns 校验结果
   *
   * @example
   * ```typescript
   * const result = await validator.validate(formValues)
   * if (result.ok) submit(result.values)
   * ```
   */
  async validate(latestValues: TValues): Promise<ValidateResult<TValues>> {
    let allValid = true

    this.reset()

    for (const path of this.rules.keys()) {
      const result = await this.validateSingleRule(path, latestValues)
      if (!result.ok) allValid = false
    }

    return this.buildResult(allValid, latestValues)
  }

  /**
   * 重置所有字段的校验错误。
   *
   * 清空 errors 映射表，不影响已注册的校验规则。
   *
   * @param paths - 可选的字段路径数组；不传时重置所有已注册字段。
   *
   * @example
   * ```typescript
   * validator.resetErrors()
   * ```
   */
  public reset(paths?: TName[]): void {
    if (paths) {
      batchUpdates(() => {
        for (const key of paths) {
          this.errors.set(key, [])
        }
      })

      return
    }

    // 无参数时：为所有已注册 rules 的字段初始化 error reactive value（设为 []），
    // 确保 effect 能追踪到具体字段的 reactive value 而非仅依赖 version。
    // 同时清除不在 rules 中但已有 error 的字段（如手动 setFieldError 的残留）。
    batchUpdates(() => {
      for (const key of this.rules.keys()) {
        this.errors.set(key, [])
      }

      for (const key of [...this.errors.keys()]) {
        if (!this.rules.has(key)) {
          this.errors.delete(key)
        }
      }
    })
  }

  /**
   * 根据校验结果构建 ValidateResult 返回值。
   *
   * @param ok - 校验是否全部通过
   * @param latestValues - 当前表单全量值
   * @returns 统一的校验结果对象
   */
  private buildResult(ok: boolean, latestValues: TValues): ValidateResult<TValues> {
    if (ok) {
      return { ok: true, values: latestValues }
    }

    return {
      ok: false,
      error: {
        errors: Array.from(this.errors.keys()).map((field) => ({
          field: field as string,
          message: this.errors.peek(field) || [],
        })),
        values: latestValues,
      },
    }
  }

  /**
   * 记录字段错误并返回失败结果。
   *
   * @param path - 字段路径
   * @param messages - 错误信息数组
   * @param latestValues - 当前表单全量值
   * @returns 失败的校验结果
   */
  private failResult(
    path: TName,
    messages: string[],
    latestValues: TValues
  ): ValidateResult<TValues> {
    this.errors.set(path, messages)

    return {
      ok: false,
      error: {
        errors: [{ field: path as string, message: messages }],
        values: latestValues,
      },
    }
  }

  /**
   * 校验单个字段的所有规则。
   *
   * 依次执行该字段注册的所有 schema，遇到第一个失败即返回错误。
   * 若值为 undefined/null 且配置了 defaultMessage，直接返回失败结果。
   *
   * @param path - 字段路径
   * @param latestValues - 当前表单全量值
   * @returns 校验结果
   */
  private async validateSingleRule(
    path: TName,
    latestValues: TValues
  ): Promise<ValidateResult<TValues>> {
    const entry = this.rules.get(path)

    if (!entry || entry.schemas.length === 0) {
      this.errors.delete(path)

      return { ok: true, values: latestValues }
    }

    const value = getByPath(latestValues, path)

    const allMessages: string[] = []

    // 空值拦截：当值为 undefined/null 且配置了 defaultMessage 时，
    // 直接返回该字段的默认错误提示，避免验证库报类型错误
    if ((value === undefined || value === null) && entry.defaultMessage) {
      allMessages.push(entry.defaultMessage)
    }

    // 解析快捷规则（如 createRequiredRule）
    for (const schema of entry.schemas) {
      try {
        const result = await schema["~standard"].validate(value)

        if (result.issues) {
          allMessages.push(...result.issues.map((i: { message: any }) => i.message))
        }
      } catch (error) {
        console.warn(`[Validator] 校验字段 "${path}" 时发生错误:`, error)
        allMessages.push("校验失败")
      }
    }

    if (allMessages.length > 0) {
      return this.failResult(path, allMessages, latestValues)
    }

    this.errors.delete(path)

    return { ok: true, values: latestValues }
  }
}

/**
 * Validator 的实例类型。
 */
export type Validator<
  TValues extends Values = Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
> = InstanceType<typeof ValidatorImpl<TValues, TName>>

/**
 * 创建 Validator 实例的工厂函数。
 *
 * @typeParam TValues - 表单值类型
 *
 * @returns Validator 实例
 *
 * @example
 * ```typescript
 * const validator = createValidator<Values>()
 * ```
 */
export function createValidator<
  TValues extends Values = Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
>(): Validator<TValues, TName> {
  return new ValidatorImpl<TValues, TName>()
}
