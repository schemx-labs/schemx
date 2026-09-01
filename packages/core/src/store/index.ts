/**
 * Store 模块
 *
 * 对外提供 Store 工厂和公开类型；具体状态实现保持在 `store.ts` 内部。
 *
 * @module core/store
 */

export { createStore } from "./store"

export type {
  Store,
  StoreFieldError,
  StoreState,
  StoreOptions,
  StorePending,
} from "./types"
