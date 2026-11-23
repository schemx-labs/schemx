import { createForm, createRendererRegistry } from "../../index"

import type {
  FieldDictionaryOptionsAction,
  FieldDictionaryResult,
  FieldDictionarySnapshot,
  RendererDictionaryDescriptor,
} from "../../index"

const form = createForm<{ city: string }>({
  schemas: [
    {
      name: "city",
      label: "城市",
      componentType: "select",
      dict: (values) => [values.city],
    },
  ],
})

const snapshot: FieldDictionarySnapshot | undefined = form.getFieldDict("city")

const options: readonly unknown[] = form.getFieldDictOptions("city")

const status: "idle" | "loading" | "success" | "failed" | undefined =
  form.getFieldDict("city")?.status

const pending: Promise<FieldDictionaryResult> = form.refreshFieldDict("city")

// options 是当前只读列表，列表修改统一使用 action。
const updated: boolean = form.setFieldDictOptions("city", (options) =>
  options.filter(Boolean)
)

void snapshot
void options
void status
void pending
void updated

// @ts-expect-error 字段路径必须来自表单值类型。
form.getFieldDict("missing")

// @ts-expect-error 本地变更同步返回 boolean，不是 Promise。
const invalid: Promise<FieldDictionaryResult> = form.setFieldDictOptions("city", [
  { value: "SX" },
])

void invalid

// 公开 action 类型保留列表的元素类型；options 是当前只读城市选项。
const action: FieldDictionaryOptionsAction<{ value: string }> = (options) => [
  ...options,
  { value: "SX" },
]

// updater 以最新只读列表为输入，返回新列表。
const replaced: boolean = form.setFieldDictOptions("city", (options) => [
  ...options,
  { value: "SX" },
])

// @ts-expect-error updater 必须返回选项数组。
form.setFieldDictOptions("city", () => 1)

// options 是只读数组，禁止原地 push。
form.setFieldDictOptions("city", (options) => {
  // @ts-expect-error updater 的输入列表不可原地修改。
  options.push({ value: "SX" })

  return options
})

// API 中不应残留已移除的方法；任一旧名称仍存在都会要求这里提供属性。
const removedMethods: Record<
  Extract<
    keyof typeof form,
    | "getFieldDictStatus"
    | "isFieldDictLoading"
    | "getFieldDictError"
    | "hasFieldDict"
    | "addFieldDictOption"
    | "clearFieldDict"
    | "resetFieldDict"
    | "refreshFieldsDict"
    | "updateFieldDictOption"
    | "removeFieldDictOption"
  >,
  never
> = {}

// 快照不再包含持久本地补丁的统计。
// @ts-expect-error local 已随补丁层移除。
void form.getFieldDict("city")?.local

void action
void replaced
void removedMethods

// 注册表和表单入口均接受 Renderer 级字典配置。
const registry = createRendererRegistry()

const dictionary: RendererDictionaryDescriptor = {
  targetKey: "columns",
  keys: { labelKey: "name" },
}

registry.register("select", { component: {}, dictionary: true })
registry.registerAll({ select: { component: {}, dictionary }, input: {} })
form.registerRenderer("select", { component: {}, dictionary })

const rendererDictionary: RendererDictionaryDescriptor | undefined =
  registry.getEntry("select")?.dictionary

// @ts-expect-error Renderer 配置的目标是字符串属性名。
registry.register("select", { component: {}, dictionary: { targetKey: 1 } })

void rendererDictionary
