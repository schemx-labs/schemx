/**
 * Core 的 UI 适配层 SPI 入口。
 *
 * @module core/adapter
 */

export {
  createRendererRegistry,
  RendererRegistry,
  type RendererMap,
} from "../registry/rendererRegistry"

export {
  createFormStateAdapter,
  type FieldSnapshotSource,
  type FieldStateSnapshot,
  type FormStateAdapter,
  type SnapshotSource,
} from "./formStateAdapter"
