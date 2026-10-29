/**
 * 注册中心模块。
 *
 * 聚合渲染器和校验规则注册中心。
 *
 * @module core/registry
 */

export { type RegistryOptions } from "./types"

export {
  createRendererRegistry,
  type RendererRegistry,
  type RendererDescriptor,
  type RendererEntry,
  type RendererMap,
  type RendererPropsTransformer,
  type RendererRegistration,
  type RendererTransformContext,
} from "./rendererRegistry"

export {
  createPresetRuleRegistry,
  type PresetRuleRegistry,
  type PresetRuleFactoryContext,
  type PresetRuleFactory,
  type PresetRuleEntry,
  type PresetRuleMap,
  type PresetRuleRegistryChange,
  type PresetRuleRegistryListener,
} from "./presetRuleRegistry"
