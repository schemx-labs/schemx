import type { StyleValue } from "vue"

declare module "@schemx/core" {
  interface SchemxFieldDefinition {
    /** 追加到 Field 外层容器元素上的自定义 CSS 类名。 */
    class?: string

    /** 应用到 Field 外层容器元素上的自定义内联样式。 */
    style?: StyleValue
  }

  interface SchemxGroupFieldDefinition {
    /** 追加到 Group 外层容器元素上的自定义 CSS 类名。 */
    class?: string

    /** 应用到 Group 外层容器元素上的自定义内联样式。 */
    style?: StyleValue
  }
}

export * from "./dictionary"

export * from "./form"

export * from "./field"
