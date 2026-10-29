import { createSchemaCompiler } from ".."
import { createFormConfig } from "../../config/createFormConfig"
import {
  isDependencySchema,
  isDynamicSchema,
  isFieldSchema,
  isGroupSchema,
} from "../../utils"

import type { SchemaCompileResult } from ".."

/**
 * 编译配置的路径和回调值使用同一份表单类型。
 */
interface FormValues {
  /**
   * 邮箱字段。
   */
  email: string
  /**
   * 数组行字段。
   */
  users: {
    /**
     * 行内姓名。
     */
    name: string
  }[]
}

// 原始输入与编译输出保留表单值泛型。
const compiler = createSchemaCompiler<FormValues>({
  config: createFormConfig<FormValues>().getConfig(),
})

// @ts-expect-error Compiler 只消费显式传入的配置产物。
createSchemaCompiler<FormValues>()

const config: SchemaCompileResult<FormValues> = compiler.compile(
  { name: "email", label: "邮箱", componentType: "input" },
  "root",
  0
)

// 编译后的 Schema 保留稳定 key，并沿用原有 helper 收窄。
const schema = config.schema

const key: string = schema.key

void key

if (isFieldSchema(schema)) {
  // 字段 helper 可以读取字段专属配置。
  const renderer = schema.componentType

  void renderer
}

if (isGroupSchema(schema)) {
  void schema.children
}

if (isDependencySchema(schema)) {
  void schema.renderer
  void config.dynamicRow
}

if (isDynamicSchema(schema)) {
  void schema.item
}

// @ts-expect-error Schema 的分类信息不在编译结果顶层重复声明。
void config.type
// @ts-expect-error 稳定 key 只保存在编译后的 Schema 中。
void config.key
// @ts-expect-error 纯编译配置不持有节点 ID。
void config.id
// @ts-expect-error 纯编译配置不持有 Scope。
void config.scope
// @ts-expect-error 编译令牌只读，消费者不能改写缓存。
config.configToken = Symbol("changed")
// @ts-expect-error 节点创建只接受编译配置，旧的原始 Schema 签名已移除。
compiler.createNode({ name: "email", label: "邮箱", componentType: "input" }, "root", 0)
