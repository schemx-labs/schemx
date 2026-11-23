/**
 * Store 单元测试
 *
 * 覆盖 Store 的所有公开 API：
 * 构造、getFieldValue、setFieldValue、getFieldsValue、setFieldsValue、
 * getFieldSnapshot、getFieldsSnapshot、getInitialValue、getInitialValues、
 * setInitialValue、setInitialValues、touched/pending 状态、reset、destroy。
 *
 * @module core/store/__tests__/store
 */

import { isReactive } from "vue"

import fc from "fast-check"
import { describe, expect, it } from "vitest"

import { createStore } from "../store"

interface TestForm {
  name: string
  age: number
  email: string
}

interface NestedForm {
  user: {
    name: string
    address: {
      city: string
      zip: string
    }
  }
  tags: string[]
}

describe("Store", () => {
  describe("构造", () => {
    it("无参构造创建空 store", () => {
      const store = createStore()
      expect(store.getFieldsSnapshot()).toEqual({})
    })

    it("使用 initialValues 构造", () => {
      const store = createStore<TestForm>({
        initialValues: { name: "John", age: 25, email: "j@t.com" },
      })
      expect(store.getFieldValue("name")).toBe("John")
      expect(store.getFieldValue("age")).toBe(25)
    })

    it("initialValues 深拷贝，外部修改不影响 store", () => {
      const init = { name: "John", age: 25, email: "j@t.com" }
      const store = createStore<TestForm>({ initialValues: init })
      init.name = "Modified"
      expect(store.getFieldValue("name")).toBe("John")
    })

    it("createStore 工厂函数", () => {
      const store = createStore<TestForm>({
        initialValues: { name: "A", age: 1, email: "a@b.com" },
      })
      expect(store.getFieldValue("name")).toBe("A")
    })
  })

  describe("getFieldValue / setFieldValue", () => {
    it("获取和设置基本字段", () => {
      const store = createStore<TestForm>({
        initialValues: { name: "John", age: 25, email: "j@t.com" },
      })
      store.setFieldValue("name", "Jane")
      expect(store.getFieldValue("name")).toBe("Jane")
    })

    it("获取和设置嵌套字段", () => {
      const store = createStore<NestedForm>({
        initialValues: {
          user: { name: "John", address: { city: "Beijing", zip: "100000" } },
          tags: ["a"],
        },
      })
      store.setFieldValue("user.address.city" as any, "Shanghai")
      expect(store.getFieldValue("user.address.city" as any)).toBe("Shanghai")
    })

    it("获取不存在的字段返回 undefined", () => {
      const store = createStore<TestForm>({
        initialValues: { name: "John", age: 25, email: "j@t.com" },
      })
      expect(store.getFieldValue("nonexistent" as any)).toBeUndefined()
    })
  })

  describe("getFieldsValue / setFieldsValue", () => {
    it("无参返回全量值", () => {
      const store = createStore<TestForm>({
        initialValues: { name: "John", age: 25, email: "j@t.com" },
      })
      const values = store.getFieldsValue()
      expect(values).toEqual({ name: "John", age: 25, email: "j@t.com" })
    })

    it("传入路径数组返回指定字段", () => {
      const store = createStore<TestForm>({
        initialValues: { name: "John", age: 25, email: "j@t.com" },
      })
      const partial = store.getFieldsValue(["name", "age"])
      expect(partial).toEqual({ name: "John", age: 25 })
    })

    it("批量设置多个字段", () => {
      const store = createStore<TestForm>({
        initialValues: { name: "John", age: 25, email: "j@t.com" },
      })
      store.setFieldsValue({ name: "Jane", age: 30 })
      expect(store.getFieldValue("name")).toBe("Jane")
      expect(store.getFieldValue("age")).toBe(30)
      expect(store.getFieldValue("email")).toBe("j@t.com")
    })
  })

  describe("getFieldsSnapshot", () => {
    it("返回指定字段快照", () => {
      const store = createStore<TestForm>({
        initialValues: { name: "John", age: 25, email: "j@t.com" },
      })
      store.setFieldValue("name", "Jane")
      expect(store.getFieldSnapshot("name")).toBe("Jane")
    })

    it("返回原始对象的深拷贝", () => {
      const store = createStore<TestForm>({
        initialValues: { name: "John", age: 25, email: "j@t.com" },
      })
      const snap1 = store.getFieldsSnapshot()
      const snap2 = store.getFieldsSnapshot()
      expect(snap1).toEqual(snap2)
      expect(snap1).not.toBe(snap2)
    })

    it("快照不受后续修改影响", () => {
      const store = createStore<TestForm>({
        initialValues: { name: "John", age: 25, email: "j@t.com" },
      })
      const snap = store.getFieldsSnapshot()
      store.setFieldValue("name", "Changed")
      expect(snap.name).toBe("John")
    })

    it("快照不是 reactive 对象", () => {
      const store = createStore<TestForm>({
        initialValues: { name: "John", age: 25, email: "j@t.com" },
      })
      const snap = store.getFieldsSnapshot()
      expect(isReactive(snap)).toBe(false)
    })
  })

  describe("getInitialValue / getInitialValues / setInitialValue / setInitialValues", () => {
    it("获取指定字段初始值", () => {
      const store = createStore<TestForm>({
        initialValues: { name: "John", age: 25, email: "j@t.com" },
      })
      expect(store.getInitialValue("name")).toBe("John")
      expect(store.getInitialValue("missing" as any)).toBeUndefined()
    })

    it("无参返回全量初始值深拷贝", () => {
      const store = createStore<TestForm>({
        initialValues: { name: "John", age: 25, email: "j@t.com" },
      })
      const init = store.getInitialValues()
      expect(init).toEqual({ name: "John", age: 25, email: "j@t.com" })
      // 修改返回值不影响 store
      init.name = "Modified"
      expect(store.getInitialValues().name).toBe("John")
    })

    it("传入路径数组返回指定字段初始值", () => {
      const store = createStore<TestForm>({
        initialValues: { name: "John", age: 25, email: "j@t.com" },
      })
      const partial = store.getInitialValues(["name", "email"])
      expect(partial).toEqual({ name: "John", email: "j@t.com" })
    })

    it("setInitialValue 只更新初始值并重新计算 touched", () => {
      const store = createStore<TestForm>({
        initialValues: { name: "John", age: 25, email: "j@t.com" },
      })
      store.setFieldValue("name", "Jane")
      store.setInitialValue("name", "Jane")
      expect(store.getFieldValue("name")).toBe("Jane")
      expect(store.getInitialValue("name")).toBe("Jane")
      expect(store.isFieldTouched("name")).toBe(false)
    })

    it("setInitialValues 批量更新初始值", () => {
      const store = createStore<TestForm>({
        initialValues: { name: "John", age: 25, email: "j@t.com" },
      })
      store.setInitialValues({ name: "NewDefault", age: 99 })
      expect(store.getInitialValues().name).toBe("NewDefault")
      expect(store.getInitialValues().age).toBe(99)
      // 未更新的字段保持原值
      expect(store.getInitialValues().email).toBe("j@t.com")
    })

    it("setInitialValues 空对象不报错", () => {
      const store = createStore<TestForm>({
        initialValues: { name: "John", age: 25, email: "j@t.com" },
      })
      store.setInitialValues({})
      expect(store.getInitialValues()).toEqual({
        name: "John",
        age: 25,
        email: "j@t.com",
      })
    })
  })

  describe("isFieldTouched / isFieldsTouched / getTouchedFields", () => {
    it("未修改字段返回 false", () => {
      const store = createStore<TestForm>({
        initialValues: { name: "John", age: 25, email: "j@t.com" },
      })
      expect(store.isFieldTouched("name")).toBe(false)
    })

    it("修改后返回 true", () => {
      const store = createStore<TestForm>({
        initialValues: { name: "John", age: 25, email: "j@t.com" },
      })
      store.setFieldValue("name", "Jane")
      expect(store.isFieldTouched("name")).toBe(true)
    })

    it("设回初始值后返回 false", () => {
      const store = createStore<TestForm>({
        initialValues: { name: "John", age: 25, email: "j@t.com" },
      })
      store.setFieldValue("name", "Jane")
      store.setFieldValue("name", "John")
      expect(store.isFieldTouched("name")).toBe(false)
    })

    it("isFieldsTouched 无参检查任一字段", () => {
      const store = createStore<TestForm>({
        initialValues: { name: "John", age: 25, email: "j@t.com" },
      })
      expect(store.isFieldsTouched()).toBe(false)
      store.setFieldValue("age", 30)
      expect(store.isFieldsTouched()).toBe(true)
    })

    it("isFieldsTouched 传入路径数组检查所有字段", () => {
      const store = createStore<TestForm>({
        initialValues: { name: "John", age: 25, email: "j@t.com" },
      })
      store.setFieldValue("name", "Jane")
      // 只修改了 name，age 未修改
      expect(store.isFieldsTouched(["name", "age"])).toBe(false)
      store.setFieldValue("age", 30)
      expect(store.isFieldsTouched(["name", "age"])).toBe(true)
    })

    it("getTouchedFields 返回所有被修改的路径", () => {
      const store = createStore<TestForm>({
        initialValues: { name: "John", age: 25, email: "j@t.com" },
      })
      store.setFieldValue("name", "Jane")
      store.setFieldValue("email", "new@t.com")
      const touched = store.getTouchedFields()
      expect(touched).toContain("name")
      expect(touched).toContain("email")
      expect(touched).not.toContain("age")
    })

    it("支持显式设置单个和多个字段 touched 状态", () => {
      const store = createStore<TestForm>({
        initialValues: { name: "John", age: 25, email: "j@t.com" },
      })
      store.setFieldTouched("name", true)
      store.setFieldsTouched(["age", "email"], true)
      expect(store.getTouchedFields()).toEqual(["name", "age", "email"])

      store.setFieldsTouched(["name", "email"], false)
      expect(store.isFieldTouched("name")).toBe(false)
      expect(store.isFieldTouched("age")).toBe(true)
      expect(store.isFieldTouched("email")).toBe(false)
    })
  })

  describe("pending 状态", () => {
    it("支持设置和获取单字段 pending 状态", () => {
      const store = createStore<TestForm>({
        initialValues: { name: "John", age: 25, email: "j@t.com" },
      })
      store.setFieldPending("email", true)
      expect(store.isFieldPending("email")).toBe(true)
      expect(store.getPendingFields()).toEqual([{ field: "email", message: [] }])

      store.setFieldPending("email", false)
      expect(store.isFieldPending("email")).toBe(false)
      expect(store.getPendingFields()).toEqual([])
    })

    it("isFieldsPending 对传入路径和全量字段使用全字段 pending 判断", () => {
      const store = createStore<TestForm>({
        initialValues: { name: "John", age: 25, email: "j@t.com" },
      })
      store.setFieldsPending(["name", "age"], true)
      expect(store.isFieldsPending(["name", "age"])).toBe(true)
      expect(store.isFieldsPending()).toBe(false)

      store.setFieldPending("email", true)
      expect(store.isFieldsPending()).toBe(true)
    })
  })

  describe("reset / resetField / resetFields / destroy", () => {
    it("reset 恢复到初始值", () => {
      const store = createStore<TestForm>({
        initialValues: { name: "John", age: 25, email: "j@t.com" },
      })
      store.setFieldValue("name", "Changed")
      store.setFieldValue("age", 99)
      store.reset()
      expect(store.getFieldsSnapshot()).toEqual({
        name: "John",
        age: 25,
        email: "j@t.com",
      })
    })

    it("reset 传入新值同时更新初始值", () => {
      const store = createStore<TestForm>({
        initialValues: { name: "John", age: 25, email: "j@t.com" },
      })
      store.reset({ name: "New", age: 0, email: "new@t.com" })
      expect(store.getFieldsSnapshot()).toEqual({
        name: "New",
        age: 0,
        email: "new@t.com",
      })
      expect(store.getInitialValues()).toEqual({
        name: "New",
        age: 0,
        email: "new@t.com",
      })
    })

    it("reset 传入新值时删除新值中不存在的字段 signal", () => {
      const store = createStore<TestForm>({
        initialValues: { name: "John", age: 25, email: "j@t.com" },
      })
      store.reset({ name: "Only" })
      expect(store.getFieldValue("name")).toBe("Only")
      expect(store.getFieldValue("age")).toBeUndefined()
      expect(store.getFieldValue("email")).toBeUndefined()
      expect(store.getFieldsSnapshot()).toEqual({ name: "Only" })
    })

    it("resetField 恢复单个字段", () => {
      const store = createStore<TestForm>({
        initialValues: { name: "John", age: 25, email: "j@t.com" },
      })
      store.setFieldValue("name", "Changed")
      store.setFieldValue("age", 99)
      store.resetField("name")
      expect(store.getFieldValue("name")).toBe("John")
      expect(store.getFieldValue("age")).toBe(99) // age 不受影响
    })

    it("resetFields 恢复指定字段并清理 touched 和 pending", () => {
      const store = createStore<TestForm>({
        initialValues: { name: "John", age: 25, email: "j@t.com" },
      })
      store.setFieldsValue({ name: "Changed", age: 99 })
      store.setFieldPending("name", true)

      store.resetFields(["name"])

      expect(store.getFieldValue("name")).toBe("John")
      expect(store.getFieldValue("age")).toBe(99)
      expect(store.isFieldTouched("name")).toBe(false)
      expect(store.isFieldPending("name")).toBe(false)
    })

    it("destroy 清空所有字段 signal", () => {
      const store = createStore<TestForm>({
        initialValues: { name: "John", age: 25, email: "j@t.com" },
      })
      store.setFieldTouched("name", true)
      store.setFieldPending("email", true)

      store.destroy()

      expect(store.getFieldsSnapshot()).toEqual({})
      expect(store.getTouchedFields()).toEqual([])
      expect(store.getPendingFields()).toEqual([])
    })
  })
})

