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
import { createCompile } from "../../compiler"
import { type SchemaRuntimeContext } from "../../context"
import { createLifecycleBus, type LifecycleListener } from "../../lifecycle"
import { createReconciler, type Reconciler } from "../../reconciler"
import { createScheduler, type Scheduler } from "../../scheduler"
import { createRuntimeRegistry } from "../runtimeRegistry"

import type { SchemxField, SchemxFormApi, Values } from "../../../types"
import type { ParentRuntimeNode, RootRuntimeNode, RuntimeNode } from "../types"

/**
 * 运行时图测试夹具的接口类型，包含 context、reconciler、root、scheduler 及 formApi。
 */
export interface RuntimeGraphTestHarness<TValues extends Values = Values> {
  readonly context: SchemaRuntimeContext<TValues>
  readonly reconciler: Reconciler<TValues>
  readonly root: RootRuntimeNode
  readonly scheduler: Scheduler
  readonly commitSchemas: (
    parent: ParentRuntimeNode<TValues>,
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
 * 创建完整的运行时图测试夹具，包括 context、reconciler、root、scheduler 和 formApi。
 *
 * 内部使用内存中的 signal 模拟值读写，并提供 formApi 的 mock 实现。
 *
 * @param listener - 生命周期钩子监听器
 * @param initialValues - 初始字段值
 */
export function createRuntimeGraphHarness<TValues extends Values = Values>(
  listener: LifecycleListener<RuntimeNode<TValues>> = {},
  initialValues: Record<string, unknown> = {}
): RuntimeGraphTestHarness<TValues> {
  const signals = new Map<string, ReturnType<typeof createSignal<unknown>>>()

  const values = { ...initialValues }

  const lifecycleBus = createLifecycleBus<RuntimeNode<TValues>>(listener)

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
    setValue: writeValue,
    setValues: vi.fn(),
    getValue: readValue,
    getValues: (names?: unknown) => {
      if (Array.isArray(names)) {
        for (const name of names) {
          readValue(name)
        }
      }

      return values as TValues
    },
    getSnapshots: () => values as TValues,
    setPending: vi.fn(),
    isPending: vi.fn(() => false),
    setTouched: vi.fn(),
    isTouched: vi.fn(() => false),
    getError: vi.fn(() => []),
    setError: vi.fn(),
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
    syncField: vi.fn(),
    removeField: vi.fn(),
    removeSchemaField: vi.fn(),
  }

  const model = {
    registerFieldPath: vi.fn(),
    getFieldValue: readValue,
    setFieldValue: writeValue,
    setInitialValues: instance.setInitialValues,
    syncValidationField: validation.syncField,
    removeValidationField: validation.removeField,
    removeSchemaValidationField: validation.removeSchemaField,
  }

  const compile = createCompile<TValues>({
    schemaConfig: mergeAndResolveSchemxConfig().schemaConfig,
    formInstance: instance as any,
  })

  const context = {
    schemaConfig: mergeAndResolveSchemxConfig().schemaConfig,
    instance,
    model,
    formApi,
    compile,
    scheduler,
    validation,
    lifecycleBus,
    runtimeRegistry: createRuntimeRegistry<TValues>(),
  } as unknown as SchemaRuntimeContext<TValues>

  const reconciler = createReconciler<TValues>(context)

  const root = reconciler.createRoot()

  const commitSchemas = (
    parent: ParentRuntimeNode<TValues>,
    schemas: SchemxField<TValues>[]
  ): void => reconciler.reconcileChildren(parent, schemas)

  Object.assign(context, {
    reconcileChildren: reconciler.reconcileChildren,
  })

  return {
    context,
    reconciler,
    root: root as unknown as RootRuntimeNode,
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
