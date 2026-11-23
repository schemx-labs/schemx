/**
 * 字段节点的字典资源装配与清理。
 */

import { createComputed, createSignalEffect } from "../reactivity"

import { createFieldDictionaryChannel } from "./createChannel"
import { resolveDictionaryTarget } from "./target"
import { normalizeSchemxDictionary } from "./types"

import type { FieldNode } from "../node"
import type { FormRuntimeContext } from "../runtimeContext"
import type { Values } from "../types"
import type { SchemxDictionaryInput } from "./types"

/**
 * 在字段作用域中观察字典配置。立即替换资源，延后启动自动请求。
 * @typeParam TValues - 完整表单值。
 * @param node - 已挂载的字段节点。
 * @param context - 表单的调度器与实例。
 * @example mountFieldDictionary(node, context)
 */
export function mountFieldDictionary<TValues extends Values>(
  node: FieldNode<TValues>,
  context: FormRuntimeContext<TValues>
): void {
  // 配置引用未变时，校验或其他展示更新不重启字典。
  const input = createComputed(
    () => node.dependencyOverrides.value.dict ?? node.compiledSchema.value.dict
  )

  // 归一化字段或依赖提供的请求配置。
  const config = createComputed(() =>
    normalizeSchemxDictionary(input.value as SchemxDictionaryInput<TValues> | undefined)
  )

  // 读取对应 Renderer 的默认值，普通无字典字段不订阅注册表。
  const defaults = createComputed(() =>
    context.getRendererDictionary?.(node.compiledSchema.value.componentType)
  )

  // 跟踪实际生效的目标和映射，覆盖默认值的字段保留自己的字典状态。
  const targetKey = createComputed(() =>
    resolveDictionaryTarget(config.value?.targetKey ?? defaults.value?.targetKey)
  )

  const keys = createComputed(() =>
    config.value?.formatter ? undefined : (config.value?.keys ?? defaults.value?.keys)
  )

  // 只跟踪有效配置，在同一轮更新中让旧请求失效。
  const stopConfig = createSignalEffect(() => {
    const fieldConfig = config.value

    node.dictionary.peek()?.dispose()

    if (!fieldConfig) {
      node.dictionary.value = null

      return
    }

    // 子作用域同时约束排队任务、字段监听与请求。
    const scope = node.scope.child()

    // 本版本配置使用独立通道，异步响应只能写入本通道。
    const channel = createFieldDictionaryChannel<TValues>({
      scope,
      scheduler: context.scheduler,
      config: {
        ...fieldConfig,
        targetKey: targetKey.value,
        keys: keys.value,
      },
      getName: () => node.name.peek(),
      getForm: context.getInstance,
    })

    node.dictionary.value = channel

    // 动态 dict 尚在求值时，等待本轮结果再自动启动。
    const stopStart = createSignalEffect(() => {
      if (node.dictionaryConfigPending.value) {
        return
      }

      context.scheduler.schedule({
        id: `field:${node.id}:dictionary`,
        priority: "post",
        scope,
        run: () => {
          if (!node.dictionaryConfigPending.peek()) {
            channel.start()
          }
        },
      })
    })

    scope.add(stopStart)
  })

  node.scope.add(stopConfig)
  node.scope.add(() => {
    node.dictionary.value = null
  })
}
