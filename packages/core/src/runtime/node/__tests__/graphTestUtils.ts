/**
 * 运行时图（Runtime Graph）的测试辅助工具。
 *
 * 提供创建原始 schema、完整运行时图测试夹具以及
 * 异步刷新调度器的方法，供各测试套件共用。
 *
 * @module core/runtime/node/__tests__/runtimeGraphTestUtils
 */
import { vi } from "vitest"

import { mergeAndResolveSchemxConfig } from "../../../config"
import { createSignal } from "../../../reactivity"
import { normalizeSchemas } from "../../../utils"
import { type Compile, createCompile } from "../../compiler"
import { type SchemaRuntimeContext } from "../../context"
import { createNodeLifecycleEmitter, type NodeLifecycleHooks } from "../../lifecycle"
import { createReconciler } from "../../reconciler"
import { createScheduler, type Scheduler } from "../../scheduler"
import { createNodeManager } from "../nodeManager"
import { createNodeLifecycle } from "../resources"

import type { SchemxField, SchemxFormApi, Values } from "../../../types"
import type { ContainerNode, ParentNode, RootNode } from "../types"

/**
 * 运行时图测试夹具的接口类型，包含 context、root、scheduler 及 formApi。
 */
export interface RuntimeGraphTestHarness<TValues extends Values = Values> {
  readonly context: SchemaRuntimeContext<TValues>
  readonly compiler: Compile<TValues>
  readonly root: RootNode
  readonly scheduler: Scheduler
  readonly commitSchemas: (
    parent: ParentNode<TValues>,
    schemas: SchemxField<TValues>[]
  ) => void
  readonly formApi: SchemxFormApi<TValues>
}

/**
 * 创建最小化的字段 schema。
 *
 * @param key - 字段 key
 * @param name - 字段路径名，默认同 key
 */
export function createFieldSchema<TValues extends Values = Values>(
  key: string,
  name: string | string[] = key
): SchemxField<TValues> {
  return {
    key,
    name: name as any,
    label: "label",
    componentType: "text",
  } as SchemxField<TValues>
}

/**
 * 创建原始字段 schema（SchemxField），不经编译直接使用。
 *
 * @param key - 字段 key
 * @param name - 字段路径名，默认同 key
 */
export function createRawFieldSchema<TValues extends Values = Values>(
  key: string,
  name: string | string[] = key
): SchemxField<TValues> {
  return {
    key,
    name: name as any,
    label: "",
    componentType: "text",
  } as SchemxField<TValues>
}

/**
 * 创建完整的运行时图测试夹具，包括 context、Reconciler、root、scheduler 和 formApi。
 *
 * 内部使用内存中的 signal 模拟值读写，并提供 formApi 的 mock 实现。
 *
 * @param listener - 生命周期钩子监听器
 * @param initialValues - 初始字段值
 */
