import { describe, expect, it } from "vite-plus/test"

import { createNodeManager, createScope } from ".."
import { createSchemaCompiler } from "../../compiler"
import { createFormConfig } from "../../config/createFormConfig"
import { createReconciler } from "../../reconciler"
import { createScheduler } from "../../scheduler"
import { createStore } from "../../store"
import { createValidator } from "../../validator"

import type { FormRuntimeContext } from "../../runtimeContext"
import type { SchemxInstance } from "../../types"
import type { SchemxFormApi, Values } from "../../types"

/**
 * 身份测试直接装配真实运行模块，不建立额外运行时门面。
 */
function setup() {
  // 每个用例拥有其创建的公共资源。
  const scope = createScope()

  // 提供固定默认值与当前消费配置的真实模型。
  const configuration = createFormConfig()

  scope.add(configuration.dispose)

  // 用例使用的真实路径值和字段状态。
  const store = createStore<Values>({ initialValues: { name: "Ada" } })

  scope.add(store.destroy.bind(store))

  // 使用真实 Store 执行规则并协调校验取消。
  const validator = createValidator({
    fieldStore: store,
    presetRuleRegistry: configuration.getConfig().presetRuleRegistry,
  })

  scope.add(validator.destroy.bind(validator))

  // 跟踪用例中的依赖调度和异步任务。
  const scheduler = createScheduler()

  scope.add(scheduler.dispose)

  // 维护当前测试图的节点身份及路径索引。
  const nodeManager = createNodeManager()

  // 承载当前用例整棵节点树的根。
  const root = nodeManager.getRoot()

  scope.add(root.scope.dispose)
  scope.add(nodeManager.dispose)

  // 按配置快照编译 Schema 并分配新节点身份。
  const compiler = createSchemaCompiler({ config: configuration.getConfig() })

  scope.add(compiler.invalidateConfigCache)

  // 直接向节点模块提供同一组资源和消费端 API。
  const context: FormRuntimeContext = {
    getInstance: () => context.formApi as SchemxInstance,
    debug: false,
    fieldRules: {},
    store,
    validator,
    nodeManager,
    scheduler,
    formApi: {} as SchemxFormApi,
  }

  // 实际提交本用例的节点更新。
  const reconciler = createReconciler({ compiler, context, lifecycleHooks: {} })

  scope.add(reconciler.clear)
  scope.add(() => {
    root.disposed.value = true
  })

  return { scope, store, nodeManager, compiler, reconciler, configuration }
}

describe("节点身份与 Schema 提交", () => {
  it("配置刷新与节点复用不消耗新身份，卸载后的 ID 不回收", () => {
    // 用例直接持有需要验证和清理的运行模块。
    const { scope, nodeManager, compiler, reconciler, configuration } = setup()

    // 承载当前用例整棵节点树的根。
    const root = nodeManager.getRoot()

    try {
      expect(root.id).toBe(0)
      reconciler.reconcile([{ key: "group", label: "分组", children: [] }])
      expect(root.childNodes.peek()[0]?.id).toBe(1)
      configuration.setConfig({ schemaConfig: { readonly: true } }, (next) => {
        // next 是配置模型提交的候选快照。
        compiler.setConfig(next)
        reconciler.refresh()
      })
      reconciler.reconcile([{ key: "group", label: "更新分组", children: [] }])
      expect(root.childNodes.peek()[0]?.id).toBe(1)
      reconciler.reconcile([])
      reconciler.reconcile([{ key: "group", label: "分组", children: [] }])
      expect(root.childNodes.peek()[0]?.id).toBe(2)
    } finally {
      scope.dispose()
    }
  })

  it("卸载无路径容器后刷新配置不恢复旧子树，Store 数据保持不变", () => {
    // 用例直接持有需要验证和清理的运行模块。
    const { scope, store, nodeManager, compiler, reconciler, configuration } = setup()

    // 承载当前用例整棵节点树的根。
    const root = nodeManager.getRoot()

    try {
      reconciler.reconcile([{ key: "group", label: "分组", children: [] }])
      // 首次协调生成的真实数组节点。
      const node = root.childNodes.peek()[0]

      if (!node) {
        throw new Error("分组节点未创建")
      }

      expect(nodeManager.get(node.id)).toBe(node)
      reconciler.reconcile([])
      configuration.setConfig({ schemaConfig: { readonly: true } }, (next) => {
        // next 刷新空树，不能恢复已卸载的配置。
        compiler.setConfig(next)
        reconciler.refresh()
      })
      expect(nodeManager.get(node.id)).toBeUndefined()
      expect(root.childNodes.peek()).toEqual([])
      expect(store.getFieldValue("name")).toBe("Ada")
    } finally {
      scope.dispose()
    }
  })
})
