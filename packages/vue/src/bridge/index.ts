/**
 * Vue Bridge 的内部统一入口。
 *
 * 该目录消费 Core 的 `FormStateAdapter`，并将快照同步为 Vue Ref 与 Facade。
 *
 * @module vue/bridge
 */

export {
  disposeVueFormBridge,
  getCoreForm,
  getVueFormBridge,
  getVueFormFacade,
  retainVueFormBridge,
} from "./formBridge"
export { getVueFieldBridge } from "./fieldBridge"
export type { VueFieldBridge, VueFormBridge, VueSchemxInstance } from "./types"
