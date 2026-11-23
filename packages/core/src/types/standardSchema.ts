/**
 * Standard Schema v1 类型定义。
 *
 * 基于 [Standard Schema](https://github.com/standard-schema/standard-schema) 规范，
 * 定义通用的校验接口，使表单系统不再绑定任何特定验证库。
 * 任何实现了该接口的验证库（Zod v4、Valibot、ArkType 等）都可以与表单系统集成。
 *
 * @module types/standardSchema
 */

// eslint-disable-next-line @typescript-eslint/no-namespace
export declare namespace StandardSchemaV1 {
  /**
   * Schema 属性接口。
   *
   * 包含版本号、供应商标识、校验方法和可选的类型信息。
   *
   * @typeParam Input - 输入值类型
   * @typeParam Output - 输出值类型
   */
  interface Props<Input = unknown, Output = Input> {
    readonly version: 1
    readonly vendor: string
    readonly validate: (value: unknown) => Result<Output> | Promise<Result<Output>>
    readonly types?: Types<Input, Output>
  }

  /**
   * 校验结果类型。
   *
   * 成功时包含 `value` 字段，失败时包含 `issues` 数组。
   * 两种形态互斥，通过可辨识联合类型区分。
   *
   * @typeParam Output - 输出值类型
   */
  type Result<Output = unknown> =
    | { readonly value: Output; readonly issues?: undefined }
    | { readonly issues: ReadonlyArray<Issue>; readonly value?: undefined }

  /**
   * 校验问题接口。
   *
   * 描述单个校验失败的详细信息。
   */
  interface Issue {
    /** 错误提示信息 */
    readonly message: string
    /** 可选的字段路径，标识问题发生的位置 */
    readonly path?: ReadonlyArray<PropertyKey | PathSegment>
  }

  /**
   * 路径段接口。
   *
   * 用于描述嵌套对象中的路径节点。
   */
  interface PathSegment {
    readonly key: PropertyKey
  }

  /**
   * 类型信息接口。
   *
   * 用于在类型层面携带输入/输出类型信息，运行时不使用。
   *
   * @typeParam Input - 输入值类型
   * @typeParam Output - 输出值类型
   */
  interface Types<Input = unknown, Output = Input> {
    readonly input?: Input
    readonly output?: Output
  }

  /**
   * 从 StandardSchemaV1 实例中提取输入类型。
   *
   * @typeParam T - StandardSchemaV1 实例类型
   */
  type InferInput<T extends StandardSchemaV1> = NonNullable<
    T["~standard"]["types"]
  >["input"]

  /**
   * 从 StandardSchemaV1 实例中提取输出类型。
   *
   * @typeParam T - StandardSchemaV1 实例类型
   */
  type InferOutput<T extends StandardSchemaV1> = NonNullable<
    T["~standard"]["types"]
  >["output"]
}

/**
 * Standard Schema v1 接口。
 *
 * 定义了验证库互操作的统一协议。
 * 校验库只需实现 `~standard` 属性即可与表单系统集成。
 *
 * @typeParam Input - 输入值类型
 * @typeParam Output - 输出值类型，默认与 Input 相同
 */
export interface StandardSchemaV1<Input = unknown, Output = Input> {
  readonly "~standard": StandardSchemaV1.Props<Input, Output>
}
