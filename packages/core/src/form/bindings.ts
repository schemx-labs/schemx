import type { FormController } from "./controller"
import type { SchemaRuntime } from "../runtime/createSchemaRuntime"
import type { Values } from "../types"

/**
 * 管理 FormFacade 与 SchemaRuntime/FormController 之间的一次性连接。
 *
 * @typeParam TValues - 表单值对象类型。
 */
export interface FormBindings<TValues extends Values> {
  /**
   * 连接当前 Form 的 Runtime 与 Controller；重复连接会抛出错误。
   */
  connect(services: {
    runtime: SchemaRuntime<TValues>
    controller: FormController<TValues>
  }): void
  /**
   * 获取已连接的 Runtime；尚未连接时抛出错误。
   */
  getRuntime(): SchemaRuntime<TValues>
  /**
   * 获取已连接的 Runtime；未连接或已断开时返回 `undefined`。
   */
  getConnectedRuntime(): SchemaRuntime<TValues> | undefined
  /**
   * 获取已连接的 Controller；尚未连接时抛出错误。
   */
  getController(): FormController<TValues>
  /**
   * 获取已连接的 Controller；未连接或已断开时返回 `undefined`。
   */
  getConnectedController(): FormController<TValues> | undefined
  /**
   * 注册 Form 销毁回调。
   */
  setDestroy(destroy: () => void): void
  /**
   * 执行已注册的销毁回调。
   */
  destroy(): void
  /**
   * 断开运行时引用，使销毁后的公开 API 不再持有 Runtime。
   */
  disconnect(): void
}

/**
 * 创建一个尚未连接服务的 Form binding 容器。
 *
 * @typeParam TValues - 表单值对象类型。
 * @returns 可用于连接、访问和断开 Form 服务的 binding。
 */
export function createFormBindings<TValues extends Values>(): FormBindings<TValues> {
  // 当前 Form 连接的 Schema Runtime。
  let runtime: SchemaRuntime<TValues> | undefined

  // 当前 Form 连接的校验与提交控制器。
  let controller: FormController<TValues> | undefined

  // Form 销毁时执行的聚合回调。
  let destroy: (() => void) | undefined

  // 是否已经完成首次服务连接。
  let connected = false

  /**
   * 仅连接一次 Runtime 与 Controller。
   */
  const connect: FormBindings<TValues>["connect"] = (services) => {
    if (connected) {
      throw new Error("[schemx] Form services are already connected.")
    }

    connected = true
    runtime = services.runtime
    controller = services.controller
  }

  /**
   * 返回已连接且必须存在的 Runtime。
   */
  const getRuntime: FormBindings<TValues>["getRuntime"] = () => {
    if (!runtime) {
      throw new Error("[schemx] Form runtime is not connected.")
    }

    return runtime
  }

  /**
   * 仅在 Runtime 仍连接时返回它。
   */
  const getConnectedRuntime: FormBindings<TValues>["getConnectedRuntime"] = () => runtime

  /**
   * 返回已连接且必须存在的 Controller。
   */
  const getController: FormBindings<TValues>["getController"] = () => {
    if (!controller) {
      throw new Error("[schemx] Form controller is not connected.")
    }

    return controller
  }

  /**
   * 仅在 Controller 仍连接时返回它。
   */
  const getConnectedController: FormBindings<TValues>["getConnectedController"] = () =>
    controller

  /**
   * 注册公开销毁操作需要调用的回调。
   */
  const setDestroy: FormBindings<TValues>["setDestroy"] = (nextDestroy) => {
    destroy = nextDestroy
  }

  /**
   * 在存在已注册回调时执行销毁回调。
   */
  const destroyBindings: FormBindings<TValues>["destroy"] = () => {
    destroy?.()
  }

  /**
   * Form 结束后释放服务引用。
   */
  const disconnect: FormBindings<TValues>["disconnect"] = () => {
    runtime = undefined
    controller = undefined
    destroy = undefined
  }

  return {
    connect,
    getRuntime,
    getConnectedRuntime,
    getController,
    getConnectedController,
    setDestroy,
    destroy: destroyBindings,
    disconnect,
  }
}
