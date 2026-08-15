import { createSignalMap } from "../reactivity"
import { createFieldKey } from "../utils"

import type { NamePath, Values } from "../types"
import type { ValidationRuleIssue } from "./types"

/**
 * 单个字段按来源保存的错误状态。
 */
interface FieldErrorRecord<TValues extends Values> {
  // 用于向公开结果还原的原始字段路径。
  readonly name: NamePath<TValues>
  // 由当前可执行规则生成的错误。
  readonly validation: readonly ValidationRuleIssue[]
  // 由规则配置解析失败生成的错误。
  readonly configuration: readonly ValidationRuleIssue[]
  // 由服务端或调用方显式写入的错误。
  readonly external: readonly ValidationRuleIssue[]
}

/**
 * 字段路径与问题列表的批量操作条目。
 */
interface FieldIssuesEntry<TValues extends Values> {
  readonly name: NamePath<TValues>
  readonly issues: readonly ValidationRuleIssue[]
}

/**
 * 字段路径与消息列表的批量操作条目。
 */
interface FieldMessagesEntry<TValues extends Values> {
  readonly name: NamePath<TValues>
  readonly messages: readonly string[]
}

/**
 * 管理字段配置、运行期校验与外部错误的响应式仓库。
 *
 * @typeParam TValues - 所属表单的值类型。
 */
export class FieldErrorStore<TValues extends Values> {
  // 按稳定字段身份保存的响应式错误记录。
  private readonly records = createSignalMap<string, FieldErrorRecord<TValues>>()

  /**
   * 返回一个字段按展示顺序合并后的完整问题。
   *
   * @param name - 要读取的字段路径。
   * @returns configuration、validation、external 顺序合并的只读快照。
   */
  public getIssues(name: NamePath<TValues>): readonly ValidationRuleIssue[] {
    // 当前字段按稳定身份保存的错误记录。
    const record = this.records.get(createFieldKey(name))

    return record
      ? [...record.configuration, ...record.validation, ...record.external]
      : []
  }

  /**
   * 返回多个字段按展示顺序合并后的完整问题。
   *
   * 未传入字段路径时只返回当前仍有问题的字段；传入路径时按传入顺序返回，
   * 即使某个字段没有问题也会包含空数组。
   *
   * @param names - 可选的字段路径数组。
   * @returns 包含字段路径和问题列表的只读快照。
   */
  public getFieldsIssues(
    names?: readonly NamePath<TValues>[]
  ): readonly FieldIssuesEntry<TValues>[] {
    const targetNames = names ?? this.entries().map((entry) => entry.name)

    return targetNames.map((name) => ({
      name,
      issues: this.getIssues(name),
    }))
  }

  /**
   * 返回一个字段可直接展示的消息快照。
   *
   * @param name - 要读取的字段路径。
   * @returns 所有问题的 message 数组。
   */
  public getMessages(name: NamePath<TValues>): readonly string[] {
    return this.getIssues(name).map((issue) => issue.message)
  }

  /**
   * 返回多个字段可直接展示的消息快照。
   *
   * 未传入字段路径时只返回当前仍有问题的字段；传入路径时按传入顺序返回，
   * 即使某个字段没有问题也会包含空数组。
   *
   * @param names - 可选的字段路径数组。
   * @returns 包含字段路径和消息列表的只读快照。
   */
  public getFieldsMessages(names?: readonly NamePath<TValues>[]): readonly {
    readonly name: NamePath<TValues>
    readonly messages: readonly string[]
  }[] {
    const targetNames = names ?? this.entries().map((entry) => entry.name)

    return targetNames.map((name) => ({
      name,
      messages: this.getMessages(name),
    }))
  }

  /**
   * 用本次规则执行结果覆盖字段的 validation 来源。
   *
   * @param name - 要写入的字段路径。
   * @param issues - 本次规则产生的问题；空数组会清除该来源。
   */
  public replaceValidation(
    name: NamePath<TValues>,
    issues: readonly ValidationRuleIssue[]
  ): void {
    this.write(name, issues, undefined, undefined)
  }

  /**
   * 批量覆盖多个字段的 validation 来源。
   *
   * @param fields - 字段路径及其本次规则产生的问题。
   */
  public replaceFieldsValidation(fields: readonly FieldIssuesEntry<TValues>[]): void {
    for (const field of fields) {
      this.replaceValidation(field.name, field.issues)
    }
  }

