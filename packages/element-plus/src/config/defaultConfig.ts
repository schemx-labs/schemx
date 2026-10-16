/**
 * Element Plus 适配包的默认 Registry 与局部配置。
 *
 * 默认配置由本包表单组件和 Hook 提供，不写入 Core 或 Vue 全局。
 *
 * @module config/defaultConfig
 */

import { createPresetRuleRegistry, createRendererRegistry } from "@schemx/core"

import { ElementPlusCol } from "../layout/defaultCol"
import { ElementPlusRow } from "../layout/defaultRow"
import { defaultRenderers } from "../renderers/defaultRenderers"

import type { PresetRuleRegistry, SchemxConfig } from "@schemx/core"

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
 * 可通过 App 安装选项复用的 Element Plus 默认配置。
 */
export const defaultConfig: SchemxConfig = {
  rendererRegistry,
  presetRuleRegistry,
  colComponent: ElementPlusCol,
  rowComponent: ElementPlusRow,
  schemaConfig: {
    col: { span: 24 },
    row: { gutter: [14, 0] },
    labelAlign: "right",
    labelWidth: 120,
    labelPosition: "left",
    contentAlign: "left",
    bordered: false,
    actionCol: {
      offset: 6,
      span: 12,
    },
  },
}
