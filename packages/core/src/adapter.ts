/**
 * Core 的 UI Adapter SPI 入口。
 *
 * RendererRegistry 仅供 UI 适配层解析和注册渲染器；Form Runtime 不依赖该入口。
 * 应从 `@schemx/core/adapter` 导入，避免把适配层能力混入 Core 根 API。
 *
 * @module core/adapter
 */

export {
  createRendererRegistry,
  RendererRegistry,
  type RendererMap,
} from "./registry/rendererRegistry"
