import { describe, expect, test } from "vite-plus/test"

import * as elementPlusPackage from "../index"
import { defaultConfig, getConfig, presetRuleRegistry, rendererRegistry } from "../index"
import { ElementPlusCol } from "../layout/defaultCol"
import { ElementPlusRow } from "../layout/defaultRow"
import { DEFAULT_RENDERER_TYPES } from "../renderers"

describe("@schemx/element-plus 根入口", () => {
  test("导出可复用的默认配置，并保留 Registry 引用身份", () => {
    for (const alias of [
      "getGlobalSchemxConfig",
      "mergeSchemxConfig",
      "createFormContext",
      "createFormConfigContext",
    ]) {
      expect(alias in elementPlusPackage).toBe(false)
    }

    expect("createSchemx" in elementPlusPackage).toBe(false)
    expect("provideSchemxFormRuntime" in elementPlusPackage).toBe(false)
    expect(defaultConfig.rendererRegistry).toBe(rendererRegistry)
    expect(defaultConfig.presetRuleRegistry).toBe(presetRuleRegistry)
    expect(getConfig().rendererRegistry).toBe(rendererRegistry)
    expect(getConfig().presetRuleRegistry).toBe(presetRuleRegistry)
  })
  test("导出 Element Plus Renderer 公共 API", () => {
    expect(elementPlusPackage).toMatchObject({
      InputRenderer: expect.any(Object),
      InputNumberRenderer: expect.any(Object),
      SwitchRenderer: expect.any(Object),
      RadioRenderer: expect.any(Object),
      CheckboxRenderer: expect.any(Object),
      DatePickerRenderer: expect.any(Object),
      CascaderRenderer: expect.any(Object),
      SensitiveInputRenderer: expect.any(Object),
      RateRenderer: expect.any(Object),
      SliderRenderer: expect.any(Object),
      UploadRenderer: expect.any(Object),
      AutocompleteRenderer: expect.any(Object),
      ColorPickerRenderer: expect.any(Object),
      DateTimePickerRenderer: expect.any(Object),
      InputTagRenderer: expect.any(Object),
      InputOtpRenderer: expect.any(Object),
      MentionRenderer: expect.any(Object),
      SelectRenderer: expect.any(Object),
      VirtualizedSelectRenderer: expect.any(Object),
      TimePickerRenderer: expect.any(Object),
      TimeSelectRenderer: expect.any(Object),
      TreeSelectRenderer: expect.any(Object),
      getReadonlyDisplayValue: expect.any(Function),
      isEmptyDisplayValue: expect.any(Function),
      Wrapper: expect.any(Object),
    })

    expect(DEFAULT_RENDERER_TYPES).toEqual([
      "input",
      "inputNumber",
      "switch",
      "radio",
      "checkbox",
      "datePicker",
      "cascader",
      "sensitiveInput",
      "rate",
      "slider",
      "upload",
      "autocomplete",
      "colorPicker",
      "datetimePicker",
      "inputTag",
      "inputOtp",
      "mention",
      "select",
      "virtualizedSelect",
      "timePicker",
      "timeSelect",
      "treeSelect",
    ])

    expect(DEFAULT_RENDERER_TYPES.every((type) => rendererRegistry.has(type))).toBe(true)

    expect(defaultConfig).toMatchObject({
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

    expect("NumberRenderer" in elementPlusPackage).toBe(false)
    expect("ElementPlusCol" in elementPlusPackage).toBe(false)
    expect("ElementPlusRow" in elementPlusPackage).toBe(false)
    expect("StepperRenderer" in elementPlusPackage).toBe(false)
    expect("CalendarRenderer" in elementPlusPackage).toBe(false)
    expect("PickerRenderer" in elementPlusPackage).toBe(false)
    expect("SelectPickerRenderer" in elementPlusPackage).toBe(false)
    expect("SelectorRenderer" in elementPlusPackage).toBe(false)
  })
})
