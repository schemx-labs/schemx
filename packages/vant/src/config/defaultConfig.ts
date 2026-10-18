/**
 * Vant 适配包的默认 Registry 与局部配置。
 *
 * 默认配置由本包表单组件和 Hook 提供，不写入 Core 或 Vue 全局。
 *
 * @module config/defaultConfig
 */

import { createPresetRuleRegistry, createRendererRegistry } from "@schemx/core"

import { VantButton } from "../components/Button"
import { VantCol } from "../layout/defaultCol"
import { VantRow } from "../layout/defaultRow"
import { defaultRenderers } from "../renderers/defaultRenderers"

import type {
  CreateSchemxOptions,
  PresetRuleRegistry,
  RendererRegistry,
} from "@schemx/core"

/** Vant 适配包独立的 Renderer Registry。 */
export const rendererRegistry: RendererRegistry = createRendererRegistry("input")

/** Vant 适配包独立的预设规则 Registry。 */
export const presetRuleRegistry: PresetRuleRegistry = createPresetRuleRegistry()

rendererRegistry.registerAll(defaultRenderers)

/**
 * 可通过 App 安装选项复用的 Vant 默认配置。
 */
export const defaultConfig: Readonly<CreateSchemxOptions> =
  Object.freeze<CreateSchemxOptions>({
    rendererRegistry,
    presetRuleRegistry,
    colComponent: VantCol,
    rowComponent: VantRow,
    buttonComponent: VantButton,
    submitter: {
      buttonProps: {
        type: "primary",
        class: "schemx-vant-button",
      },
    },
    resetter: {
      buttonProps: {
        class: "schemx-vant-button",
      },
    },
    schemaConfig: Object.freeze<NonNullable<CreateSchemxOptions["schemaConfig"]>>({
      col: { span: 24 },
      row: { gutter: [0, 0] },
      labelAlign: "right",
      labelPosition: "left",
      contentAlign: "right",
      errorAlign: "right",
      bordered: true,
    }),
  })
