/**
 * Vue 对 Core Schema、Renderer Props 与展示配置的声明合并入口。
 *
 * @module types
 */

import "./index"

export type { SchemxVueTypeAugmentations } from "./definition"

export * from "./dictionary"

export * from "./form"

export type { SchemxInstance } from "./instance"

export * from "./field"

export * from "./layout"

export * from "./icon"

export type {
  SchemxButtonComponent,
  SchemxButtonDefinition,
  SchemxButtonOptions,
  SchemxButtonProps,
  SchemxButtonSize,
} from "../components/Button"
