import * as vuePackage from "@schemx/vue"
import { describe, expect, test } from "vite-plus/test"

import * as vantPackage from "../index"
import { defaultConfig, getConfig, presetRuleRegistry, rendererRegistry } from "../index"
import { VantCol } from "../layout/defaultCol"
import { VantRow } from "../layout/defaultRow"

describe("@schemx/vant 根入口", () => {
  test("透传 Vue API，并保留本包默认配置与 Registry", () => {
    expect(vantPackage.createSchemx).toBe(vuePackage.createSchemx)
    expect(vantPackage.getGlobalSchemxConfig).toBe(vuePackage.getGlobalSchemxConfig)
    expect(vantPackage.mergeSchemxConfig).toBe(vuePackage.mergeSchemxConfig)

    expect(vantPackage.createFormContext).toEqual(expect.any(Function))
    expect(vantPackage.createFormConfigContext).toEqual(expect.any(Function))
    expect(vantPackage.provideSchemxAppConfig).toBe(vuePackage.provideSchemxAppConfig)
    expect(vantPackage.createFormComponent).toBe(vuePackage.createFormComponent)
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
