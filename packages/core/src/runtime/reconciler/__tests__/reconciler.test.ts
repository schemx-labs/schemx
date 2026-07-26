/**
 * Reconciler 的 plan 生成与 commit 执行的测试。
 *
 * 覆盖 createReconcilePlan 的 create/update/remove 操作推导、descriptor
 * 引用不变时不产生 update、commitReconcilePlan 的调用顺序以及
 * createReconciler 的递归 group 提交。
 *
 * @module core/runtime/reconciler/__tests__/reconciler.test
 */

import { describe, expect, it, vi } from "vitest"

import { commitReconcilePlan, createReconcilePlan, createReconciler } from "../index"

import type { FormDescriptor } from "../../descriptor"
import type {
  ContainerRuntimeNode,
  DescribedRuntimeNode,
  RuntimeNode,
  Scope,
} from "../../node"

// createReconcilePlan 的 create/update/remove 操作推导与 descriptor 引用判别
describe("reconciler plan", () => {
  it("只根据入参计算 create/update/remove 和下一轮 children 顺序", () => {
    const reused = createNode(1, "name", "field")
    const removed = createNode(2, "age", "field")
    const previousDescriptor = createDescriptor("field", "name")
    const nextDescriptor = createDescriptor("field", "name")
    const createdDescriptor = createDescriptor("field", "email")
    const removedDescriptor = createDescriptor("field", "age")
    reused.descriptor = previousDescriptor
    removed.descriptor = removedDescriptor
    const plan = createReconcilePlan(
      [reused, removed],
      [createdDescriptor, nextDescriptor]
    )

    expect(plan.creates).toEqual([{ descriptor: createdDescriptor }])
    expect(plan.updates).toEqual([
      {
        node: reused,
        previousDescriptor,
        nextDescriptor,
      },
    ])
    expect(plan.removes).toEqual([{ node: removed }])
    expect(plan.nextChildrenOrder.map((entry) => entry.descriptor.key)).toEqual([
      "email",
      "name",
    ])
    expect(plan.nextChildrenOrder[0].node).toBeUndefined()
    expect(plan.nextChildrenOrder[1].node).toBe(reused)
    expect(reused.descriptor).toBe(previousDescriptor)
  })

  it("descriptor 引用未变化时不产生 update 操作", () => {
    const reused = createNode(1, "name", "field")
    const descriptor = createDescriptor("field", "name")
    reused.descriptor = descriptor

    const plan = createReconcilePlan([reused], [descriptor])

    expect(plan.creates).toEqual([])
    expect(plan.updates).toEqual([])
    expect(plan.removes).toEqual([])
    expect(plan.nextChildrenOrder[0]).toEqual({ descriptor, node: reused })
  })

  it("同级 descriptor key 重复时应拒绝生成协调计划", () => {
    const first = createDescriptor("field", "duplicate")
    const second = createDescriptor("group", "duplicate")

    expect(() => createReconcilePlan([], [first, second])).toThrow(
      '[schemx] Duplicate descriptor key "duplicate".'
    )
  })

  it("当前 RuntimeNode key 重复时应拒绝生成协调计划", () => {
    const first = createNode(1, "duplicate", "field")
    const second = createNode(2, "duplicate", "group")

    expect(() => createReconcilePlan([first, second], [])).toThrow(
      '[schemx] Duplicate runtime node key "duplicate".'
    )
  })
})

// commitReconcilePlan 按 plan 调用 tree manager 和 lifecycle，并确保 mount 先于 replaceChildren
describe("reconciler commit", () => {
  it("按 plan 调用 tree manager 和 lifecycle，不直接操作资源表", () => {
    const calls: string[] = []
    const parent = createRoot()
    const reused = createNode(1, "name", "field")
    const removed = createNode(2, "age", "field")
    const created = createNode(3, "email", "field")
    const previousDescriptor = createDescriptor("field", "name")
    const nextDescriptor = createDescriptor("field", "name")
    const createdDescriptor = createDescriptor("field", "email")
    reused.descriptor = previousDescriptor
    removed.descriptor = createDescriptor("field", "age")

    const plan = createReconcilePlan(
      [reused, removed],
      [createdDescriptor, nextDescriptor]
    )

    const nodeManager = {
      createNode: vi.fn(() => {
        calls.push("create:email")

        return created
      }),
      replaceChildren: vi.fn(() => {
        calls.push("replace")
      }),
      removeSubtree: vi.fn((node: RuntimeNode) => {
        calls.push(`remove:${node.key}`)
      }),
    }
    const lifecycle = {
      mount: vi.fn((node: DescribedRuntimeNode, descriptor: FormDescriptor) => {
        calls.push(`mount:${node.key}:${descriptor.key}`)
        node.descriptor = descriptor
      }),
      update: vi.fn(
        (
          node: DescribedRuntimeNode,
          previous: FormDescriptor | undefined,
          next: FormDescriptor
        ) => {
          calls.push(`update:${node.key}:${previous?.key ?? "none"}:${next.key}`)
          node.descriptor = next
        }
      ),
      unmountSubtree: vi.fn((node: RuntimeNode) => {
        calls.push(`unmount:${node.key}`)
      }),
    }

    const nextChildren = commitReconcilePlan(parent, plan, {
      nodeManager,
      lifecycle,
    })

    expect(nodeManager.createNode).toHaveBeenCalledWith({
      type: "field",
      key: "email",
      parent,
      dispose: childScope,
    })
    expect(nodeManager.replaceChildren).toHaveBeenCalledWith(parent, [created, reused])
    expect(lifecycle.update).toHaveBeenCalledWith(
      reused,
      previousDescriptor,
      nextDescriptor
    )
    expect(lifecycle.mount).toHaveBeenCalledWith(created, createdDescriptor)
    expect(lifecycle.unmountSubtree).toHaveBeenCalledWith(removed)
    expect(nodeManager.removeSubtree).toHaveBeenCalledWith(removed)
    expect(nextChildren).toEqual([created, reused])
    expect(calls).toEqual([
      "create:email",
      "update:name:name:name",
      "mount:email:email",
      "replace",
      "unmount:age",
      "remove:age",
    ])
  })

  it("先 mount 创建节点资源，再发布 parent childNodes", () => {
    const calls: string[] = []
    const parent = createRoot()
    const created = createNode(1, "email", "field") as DescribedRuntimeNode & {
      viewState?: unknown
    }
    const descriptor = createDescriptor("field", "email")
    const plan = createReconcilePlan([], [descriptor])

    const nodeManager = {
      createNode: vi.fn(() => {
        calls.push("create")

        return created
      }),
      replaceChildren: vi.fn((node: ContainerRuntimeNode, children) => {
        calls.push(created.viewState ? "replace:with-view" : "replace:missing-view")
        node.childNodes.value = [...children]
      }),
      removeSubtree: vi.fn(),
    }
    const lifecycle = {
      mount: vi.fn((node: DescribedRuntimeNode & { viewState?: unknown }) => {
        calls.push("mount")
        node.viewState = { mounted: true }
      }),
      update: vi.fn(),
      unmountSubtree: vi.fn(),
    }

    commitReconcilePlan(parent, plan, { nodeManager, lifecycle })

    expect(parent.childNodes.value[0]).toBe(created)
    expect(created.viewState).toEqual({ mounted: true })
    expect(calls).toEqual(["create", "mount", "replace:with-view"])
  })
})

