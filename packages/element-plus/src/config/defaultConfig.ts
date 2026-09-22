/**
 * Element Plus 适配包的默认 Registry 与全局配置。
 *
 * 根入口通过导出本模块的 Registry 触发默认配置初始化。
 *
 * @module config/defaultConfig
 */

import {
  configureSchemx,
  createPresetRuleRegistry,
  createRendererRegistry,
} from "@schemx/core"

import { ElementPlusCol } from "../layout/defaultCol"
import { ElementPlusRow } from "../layout/defaultRow"
import { defaultRenderers } from "../renderers/defaultRenderers"

import type { PresetRuleRegistry } from "@schemx/core"

/** 创建 Element Plus 适配包默认使用的 Renderer Registry。 */
function createElementPlusRendererRegistry() {
  const registry = createRendererRegistry("input")

  registry.registerAll(defaultRenderers)

  return registry
}

/** Element Plus 适配包默认 Renderer Registry。 */
export const rendererRegistry = createElementPlusRendererRegistry()

/** Element Plus 适配包默认校验规则 Registry。 */
export const presetRuleRegistry: PresetRuleRegistry = createPresetRuleRegistry()

/**
 * 将 Element Plus 默认能力写入 Schemx 模块级全局配置。
 *
 * 业务可通过 Form Props 或 ConfigProvider 覆盖当前 Form；多个 UI 适配包同时导入时，
 * 最后执行的适配包配置会成为模块级全局默认值。
 */
configureSchemx({
  rendererRegistry,
  presetRuleRegistry,
  colComponent: ElementPlusCol,
  rowComponent: ElementPlusRow,
  schemaConfig: {
    col: { span: 12 },
    row: { gutter: [14, 0] },
    labelAlign: "right",
    labelWidth: 120,
    labelPosition: "left",
    contentAlign: "left",
    bordered: false,
  },
})