export function createRuntimeGraphHarness<TValues extends Values = Values>(
  lifecycleHooks: NodeLifecycleHooks<ContainerNode<TValues>> = {},
  initialValues: Record<string, unknown> = {}
): RuntimeGraphTestHarness<TValues> {
  const signals = new Map<string, ReturnType<typeof createSignal<unknown>>>()

  const values = { ...initialValues }

  const lifecycle = createNodeLifecycleEmitter<ContainerNode<TValues>>(lifecycleHooks)

  const scheduler = createScheduler()

  const readValue = (name: unknown): unknown => {
    const key = normalizeName(name)

    let signal = signals.get(key)

    if (!signal) {
      signal = createSignal(values[key])
      signals.set(key, signal)
    }

    return signal.value
  }

  const writeValue = (name: unknown, value: unknown): void => {
    const key = normalizeName(name)

    values[key] = value

    let signal = signals.get(key)

    if (!signal) {
      signal = createSignal(value)
      signals.set(key, signal)
    } else {
      signal.value = value
    }
  }

  const formApi = {
    setFieldValue: writeValue,
    setFieldsValue: vi.fn(),
    getFieldValue: readValue,
    getFieldsValue: (names?: unknown) => {
      if (Array.isArray(names)) {
        for (const name of names) {
          readValue(name)
        }
      }

      return values as TValues
    },
    getFieldsSnapshot: () => values as TValues,
    setFieldPending: vi.fn(),
    setFieldsPending: vi.fn(),
    isFieldPending: vi.fn(() => false),
    isFieldsPending: vi.fn(() => false),
    setFieldTouched: vi.fn(),
    setFieldsTouched: vi.fn(),
    isFieldTouched: vi.fn(() => false),
    isFieldsTouched: vi.fn(() => false),
    getFieldErrors: vi.fn(() => []),
    getFieldsErrors: vi.fn(() => []),
    setFieldErrors: vi.fn(),
    setFieldsErrors: vi.fn(),
    clearFieldErrors: vi.fn(),
    clearFieldsErrors: vi.fn(),
    resetFields: vi.fn(),
    reset: vi.fn(),
    validateField: vi.fn().mockResolvedValue({ valid: true, values, errors: [] }),
    validate: vi.fn().mockResolvedValue({ valid: true, values, errors: [] }),
  } as unknown as SchemxFormApi<TValues>

  const instance = {
    ...formApi,
    getFieldSnapshot: vi.fn((name: unknown) => values[normalizeName(name)]),
    setInitialValues: vi.fn((nextValues: Record<string, unknown>) => {
      Object.assign(values, nextValues)
    }),
    setFieldValue: writeValue,
    validateField: vi.fn().mockResolvedValue({ valid: true, values, errors: [] }),
  }

  const validation = {
    setFieldConfig: vi.fn(),
    setFieldRules: vi.fn(),
    removeField: vi.fn(),
  }

  const store = {
    registerFieldPath: vi.fn(),
    unregisterFieldPath: vi.fn(),
    getFieldValue: readValue,
    setFieldValue: writeValue,
    removeFieldValue: vi.fn(),
    setInitialValues: instance.setInitialValues,
  }

  const compile = createCompile<TValues>({
    schemaConfig: mergeAndResolveSchemxConfig().schemaConfig,
    formInstance: instance as any,
  })

  const context = {
    schemaConfig: mergeAndResolveSchemxConfig().schemaConfig,
    fieldRules: {},
    instance,
    store,
    formApi,
    scheduler,
    validation,
    lifecycle,
  } as unknown as SchemaRuntimeContext<TValues>

  const nodeManager = createNodeManager<TValues>()

  const root = nodeManager.getRoot()

  const runtimeNodeLifecycle = createNodeLifecycle(context)

  const reconciler = createReconciler({
    compiler: compile,
    nodeManager,
    lifecycle: runtimeNodeLifecycle,
  })

  const commitSchemas = (
    parent: ParentNode<TValues>,
    schemas: SchemxField<TValues>[]
  ): void => {
    const normalizedSchemas = normalizeSchemas<TValues>(schemas, "text")

    reconciler.reconcileChildren(parent.id, normalizedSchemas)
  }

  Object.assign(context, {
    reconcileChildren: (parentId: number, schemas: SchemxField<TValues>[]) =>
      reconciler.reconcileChildren(parentId, normalizeSchemas<TValues>(schemas, "text")),
  })

  return {
    context,
    compiler: compile,
    root: root as unknown as RootNode,
    scheduler,
    commitSchemas,
    formApi,
  }
}

/**
 * 刷新运行时图：等待微任务队列清空，再等待调度器空闲。
 *
 * @param scheduler - 调度器实例
 */
export async function flushRuntimeGraph(scheduler: Scheduler): Promise<void> {
  await Promise.resolve()
  await scheduler.whenIdle()
  await Promise.resolve()
}

function normalizeName(name: unknown): string {
  if (Array.isArray(name)) {
    return name.map((part) => String(part)).join(".")
  }

  return String(name)
}
