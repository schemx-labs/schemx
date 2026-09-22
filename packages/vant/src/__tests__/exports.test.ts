import { describe, expect, test } from "vitest"

import * as vantPackage from "../index"
import { getGlobalSchemxConfig, presetRuleRegistry, rendererRegistry } from "../index"
import { VantCol } from "../layout/defaultCol"
import { VantRow } from "../layout/defaultRow"

describe("@schemx/vant 根入口", () => {
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

    expect(getGlobalSchemxConfig()).toMatchObject({
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
