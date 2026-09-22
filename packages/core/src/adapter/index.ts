/**
 * Core 的 UI 适配层 SPI 入口。
 *
 * @module core/adapter
 */

export {
  createRendererRegistry,
  type RendererRegistry,
  type RendererDescriptor,
  type RendererEntry,
  type RendererMap,
  type RendererPropsTransformer,
  type RendererRegistration,
  type RendererTransformContext,
} from "../registry/rendererRegistry"

export {
  createFormStateAdapter,
  type FieldSnapshotSource,
  type FieldStateSnapshot,
  type FormStateAdapter,
  type SnapshotSource,
} from "./formStateAdapter"
