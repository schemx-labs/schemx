import type { SchemxColConfig, SchemxField, SchemxRowConfig } from "../../index"

const col: SchemxColConfig = {
  span: 12,
  offset: 1,
  tag: "section",
  push: 1,
  pull: 1,
  xs: 24,
}

const row: SchemxRowConfig = {
  gutter: [4, 8],
  justify: "space-evenly",
  align: "middle",
  tag: "section",
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
