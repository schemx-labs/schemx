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
   * 返回一个字段可直接展示的消息快照。
   *
   * @param name - 要读取的字段路径。
   * @returns 所有问题的 message 数组。
   */
  public getMessages(name: NamePath<TValues>): readonly string[] {
    return this.getIssues(name).map((issue) => issue.message)
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
   * 清除一个字段的 validation 来源。
   *
   * @param name - 要清除的字段路径。
   */
  public clearValidation(name: NamePath<TValues>): void {
    this.write(name, [], undefined, undefined)
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
   * 清除一个字段的全部错误来源。
   *
   * @param name - 要清除的字段路径。
   */
  public clearField(name: NamePath<TValues>): void {
    this.records.delete(createFieldKey(name))
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
