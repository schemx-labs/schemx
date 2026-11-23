/**
 * 渲染器类型体系。
 *
 * 定义渲染器的类型注册、Props 映射和上下文接口。
 * 用户可通过声明合并扩展 {@link SchemxRendererDefinition} 来注册自定义渲染器类型。
 *
 * @module types/renderer
 */

/* eslint-disable @typescript-eslint/no-empty-object-type */

import { Values } from "./form"

/**
 * 渲染器 Props 映射扩展接口。
 *
 * 用户通过声明合并（declaration merging）扩展此接口，
 * 将自定义渲染器类型字符串映射到其对应的 Props 接口，
 * 从而实现 `componentType` 与 `componentProps` 之间的严格类型关联。
 *
 * @module types/rendererPropsMap
 *
 * @example
 * ```ts
 * // 在项目中创建 schemx.d.ts
 * declare module '@schemx/core' {
 *   interface SchemxRendererDefinition {
 *     'my-input': MyInputProps
 *     'rich-editor': RichEditorProps
 *   }
 * }
 * ```
 *
 * @remarks
 * 扩展后，`SchemxRendererKey` 会自动推导出所有已注册的渲染器类型字符串，
 * `SchemxBase` 的 `componentProps` 也会根据 `componentType` 自动关联对应的 Props 类型。
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export interface SchemxRendererDefinition<T extends Values> {}

/**
 * 渲染器注册 key 类型
 *
 * 由 {@link SchemxRendererDefinition} 的键自动推导，
 * 用户通过声明合并扩展 `SchemxRendererDefinition` 后，此类型会自动包含所有已注册的渲染器类型字符串。
 * 当 SchemxRendererDefinition 为空时，退化为 `string`。
 *
 * @example
 * ```ts
 * // 扩展 SchemxRendererDefinition 后自动可用
 * const type: SchemxRendererKey = 'my-input'
 * ```
 */
export type SchemxRendererKey = [keyof SchemxRendererDefinition<Values>] extends [never]
  ? string
  : keyof SchemxRendererDefinition<Values>
