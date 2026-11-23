import * as CSS from "csstype"

import type {
  SchemxRendererDefinition,
  SchemxRuleDefinition,
  SchemxFieldDefinition,
  SchemxGroupFieldDefinition,
} from "@schemx/core"

declare module "@schemx/core" {
  interface SchemxFieldDefinition {
    /**
     * 自定义 CSS 类名
     *
     * 追加到表单项容器元素上，与内置类名合并。
     */
    class?: string

    /**
     * 自定义内联样式
     *
     * 应用到表单项容器元素上。
     */
    style?: CSS.Properties
  }

  interface SchemxGroupFieldDefinition {
    /**
     * 自定义 CSS 类名
     *
     * 追加到表单项容器元素上，与内置类名合并。
     */
    class?: string

    /**
     * 自定义内联样式
     *
     * 应用到表单项容器元素上。
     */
    style?: CSS.Properties
  }
}
