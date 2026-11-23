import { describe, expect, it, vi } from "vitest"

import { compileToDescriptors } from "../../descriptor"
import { createFieldRegistry } from "../../field"
import { createLifecycleBus } from "../../lifecycle"
import { createScheduler } from "../../scheduler"
import { createViewRevision } from "../../view"
import { createRuntimeNodeManager } from "../runtimeNodeManager"
import { createReconciler } from "../reconciler"

import type { SchemxFormContext } from "../../createForm"
import type { DependencyDescriptor, FieldDescriptor } from "../../descriptor"
import type { LifecycleListener } from "../../lifecycle"
import type { RuntimeNode, FieldRuntimeNode } from "../runtimeNode"

function createFieldDescriptor(key: string, name = key): FieldDescriptor {
  return {
    type: "field",
    key,
    name,
    rendererType: "text",
    schema: {
      name,
      componentType: "text",
    },
  } as FieldDescriptor
}

function createDependencyDescriptor(
  key: string,
  trigger: string[],
  renderer = vi.fn().mockResolvedValue([])
): DependencyDescriptor {
  return {
    type: "dependency",
    key,
    trigger,
    renderer,
  }
}

function createGraphRuntime(listener: LifecycleListener<RuntimeNode> = {}) {
  const fieldRegistry = createFieldRegistry()
  const lifecycleBus = createLifecycleBus(listener)
  const scheduler = createScheduler()
  const viewRevision = createViewRevision()
  const formApi = {
    getValue: vi.fn(),
    getValues: vi.fn(() => ({})),
  }
  const instance = {
    ...formApi,
    getFieldSnapshot: vi.fn(() => undefined),
    setInitialValues: vi.fn(),
    setFieldValue: vi.fn(),
    registerRules: vi.fn(),
    unregisterRules: vi.fn(),
    setFieldError: vi.fn(),
    validateField: vi.fn().mockResolvedValue({ ok: true, values: {} }),
  }

  const context = {
    defaultProps: {},
    instance,
    formApi,
    scheduler,
    lifecycleBus,
  } as unknown as SchemxFormContext

  Object.assign(context, { fieldRegistry })

  const runtimeNodeManager = createRuntimeNodeManager(context)
  const reconciler = createReconciler(runtimeNodeManager)
  const commitChildren = (parent: RuntimeNode, descriptors: any[]) => {
    const changed = reconciler.reconcileChildren(parent, descriptors)

    if (changed) {
      viewRevision.bump()
    }
  }

  const root = runtimeNodeManager.createRoot()

  Object.assign(context, { reconciler, commitChildren, compileOptions: {} })

  return {
    context,
    fieldRegistry,
    runtimeNodeManager,
    lifecycleBus,
    reconciler,
    commitChildren,
    root,
    scheduler,
    viewRevision,
  }
}

describe("RuntimeReconciler + DefaultRuntimeNodeManager", () => {
  it("嵌套 group reconcile 只推进一次 viewRevision", () => {
    const { commitChildren, root, viewRevision } = createGraphRuntime()
    const descriptors = compileToDescriptors([
      {
        componentType: "group",
        label: "root group",
        children: [
          {
            componentType: "group",
            label: "nested group",
            children: [
              {
                name: "field",
                componentType: "text",
              },
            ],
          },
        ],
      },
    ])

    commitChildren(root, descriptors)

    expect(viewRevision.revision.value).toBe(1)
  })

  it("生命周期事件只由 RuntimeNodeManager 触发一次", () => {
    const calls = {
      mount: vi.fn(),
      update: vi.fn(),
      unmount: vi.fn(),
    }
    const { commitChildren, root } = createGraphRuntime(calls)

    commitChildren(root, [createFieldDescriptor("name", "name")])
    commitChildren(root, [createFieldDescriptor("name", "name")])
    commitChildren(root, [])

    expect(calls.mount).toHaveBeenCalledTimes(1)
    expect(calls.update).toHaveBeenCalledTimes(1)
    expect(calls.unmount).toHaveBeenCalledTimes(1)
  })

  it("同名字段替换时旧 node cleanup 不会误删新注册", () => {
    const { fieldRegistry, commitChildren, root } = createGraphRuntime()

    commitChildren(root, [createFieldDescriptor("old", "user.name")])
    commitChildren(root, [createFieldDescriptor("new", "user.name")])

    expect(fieldRegistry.get("user.name")?.node.key).toBe("new")
  })

  it("disposeTree 不清空 descriptor 和 fieldModel，只释放字段 scope", () => {
    const { runtimeNodeManager, commitChildren, root } = createGraphRuntime()

    commitChildren(root, [createFieldDescriptor("name", "name")])

    const field = root.childNodes[0] as FieldRuntimeNode
    const descriptor = field.descriptor
    const fieldModel = field.fieldModel

    expect(field.fieldResourceScope).not.toBeNull()

    runtimeNodeManager.disposeTree(field)

    expect(field.disposed.value).toBe(true)
    expect(field.descriptor).toBe(descriptor)
    expect(field.fieldModel).toBe(fieldModel)
    expect(field.fieldResourceScope).toBeNull()
    expect(field.parent).toBeNull()
  })

  it("dependency trigger 不变时不重建 slot，trigger 变化时才重建", () => {
    const { commitChildren, root } = createGraphRuntime()

    commitChildren(root, [
      createDependencyDescriptor("dep", ["type"], vi.fn().mockResolvedValue([])),
    ])

    const dependency = root.childNodes[0]

    if (dependency?.type !== "dependency") {
      throw new Error("expected dependency node")
    }

    const firstSlot = dependency.dependencySlot

    commitChildren(root, [
      createDependencyDescriptor("dep", ["type"], vi.fn().mockResolvedValue([])),
    ])

    expect(dependency.dependencySlot).toBe(firstSlot)

    commitChildren(root, [
      createDependencyDescriptor("dep", ["mode"], vi.fn().mockResolvedValue([])),
    ])

    expect(dependency.dependencySlot).not.toBe(firstSlot)
  })

  it("仅 descriptor props 变化时 commitChildren 不 bump viewRevision", () => {
    const { commitChildren, root, viewRevision } = createGraphRuntime()

    commitChildren(root, [createFieldDescriptor("f1", "f1")])
    expect(viewRevision.revision.value).toBe(1)

    commitChildren(root, [createFieldDescriptor("f1", "f1")])
    expect(viewRevision.revision.value).toBe(1)
  })

  it("子节点新增时 commitChildren bump viewRevision", () => {
    const { commitChildren, root, viewRevision } = createGraphRuntime()

    commitChildren(root, [createFieldDescriptor("f1", "f1")])
    expect(viewRevision.revision.value).toBe(1)

    commitChildren(root, [
      createFieldDescriptor("f1", "f1"),
      createFieldDescriptor("f2", "f2"),
    ])
    expect(viewRevision.revision.value).toBe(2)
  })
})
