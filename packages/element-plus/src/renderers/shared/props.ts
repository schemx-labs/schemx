/**
 * Element Plus Renderer 属性处理工具。
 *
 * 将 Schemx 的运行时控制属性从 Element Plus 原生属性中剔除，避免字段上下文
 * 和表单内部数据被错误透传给控件。
 */

/** Schemx 内部使用、不能透传给 UI 控件的属性名。 */
const INTERNAL_RENDERER_PROPS = new Set([
  "value",
  "onChange",
  "onBlur",
  "onFocus",
  "onUpdate:value",
  "formInstance",
  "formItemProps",
  "className",
  "readonlyPlaceholder",
  "dict",
  "fieldName",
  "contentAlign",
])

/**
 * 合并并过滤 Renderer 的原生控件属性。
 *
 * @param props - Renderer 已声明的属性。
 * @param attrs - Renderer 未声明的透传属性。
 * @param extraKeys - 当前 Renderer 额外需要过滤的属性名。
 * @returns 可传给 Element Plus 控件的属性对象。
 */
export function getElementProps<TProps extends object>(
  props: TProps,
  attrs: Record<string, unknown>,
  extraKeys: readonly string[] = []
): Record<string, unknown> {
  const excluded = new Set([...INTERNAL_RENDERER_PROPS, ...extraKeys])

  const result: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(attrs)) {
    if (!excluded.has(key)) result[key] = value
  }

  for (const [key, value] of Object.entries(props)) {
    if (!excluded.has(key)) result[key] = value
  }

  return result
}

/**
 * 从 Renderer Props 中提取表单项之外的 CSS 类名。
 *
 * @param className - Renderer 自定义类名。
 * @returns 可用于根节点的类名值。
 */
export function getRendererClassName(className = ""): string[] {
  return ["schemx-renderer", className].filter(Boolean)
}
