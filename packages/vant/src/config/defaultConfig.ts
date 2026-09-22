/**
 * Vant 适配包的默认 Registry 与全局配置。
 *
 * 根入口通过导出本模块的 Registry 触发默认配置初始化。
 *
 * @module config/defaultConfig
 */

import { configureSchemx } from "@schemx/core"
import {
  presetRuleRegistry as vuePresetRuleRegistry,
  rendererRegistry as vueRendererRegistry,
} from "@schemx/vue"

import { VantCol } from "../layout/defaultCol"
import { VantRow } from "../layout/defaultRow"
import { defaultRenderers } from "../renderers/defaultRenderers"

import type { PresetRuleRegistry, RendererRegistry } from "@schemx/core"

/** Vant 与 Vue 共用的全局 Renderer Registry。 */
export const rendererRegistry: RendererRegistry = vueRendererRegistry

/** Vant 与 Vue 共用的全局预设规则 Registry。 */
export const presetRuleRegistry: PresetRuleRegistry = vuePresetRuleRegistry

rendererRegistry.registerAll(defaultRenderers)

/**
 * 将 Vant 默认能力写入 Schemx 模块级全局配置。
 *
 * 业务可通过 Form Props 或 ConfigProvider 覆盖当前 Form；多个 UI 适配包同时导入时，
 * 最后执行的适配包配置会成为模块级全局默认值。
 */
configureSchemx({
  rendererRegistry,
  presetRuleRegistry,
  colComponent: VantCol,
  rowComponent: VantRow,
  schemaConfig: {
    col: { span: 24 },
    row: { gutter: [0, 0] },
    labelAlign: "right",
    labelPosition: "left",
    contentAlign: "left",
    errorAlign: "right",
    bordered: true,
  },
})