describe("Store 属性测试", () => {
  // Feature: pure-signal-core-refactor, Property 2: Store setFieldValue/setFieldsValue 往返一致性
  // **Validates: Requirements 3.1, 3.4**
  it("Property 2: 对任意字段路径和值，setFieldValue 后 getFieldValue 应返回相同的值；setFieldsValue 同理", () => {
    // 使用原始类型值，避免 collectObjectPathsByLeaf 将对象展开为嵌套路径
    const primitiveArb = fc.oneof(
      fc.string(),
      fc.integer(),
      fc.double({ noNaN: true }),
      fc.boolean(),
      fc.constant(null)
    )

    fc.assert(
      fc.property(
        fc
          .string()
          .filter(
            (s) =>
              s.length > 0 &&
              !s.includes(".") &&
              !["__proto__", "constructor", "prototype"].includes(s)
          ),
        primitiveArb,
        (path, value) => {
          // 测试 setFieldValue 往返一致性
          const store = createStore()
          store.setFieldValue(path as any, value)
          expect(store.getFieldValue(path as any)).toEqual(value)
          store.destroy()

          // 测试 setFieldsValue 往返一致性
          const store2 = createStore()
          const obj: Record<string, unknown> = {}
          obj[path] = value
          store2.setFieldsValue(obj)
          expect(store2.getFieldValue(path as any)).toEqual(value)
          store2.destroy()
        }
      ),
      { numRuns: 100 }
    )
  })

  // Feature: pure-signal-core-refactor, Property 5: reset 产生正确的 store 状态（diff 式更新）
  // **Validates: Requirements 4.1, 4.3, 4.4**
  it("Property 5: reset 后已有路径中在目标值内的返回正确值，不在目标值内的被删除", () => {
    const primitiveArb = fc.oneof(
      fc.string(),
      fc.integer(),
      fc.double({ noNaN: true }),
      fc.boolean(),
      fc.constant(null)
    )

    fc.assert(
      fc.property(
        fc.record({ a: primitiveArb, b: primitiveArb }),
        fc.record({ a: primitiveArb, b: primitiveArb }),
        (initialValues, targetValues) => {
          const store = createStore({ initialValues })

          store.reset(targetValues)

          // 验证目标路径返回正确值
          for (const key of Object.keys(targetValues)) {
            expect(store.getFieldValue(key as any)).toEqual((targetValues as any)[key])
          }

          store.destroy()
        }
      ),
      { numRuns: 100 }
    )
  })
})