  /**
   * 用规则配置解析结果覆盖字段的 configuration 来源。
   *
   * @param name - 要写入的字段路径。
   * @param issues - 配置问题；空数组会清除该来源。
   */
  public replaceConfiguration(
    name: NamePath<TValues>,
    issues: readonly ValidationRuleIssue[]
  ): void {
    this.write(name, undefined, undefined, issues)
  }

  /**
   * 批量覆盖多个字段的 configuration 来源。
   *
   * @param fields - 字段路径及其规则配置问题。
   */
  public replaceFieldsConfiguration(fields: readonly FieldIssuesEntry<TValues>[]): void {
    for (const field of fields) {
      this.replaceConfiguration(field.name, field.issues)
    }
  }

  /**
   * 用调用方提供的消息覆盖字段的 external 来源。
   *
   * @param name - 要写入的字段路径。
   * @param messages - 外部消息；空数组会清除该来源。
   */
  public replaceExternal(name: NamePath<TValues>, messages: readonly string[]): void {
    this.write(
      name,
      undefined,
      messages.map((message) => ({ message, code: "external" })),
      undefined
    )
  }

  /**
   * 批量覆盖多个字段的 external 来源。
   *
   * @param fields - 字段路径及其外部错误消息。
   */
  public replaceFieldsExternal(fields: readonly FieldMessagesEntry<TValues>[]): void {
    for (const field of fields) {
      this.replaceExternal(field.name, field.messages)
    }
  }

  /**
   * 清除一个字段的 validation 来源。
   *
   * @param name - 要清除的字段路径。
   */
  public clearValidation(name: NamePath<TValues>): void {
    this.write(name, [], undefined, undefined)
  }

  /**
   * 批量清除多个字段的 validation 来源。
   *
   * @param names - 要清除 validation 问题的字段路径数组。
   */
  public clearFieldsValidation(names: readonly NamePath<TValues>[]): void {
    for (const name of names) {
      this.clearValidation(name)
    }
  }

  /**
   * 清除一个字段的 configuration 来源。
   *
   * @param name - 要清除的字段路径。
   */
  public clearConfiguration(name: NamePath<TValues>): void {
    this.write(name, undefined, undefined, [])
  }

  /**
   * 批量清除多个字段的 configuration 来源。
   *
   * @param names - 要清除 configuration 问题的字段路径数组。
   */
  public clearFieldsConfiguration(names: readonly NamePath<TValues>[]): void {
    for (const name of names) {
      this.clearConfiguration(name)
    }
  }

  /**
   * 清除一个字段的全部错误来源。
   *
   * @param name - 要清除的字段路径。
   */
  public clearField(name: NamePath<TValues>): void {
    this.records.delete(createFieldKey(name))
  }

  /**
   * 批量清除多个字段的全部错误来源。
   *
   * @param names - 要清除错误的字段路径数组。
   */
  public clearFields(names: readonly NamePath<TValues>[]): void {
    for (const name of names) {
      this.clearField(name)
    }
  }

  /**
   * 清除全部字段的所有错误来源。
   */
  public clear(): void {
    this.records.clear()
  }

  /**
   * 返回所有仍有错误的字段快照。
   *
   * @returns 包含原始字段路径和合并问题的只读数组。
   */
  public entries(): readonly {
    readonly name: NamePath<TValues>
    readonly issues: readonly ValidationRuleIssue[]
  }[] {
    return Array.from(this.records.entries(), ([, record]) => ({
      name: record.name,
      issues: [...record.configuration, ...record.validation, ...record.external],
    })).filter((entry) => entry.issues.length > 0)
  }

  /**
   * 合并并写入一个字段的三个来源；未传入的来源保持原值。
   */
  private write(
    name: NamePath<TValues>,
    validation: readonly ValidationRuleIssue[] | undefined,
    external: readonly ValidationRuleIssue[] | undefined,
    configuration: readonly ValidationRuleIssue[] | undefined
  ): void {
    // 用稳定身份读取已有来源，避免数组路径按引用丢失记录。
    const key = createFieldKey(name)

    // 当前字段的三类错误快照。
    const current = this.records.peek(key)

    // 用新来源和保留来源合成下一条记录。
    const next: FieldErrorRecord<TValues> = {
      name: current?.name ?? name,
      validation:
        validation === undefined ? (current?.validation ?? []) : [...validation],
      configuration:
        configuration === undefined ? (current?.configuration ?? []) : [...configuration],
      external: external === undefined ? (current?.external ?? []) : [...external],
    }

    if (
      next.validation.length === 0 &&
      next.configuration.length === 0 &&
      next.external.length === 0
    ) {
      this.records.delete(key)

      return
    }

    this.records.set(key, next)
  }
}
