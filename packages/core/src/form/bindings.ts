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
   * Connects the Runtime and Controller exactly once.
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
   * Returns the required connected Runtime.
   */
  const getRuntime: FormBindings<TValues>["getRuntime"] = () => {
    if (!runtime) {
      throw new Error("[schemx] Form runtime is not connected.")
    }

    return runtime
  }

  /**
   * Returns the Runtime only while it remains connected.
   */
  const getConnectedRuntime: FormBindings<TValues>["getConnectedRuntime"] = () => runtime

  /**
   * Returns the required connected Controller.
   */
  const getController: FormBindings<TValues>["getController"] = () => {
    if (!controller) {
      throw new Error("[schemx] Form controller is not connected.")
    }

    return controller
  }

  /**
   * Returns the Controller only while it remains connected.
   */
  const getConnectedController: FormBindings<TValues>["getConnectedController"] = () =>
    controller

  /**
   * Registers the callback invoked by the public destroy operation.
   */
  const setDestroy: FormBindings<TValues>["setDestroy"] = (nextDestroy) => {
    destroy = nextDestroy
  }

  /**
   * Runs the registered destroy callback when present.
   */
  const destroyBindings: FormBindings<TValues>["destroy"] = () => {
    destroy?.()
  }

  /**
   * Releases service references after Form teardown.
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
