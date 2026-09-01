/**
 * 注册中心模块。
 *
 * 聚合渲染器注册中心和校验规则注册中心的公开 API。
 * 用于注册自定义组件渲染器和校验规则工厂。
 *
 * @module core/registry
 */

export { type RegistryOptions } from "./types"

export {
  createRendererRegistry,
  RendererRegistry,
  type RendererMap,
} from "./rendererRegistry"

export {
  createPresetRuleRegistry,
  PresetRuleRegistry,
  type PresetRuleFactoryContext,
  type PresetRuleFactory,
  type PresetRuleEntry,
  type PresetRuleMap,
  type PresetRuleRegistryChange,
  type PresetRuleRegistryListener,
} from "./presetRuleRegistry"
