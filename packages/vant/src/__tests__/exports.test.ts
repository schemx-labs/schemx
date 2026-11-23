import * as vuePackage from "@schemx/vue"
import { describe, expect, test } from "vite-plus/test"

import * as vantPackage from "../index"
import { defaultConfig, getConfig, presetRuleRegistry, rendererRegistry } from "../index"
import { VantCol } from "../layout/defaultCol"
import { VantRow } from "../layout/defaultRow"

describe("@schemx/vant 根入口", () => {
  test("默认 Registry 直接注册原始组件", () => {
    expect(rendererRegistry.getEntry("picker")?.component).toBe(
      vantPackage.PickerRenderer
    )
  })

  test("内置 Renderer 通过普通注册接收 Core 字典选项", async () => {
    // 本包内置字段使用自己的 Registry 和原始组件。
    const form = vantPackage.createForm({
      initialValues: { city: "" },
      schemas: [
        {
          name: "city",
          label: "城市",
          componentType: "picker",
          dict: () => [{ text: "杭州", value: "HZ" }],
        },
      ],
    })

    await form.waitForDependencies()
    expect(form.getViewSchemas()[0]).toMatchObject({
      componentProps: { options: [{ text: "杭州", value: "HZ" }], loading: false },
    })
    form.destroy()
  })
  test("透传 Vue API，并保留本包默认配置与 Registry", () => {
    expect(vantPackage.createSchemx).toBe(vuePackage.createSchemx)
    expect(vantPackage).not.toHaveProperty("getGlobalSchemxConfig")
    expect("mergeSchemxConfig" in vantPackage).toBe(false)

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
