import { describe, expect, it, vi } from "vite-plus/test"

import { getFormStateAdapterContext } from "../adapter/formStateAdapter/context"
import {
  createForm,
  createFormStateAdapter,
  createSignalEffect,
  getFormAdapter,
} from "../index"

describe("getFormAdapter", () => {
  it("缓存入口并直接返回原生状态，获取和读取不建立订阅", () => {
    // 原生状态与包装入口都属于这个 Form。
    const form = createForm({ initialValues: { name: "Ada" } })

    // 原始上下文用于验证对象身份，没有第二份状态。
    const context = getFormStateAdapterContext(form)

    // 对象展开保留 Core 上下文 Symbol。
    const wrapped = { ...form }

    // 包装 getter 不参与底层状态读取。
    const readValues = vi.spyOn(wrapped, "getFieldsValue")

    // 订阅只能由消费者显式触发。
    const subscribe = vi.spyOn(context.store.state.values, "subscribe")

    // 读取 loading 和 disposed 也不提前创建 effect。
    const effect = vi.spyOn(form, "effect")

    // 包装实例与原始实例获得同一个入口。
    const adapter = getFormAdapter(wrapped)

    expect(getFormAdapter(form)).toBe(adapter)
    expect(adapter.form).toBe(form)
    expect(adapter.values).toBe(context.store.state.values)
    expect(adapter.touchedFields).toBe(context.store.state.touchedFields)
    expect(adapter.pendingFields).toBe(context.store.state.pendingFields)
    expect(adapter.config).toBe(context.configuration.state)
    expect(adapter.field("name")).toBe(context.store.state.field("name"))
    expect(adapter.values.peek()).toBe(context.store.state.values.peek())
    expect(adapter.loading.value).toBe(false)
    expect(adapter.disposed.peek()).toBe(false)
    expect(subscribe).not.toHaveBeenCalled()
    expect(effect).not.toHaveBeenCalled()
    expect(readValues).not.toHaveBeenCalled()
    expect(adapter).not.toHaveProperty("source")
    expect(adapter).not.toHaveProperty("dispose")
    form.destroy()
  })

  it("遵循 Signal 首值通知，每个消费者独立订阅与取消", () => {
    // 消费者直接订阅现有值状态。
    const form = createForm({ initialValues: { name: "Ada" } })

    // 原生状态对象已经实现身份和生命周期管理。
    const state = getFormAdapter(form).values

    // 记录每个消费者直接调用原生 subscribe。
    const subscribe = vi.spyOn(state, "subscribe")

    // 同一个函数的两次注册也具有独立的取消凭据。
    const listener = vi.fn()

    // 第一个原生订阅。
    const first = state.subscribe(listener)

    // 第二个原生订阅，没有经过中间分发器。
    const second = state.subscribe(listener)

    expect(subscribe).toHaveBeenCalledTimes(2)
    expect(listener).toHaveBeenCalledTimes(2)
    expect(listener).toHaveBeenLastCalledWith({ name: "Ada" })
    form.setFieldValue("name", "Grace")
    expect(listener).toHaveBeenCalledTimes(4)
    first()
    first()
    form.setFieldValue("name", "Lin")
    expect(listener).toHaveBeenCalledTimes(5)
    second()
    form.setFieldValue("name", "Latest")
    expect(listener).toHaveBeenCalledTimes(5)
    expect(state.peek().name).toBe("Latest")
    form.destroy()
  })

  it("value 在 Core effect 中追踪原生状态，peek 不建立依赖", () => {
    // 直接操作 Form 就应触发现有 Signal 图。
    const form = createForm({ initialValues: { name: "Ada" } })

    // 不经过来源协议转换的状态。
    const state = getFormAdapter(form).field("name").value

    // 记录有依赖读取。
    const tracked = vi.fn()

    // 记录无依赖读取。
    const untracked = vi.fn()

    // 原生 value 参与 Core 依赖收集。
    const stopTracked = createSignalEffect(() => tracked(state.value))

    // 原生 peek 仅读取当前值。
    const stopUntracked = createSignalEffect(() => untracked(state.peek()))

    form.setFieldValue("name", "Grace")
    expect(tracked).toHaveBeenCalledTimes(2)
    expect(tracked).toHaveBeenLastCalledWith("Grace")
    expect(untracked).toHaveBeenCalledOnce()
    stopTracked()
    stopUntracked()
    form.destroy()
  })

  it("loading 直接跟随原生 Signal，监听器内部读取不扩展依赖", async () => {
    // 用真实提交流程保持 loading，无测试专用的内部状态写入。
    const finish = Promise.withResolvers<void>()

    // 提交完成前等待测试释放。
    const form = createForm({
      initialValues: { name: "Ada" },
      onFinish: () => finish.promise,
    })

    // loading 只读访问门面。
    const adapter = getFormAdapter(form)

    // 回调读取 values 不应使 loading 订阅也追踪 values。
    const changed = vi.fn(() => {
      void adapter.values.value
    })

    // 方法可独立传给框架，不依赖 this。
    const { peek, subscribe } = adapter.loading

    // 消费者持有自己的取消函数。
    const stop = subscribe(changed)

    expect(peek()).toBe(false)
    expect(changed).toHaveBeenCalledOnce()
    expect(Reflect.set(adapter.loading, "value", true)).toBe(false)
    form.setFieldValue("name", "Grace")
    expect(changed).toHaveBeenCalledOnce()

    // 实际提交流程发布 true，然后完成时发布 false。
    const submission = form.submit()

    try {
      await vi.waitFor(() => expect(adapter.loading.peek()).toBe(true))
      expect(changed).toHaveBeenLastCalledWith(true)
    } finally {
      finish.resolve()
      await submission
      stop()
      form.destroy()
    }

    expect(peek()).toBe(false)
    expect(changed).toHaveBeenLastCalledWith(false)
  })

  it("Form 销毁会停止原生订阅，异步提交晚结束不会再通知", async () => {
    // 提交在 Form 销毁后才完成。
    const finish = Promise.withResolvers<void>()

    // 业务回调保证测试确实进入了等待阶段。
    const onFinish = vi.fn(() => finish.promise)

    // 真实 Form 生命周期负责所有订阅。
    const form = createForm({ initialValues: { name: "Ada" }, onFinish })

    // 当前 Form 的只读入口。
    const adapter = getFormAdapter(form)

    // 观察提交状态晚到通知。
    const loadingChanged = vi.fn()

    // 观察 Form 终态。
    const disposedChanged = vi.fn()

    adapter.loading.subscribe(loadingChanged)
    adapter.disposed.subscribe(disposedChanged)

    // 捕获正在进行的提交。
    const submission = form.submit()

    try {
      await vi.waitFor(() => expect(onFinish).toHaveBeenCalledOnce())
      form.destroy()
      expect(disposedChanged.mock.calls.map(([value]) => value)).toEqual([false, true])

      // 销毁后即使业务回调晚结束，也不能重新触发旧订阅。
      const calls = loadingChanged.mock.calls.length

      finish.resolve()
      await submission
      expect(loadingChanged).toHaveBeenCalledTimes(calls)
      adapter.loading.subscribe(loadingChanged)
      adapter.disposed.subscribe(disposedChanged)
      expect(loadingChanged).toHaveBeenCalledTimes(calls)
      expect(disposedChanged).toHaveBeenCalledTimes(2)
      expect(adapter.disposed.peek()).toBe(true)
      expect(getFormAdapter(form)).toBe(adapter)
    } finally {
      finish.resolve()
      await submission
      form.destroy()
    }
  })

  it("首次订阅回调同步销毁 Form，也能停止晚返回的订阅", () => {
    // 触发原生 effect 的首次同步回调清理路径。
    const form = createForm({ initialValues: { name: "Ada" } })

    // 保留已取得的状态读入口。
    const adapter = getFormAdapter(form)

    // 首次通知中销毁整个 Form。
    const changed = vi.fn(() => form.destroy())

    // effectScope 在同步回调内被释放，晚返回的清理仍应幂等。
    const stop = adapter.loading.subscribe(changed)

    stop()
    stop()
    expect(changed).toHaveBeenCalledOnce()
    expect(adapter.disposed.peek()).toBe(true)
  })

  it("ViewSchema 读取原始引用，订阅保留首值、防抖和独立取消", async () => {
    vi.useFakeTimers()

    // 视图由原先的 Core 投影维护。
    const form = createForm({ initialValues: { name: "Ada" } })

    // 只读视图形态不保存另一份 Schema。
    const state = getFormAdapter(form).viewSchemas

    // 两个消费者直接使用现有视图订阅入口。
    const subscribe = vi.spyOn(form, "subscribeViewSchemas")

    // 消费原始防抖入口发布的值。
    const changed = vi.fn()

    try {
      expect(state.peek()).toBe(form.getViewSchemas())
      expect(state.value).toBe(form.getViewSchemas())
      expect(subscribe).not.toHaveBeenCalled()

      // 首次立即得到当前完整视图。
      const stop = state.subscribe(changed)

      expect(changed).toHaveBeenCalledOnce()
      expect(changed).toHaveBeenLastCalledWith(state.peek())
      form.setSchemas([{ name: "name", label: "First", componentType: "input" }])
      form.setSchemas([{ name: "name", label: "Last", componentType: "input" }])
      await vi.advanceTimersByTimeAsync(40)
      expect(changed).toHaveBeenLastCalledWith(state.peek())
      expect(state.peek()[0]?.label).toBe("Last")
      stop()

      // 单个消费者取消后，后续变化不再通知它。
      const calls = changed.mock.calls.length

      form.setSchemas([])
      await vi.advanceTimersByTimeAsync(40)
      expect(changed).toHaveBeenCalledTimes(calls)
    } finally {
      form.destroy()
      vi.useRealTimers()
    }

    expect(state.peek()).toEqual([])
    expect(state.peek()).toBe(state.peek())
    expect(state.value).toBe(state.peek())
  })

  it("独立快照适配器释放不影响原生入口", () => {
    // 旧 Vue bridge 继续使用独立快照适配器。
    const form = createForm({ initialValues: { name: "Ada" } })

    // 新入口直接访问现有状态。
    const adapter = getFormAdapter(form)

    // 旧入口仍具有独立的订阅释放周期。
    const legacy = createFormStateAdapter(form)

    // 原生消费者不受旧适配器 dispose 影响。
    const changed = vi.fn()

    // 保存原生取消函数。
    const stop = adapter.values.subscribe(changed)

    legacy.dispose()
    form.setFieldValue("name", "Grace")
    expect(changed).toHaveBeenLastCalledWith({ name: "Grace" })
    expect(adapter.values.peek()).toBe(legacy.values.getSnapshot())
    stop()
    form.destroy()
  })
})
