import { describe, expect, test } from "vite-plus/test"

import * as vantPackage from "../index"
import { defaultConfig, getConfig, presetRuleRegistry, rendererRegistry } from "../index"
import { VantCol } from "../layout/defaultCol"
import { VantRow } from "../layout/defaultRow"

describe("@schemx/vant 根入口", () => {
  test("导出可复用的默认配置，并保留 Registry 引用身份", () => {
    for (const alias of [
      "getGlobalSchemxConfig",
      "mergeSchemxConfig",
      "createFormContext",
      "createFormConfigContext",
    ]) {
      expect(alias in vantPackage).toBe(false)
    }

    expect("createSchemx" in vantPackage).toBe(false)
    expect("provideSchemxFormRuntime" in vantPackage).toBe(false)
    expect(defaultConfig.rendererRegistry).toBe(rendererRegistry)
    expect(defaultConfig.presetRuleRegistry).toBe(presetRuleRegistry)
    expect(getConfig().rendererRegistry).toBe(rendererRegistry)
    expect(getConfig().presetRuleRegistry).toBe(presetRuleRegistry)
  })
  test("导出渲染器公共工具", () => {
    expect(vantPackage).toMatchObject({
      getReadonlyDisplayValue: expect.any(Function),
      isEmptyDisplayValue: expect.any(Function),
      isRendererInteractive: expect.any(Function),
      resolveRendererMode: expect.any(Function),
      presetRuleRegistry: expect.any(Object),
      createPresetRuleRegistry: expect.any(Function),
      Wrapper: expect.any(Object),
    })

    expect(defaultConfig).toMatchObject({
      rendererRegistry,
      presetRuleRegistry,
      colComponent: VantCol,
      rowComponent: VantRow,
      schemaConfig: {
        col: { span: 24 },
        row: { gutter: [0, 0] },
        labelAlign: "right",
        labelPosition: "left",
        contentAlign: "right",
        bordered: true,
      },
    })

    expect(["validator", "Registry"].join("") in vantPackage).toBe(false)
    expect("PresetRuleRegistry" in vantPackage).toBe(false)
    expect("RendererRegistry" in vantPackage).toBe(false)
    expect("VantCol" in vantPackage).toBe(false)
    expect("VantRow" in vantPackage).toBe(false)
    expect(["create", "Validators", "Registry"].join("") in vantPackage).toBe(false)
  })
})
