// 默认导出内置 Button 组件。
export { default } from "./index.vue"

// 导出内置 Button 的 Props 与尺寸类型。
export type {
  SchemxButtonComponent,
  SchemxButtonDefinition,
  SchemxButtonProps,
  SchemxButtonSize,
  SchemxDefaultButtonOptions,
  SchemxButtonOptions,
} from "./types"

export { default as DefaultButton } from "./default.vue"
