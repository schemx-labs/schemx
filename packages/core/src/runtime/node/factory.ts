/**
 * 每个表单独占的运行节点与动态行工厂。
 * @module core/runtime/node/factory
 */

import { isDependencySchema, isDynamicSchema, isGroupSchema } from "../../utils"
import { createDependencyNode } from "../dependencies/createNode"
import { createDynamicNode } from "../dynamic/createNode"
import { createFieldNode } from "../field/createNode"
import { createGroupNode } from "../group/createNode"

import type { DynamicRowState, NodeId, SchemaNode } from "./types"
import type { Scope } from "../../scope"
import type { Values } from "../../types"
import type { SchemaCompileResult } from "../compiler/types"

/**
 * 数组行工厂接收的位置与 Store key；身份由节点工厂分配。
 */
export interface CreateDynamicRowOptions {
  /**
   * Store 提供的稳定行 key。
   */
  readonly key: string
  /**
   * 当前数组索引。
   */
  readonly index: number
  /**
   * 当前行的完整数据路径。
   */
  readonly path: string
}

/**
 * 单类 Node 工厂接收已编译配置，仅创建对应运行态。
 *
 * @typeParam TSchema - 当前工厂接受的已编译 Schema 类型。
 */
export interface SchemaNodeFactoryOptions<TSchema> {
  /**
   * 节点工厂分配的节点 ID。
   */
  readonly id: NodeId
  /**
   * Compiler 解析出的稳定节点 key。
   */
  readonly key: string
  /**
   * 用于判断节点配置是否变化的身份令牌。
   */
  readonly configToken: symbol
  /**
   * 已完成默认值合并的节点配置，工厂不再编译或改写该对象。
   */
  readonly schema: TSchema
  /**
   * 是否为字段创建诊断 Signal。
   */
  readonly debug?: boolean
  /**
   * 调用方创建的节点独占作用域，工厂直接使用。
   */
  readonly scope: Scope
}

/** 同一表单的节点与数组行创建能力。 */
export interface RuntimeNodeFactory<TValues extends Values> {
  /**
   * 为新数组行创建身份和位置记录，与 Schema 节点共用私有序列。
   * @param options - Store 行 key 和当前行位置。
   * @example const row = factory.createDynamicRow({ key: "row", index: 0, path: "users.0" })
   */
  createDynamicRow(options: CreateDynamicRowOptions): DynamicRowState
  /**
   * 为已编译配置分配身份并创建尚未挂载的 SchemaNode。
   *
   * @param config - compile 返回的纯配置。
   * @param scope - 调用方创建的节点独占作用域，创建失败时释放。
   * @returns 拥有独立身份和运行资源的节点。
   * @example const node = factory.createNode(compiler.compile(schema, "schemx:root", 0), parent.scope.child())
   */
  createNode(config: SchemaCompileResult<TValues>, scope: Scope): SchemaNode<TValues>
}

/**
 * 创建共享节点和数组行 ID 序列的工厂，根节点保留 ID 0。
 * @param debug - 是否为新节点创建诊断状态。
 * @example const factory = createRuntimeNodeFactory(false)
 */
export function createRuntimeNodeFactory<TValues extends Values = Values>(
  debug = false
): RuntimeNodeFactory<TValues> {
  // 只在新建节点或行时分配 ID。
  let nextId = 1

  /**
   * 为已编译配置创建独立的节点身份和运行资源。
   * @param config - compile 返回的纯配置，不会被改写。
   * @param scope - 节点独占作用域，由调用方创建，节点创建失败时释放。
   * @example const node = factory.createNode(config, parent.scope.child())
   */
  const createNode = (
    config: SchemaCompileResult<TValues>,
    scope: Scope
  ): SchemaNode<TValues> => {
    // 沿用 Schema helper 收窄已有配置结构。
    const schema = config.schema

    // 身份只在节点创建入口分配，Node 工厂只消费已编译配置。
    const nodeOptions = {
      id: nextId++,
      scope,
      debug,
      key: schema.key,
      configToken: config.configToken,
    }

    try {
      if (isDynamicSchema<TValues>(schema)) {
        return createDynamicNode<TValues>({ ...nodeOptions, schema })
      }

      if (isGroupSchema<TValues>(schema)) {
        return createGroupNode<TValues>({ ...nodeOptions, schema })
      }

      if (isDependencySchema<TValues>(schema)) {
        return createDependencyNode<TValues>({
          ...nodeOptions,
          schema,
          dynamicRow: config.dynamicRow,
        })
      }

      return createFieldNode<TValues>({ ...nodeOptions, schema })
    } catch (error) {
      scope.dispose()
      throw error
    }
  }

  /**
   * 创建新数组行；已有行由 Reconciler 按 Store key 复用。
   * @param location - Store 行 key、当前索引和完整路径。
   * @example factory.createDynamicRow({ key: "row", index: 0, path: "users.0" })
   */
  const createDynamicRow = (location: CreateDynamicRowOptions): DynamicRowState => ({
    ...location,
    id: nextId++,
  })

  return { createNode, createDynamicRow }
}
