import type {
  SchemxField,
  SchemxViewDynamicSchema,
  SchemxViewFieldSchema,
  SchemxViewGroupSchema,
} from "../../index"

interface TestCol {
  span?: number
  offset?: number
  block?: boolean
}

interface TestRow {
  gutter?: number
  justify?: string
  align?: string
}

declare module "../../types/field" {
  interface SchemxFieldDefinition {
    col?: TestCol
    layout?: TestCol
    layoutFieldMeta?: string
  }
}

declare module "../../types/group" {
  interface SchemxGroupFieldDefinition {
    row?: TestRow
    layout?: TestCol
    layoutGroupMeta?: string
  }
}

declare module "../../types/dynamic" {
  interface SchemxDynamicDefinition {
    row?: TestRow
    layout?: TestCol
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
  col: { span: 12, offset: 0, block: true },
  layoutFieldMeta: "field",
}

const group: SchemxField<FormValues> = {
  label: "用户",
  row: {},
  layoutGroupMeta: "group",
  children: [field],
}

const dynamic: SchemxField<FormValues> = {
  key: "users",
  name: "users",
  row: {},
  layoutDynamicMeta: "dynamic",
  item: [
    {
      name: "name",
      label: "姓名",
      componentType: "input",
      col: { span: 12 },
      layoutFieldMeta: "dynamic-item",
    },
  ],
}

declare const fieldView: SchemxViewFieldSchema<FormValues>
declare const groupView: SchemxViewGroupSchema<FormValues>
declare const dynamicView: SchemxViewDynamicSchema<FormValues>

const fieldColSpan: number | undefined = fieldView.col?.span

const fieldMeta: string | undefined = fieldView.layoutFieldMeta

const groupRow: TestRow | undefined = groupView.row

const groupMeta: string | undefined = groupView.layoutGroupMeta

const dynamicRow: TestRow | undefined = dynamicView.row

const dynamicMeta: string | undefined = dynamicView.layoutDynamicMeta

const invalidLayout: TestCol = {
  // @ts-expect-error order 已从布局契约中移除。
  order: 1,
}

const invalidCol: TestCol = {
  // @ts-expect-error order 不属于 Col 配置。
  order: 1,
}

const row: TestRow = {}

void fieldColSpan
void fieldMeta
void groupRow
void groupMeta
void dynamicRow
void dynamicMeta
void invalidLayout
void invalidCol
void row
void group
void dynamic