// createReconciler 组合 plan 和 commit，递归处理 group children
describe("createReconciler", () => {
  it("组合 plan 和 commit，并在提交后递归处理 group children", () => {
    const root = createRoot()
    const groupDescriptor = createDescriptor("group", "profile", [
      createDescriptor("field", "name"),
    ])

    const context = {
      defaultProps: {},
      instance: {
        getFieldSnapshot: vi.fn(() => undefined),
        getFieldValue: vi.fn(),
        setFieldValue: vi.fn(),
        setInitialValues: vi.fn(),
        validateField: vi.fn().mockResolvedValue({ valid: true, values: {}, errors: [] }),
      },
      formApi: {
        getValue: vi.fn(),
        getValues: vi.fn(() => ({})),
      },
      compile: {
        toDescriptors: vi.fn((schemas: any[]) =>
          schemas.map((s: any, i: number) => ({
            type: s.children ? "group" : "field",
            key: `field:${s.name || "group"}:${i}`,
            name: s.name,
            children: s.children || [],
          }))
        ),
        invalidate: vi.fn(),
      },
      scheduler: {
        schedule: vi.fn(),
        dispose: vi.fn(),
      },
      validation: {
        syncField: vi.fn(),
        removeField: vi.fn(),
      },
      lifecycleBus: {
        emitBeforeMount: vi.fn(),
        emitMount: vi.fn(),
        emitBeforeUpdate: vi.fn(),
        emitUpdate: vi.fn(),
        emitUpdated: vi.fn(),
        emitBeforeUnmount: vi.fn(),
        emitUnmount: vi.fn(),
      },
      nodeResources: {
        nodes: new Map(),
        fieldIndex: {
          register: vi.fn(),
          unregister: vi.fn(),
          getByName: vi.fn(),
          getByPath: vi.fn(),
        },
        dependencyIndex: {
          register: vi.fn(),
          unregister: vi.fn(),
          getByTriggerField: vi.fn(() => []),
          getTriggerFields: vi.fn(() => []),
        },
      },
      commitChildren: vi.fn(),
    }

    const reconciler = createReconciler(context as any)

    reconciler.reconcileChildren(root, [groupDescriptor])

    expect(root.childNodes.value).toHaveLength(1)
    expect(root.childNodes.value[0]?.type).toBe("group")
  })
})

const childScope = createScope()

function createRoot(): ContainerRuntimeNode {
  return {
    id: 0,
    key: "root",
    type: "root",
    parent: null,
    dispose: createScope(childScope),
    mounted: { value: false },
    disposed: { value: false },
    childNodes: { value: [] },
  } as ContainerRuntimeNode
}

function createNode(
  id: number,
  key: string,
  type: "field" | "group" | "dependency"
): DescribedRuntimeNode {
  const node = {
    id,
    key,
    type,
    parent: null,
    dispose: createScope(),
    mounted: { value: false },
    disposed: { value: false },
    descriptor: null,
  }

  if (type === "field") {
    return node as DescribedRuntimeNode
  }

  return {
    ...node,
    childNodes: { value: [] },
  } as DescribedRuntimeNode
}

function createDescriptor(
  type: "field" | "group" | "dependency",
  key: string,
  children: FormDescriptor[] = []
): FormDescriptor {
  if (type === "group") {
    return {
      type,
      key,
      staticSchema: {},
      staticState: { visible: true, readonly: false, disabled: false },
      children,
    } as FormDescriptor
  }

  if (type === "dependency") {
    return {
      type,
      key,
      triggerFields: [],
      renderer: () => [],
      rendererIdentity: () => [],
      staticState: { visible: true, readonly: false, disabled: false },
    } as FormDescriptor
  }

  return {
    type,
    key,
    name: key,
    componentType: "text",
    staticSchema: {},
  } as FormDescriptor
}

function createScope(child?: Scope): Scope {
  return {
    disposed: false,
    add: vi.fn(),
    child: vi.fn(() => child ?? createScope()),
    dispose: vi.fn(),
  }
}
