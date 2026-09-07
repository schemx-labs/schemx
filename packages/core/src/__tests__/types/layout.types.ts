import type {
  SchemxField,
  SchemxLayout,
  SchemxViewDynamicSchema,
  SchemxViewFieldSchema,
  SchemxViewGroupSchema,
} from "../../index"

declare module "../../types/field" {
  interface SchemxFieldDefinition {
    layoutFieldMeta?: string
  }
}

declare module "../../types/group" {
  interface SchemxGroupFieldDefinition {
    layoutGroupMeta?: string
  }
}

declare module "../../types/dynamic" {
  interface SchemxDynamicDefinition {
    layoutDynamicMeta?: string
  }
}

interface FormValues {
  users: Array<{
    name: string
  }>
}

const field: SchemxField<FormValues> = {
  name: "users.0.name",
  label: "姓名",
  componentType: "input",
  layout: { span: 12, offset: 0, block: true },
  layoutFieldMeta: "field",
}

const group: SchemxField<FormValues> = {
  label: "用户",
  layout: { span: 24 },
  layoutGroupMeta: "group",
  children: [field],
}

const dynamic: SchemxField<FormValues> = {
  key: "users",
  name: "users",
  layout: { span: 24 },
  layoutDynamicMeta: "dynamic",
  item: [
    {
      name: "name",
      label: "姓名",
      componentType: "input",
      layout: { span: 12 },
      layoutFieldMeta: "dynamic-item",
    },
  ],
}

declare const fieldView: SchemxViewFieldSchema<FormValues>
declare const groupView: SchemxViewGroupSchema<FormValues>
declare const dynamicView: SchemxViewDynamicSchema<FormValues>

const fieldLayoutSpan: number | undefined = fieldView.layout?.span

const fieldMeta: string | undefined = fieldView.layoutFieldMeta

const groupLayoutOffset: number | undefined = groupView.layout?.offset

const groupMeta: string | undefined = groupView.layoutGroupMeta

const dynamicLayoutFullLine: boolean | undefined = dynamicView.layout?.block

const dynamicMeta: string | undefined = dynamicView.layoutDynamicMeta

const invalidLayout: SchemxLayout = {
  // @ts-expect-error order 已从布局契约中移除。
  order: 1,
}

void fieldLayoutSpan
void fieldMeta
void groupLayoutOffset
void groupMeta
void dynamicLayoutFullLine
void dynamicMeta
void invalidLayout
void group
void dynamic
