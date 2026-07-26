/**
 * 校验器适配器 v1 类型定义。
 *
 * 定义第三方校验器接入 Schemx Validator 的通用协议。适配器负责识别其规则声明，
 * 并将其转换为 Core 可执行的 {@link ValidationRule}。
 *
 * @module types/validationAdapter
 */

import type { NamePath, Values } from "./form"
import type { ValidationRule } from "./validation"

// eslint-disable-next-line @typescript-eslint/no-namespace
export declare namespace ValidationAdapterV1 {
  /** adapter 的唯一标识。 */
  type ID = string | symbol

  /**
   * 由 adapter 创建的品牌规则声明。
   *
   * 规则的来源必须由 adapter 实例自行验证；对象形状相同不代表由该实例创建。
   */
  interface Rule {
    /** 创建规则的 adapter 标识，仅供诊断使用。 */
    readonly adapterId: ID
    /** 仅由创建该规则的 adapter 解释的输入。 */
    readonly payload: unknown
  }

  /**
   * adapter 可接收的规则声明。
   *
   * 品牌 adapter 通常只接收 {@link Rule}；自描述 adapter 也可直接接收其原始规则输入。
   */
  type RuleInput<Input = unknown> = Rule | Input

  /** adapter 在解析规则时可读取的字段元数据。 */
  interface ResolveContext<
    TValues extends Values = Values,
    TName extends NamePath<TValues> = NamePath<TValues>,
  > {
    readonly name: TName
    readonly label: string
  }

  /**
   * 校验器适配器的属性协议。
   *
   * @typeParam Input - adapter 接收的规则输入类型。
   */
  interface Props<Input = unknown> {
    /** 在单个 Form 内唯一的 adapter 标识。 */
    readonly id: ID
    /** 将输入包装为品牌规则；自描述规则 adapter 可省略此方法。 */
    rule?(input: Input): Rule
    /** 判断值是否应由当前 adapter 处理。 */
    isRule(value: unknown): boolean
    /** 将规则声明转换为 Core 可执行的原生校验规则。 */
    resolve<
      TValue = unknown,
      TValues extends Values = Values,
      TName extends NamePath<TValues> = NamePath<TValues>,
    >(
      rule: RuleInput<Input>,
      context: ResolveContext<TValues, TName>
    ): readonly ValidationRule<TValue, TValues, TName>[]
  }
}

/**
 * 校验器适配器 v1 接口。
 *
 * 第三方校验库可仅依赖此规范实现适配器，并通过 Form 或全局配置注册。
 *
 * @typeParam Input - adapter 接收的规则输入类型。
 */
export interface ValidationAdapterV1<
  Input = unknown,
> extends ValidationAdapterV1.Props<Input> {}
