import type { SchemxColConfig, SchemxField, SchemxRowConfig } from "../../index"

const col: SchemxColConfig = {
  span: 12,
  offset: 1,
  tag: "section",
}

const row: SchemxRowConfig = {
  gutter: [1, 2, 3, 4],
  justify: "center",
  align: "middle",
  tag: "section",
  wrap: true,
}

const field: SchemxField = {
  name: "name",
  label: "姓名",
  componentType: "input",
  col,
}

void col
void row
void field
