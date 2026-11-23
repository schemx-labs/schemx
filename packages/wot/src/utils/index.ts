/**
 * Wot UI 渲染器工具函数
 *
 * 提供渲染器组件中常用的属性提取、树形数据查找、文件名解析等工具。
 *
 * @module utils
 */

/**
 * 从 attrs 对象中获取指定属性值，不存在时返回默认值。
 *
 * 用于从 Vue 组件的 `attrs` 中安全地提取透传属性，
 * 常见场景如获取 `align`、`rightIcon` 等字段配置。
 *
 * @param attrs - Vue 组件的 attrs 对象
 * @param key - 属性名
 * @param defaultValue - 默认值
 *
 * @returns 属性值或默认值
 *
 * @example
 * getFieldProps(attrs, "align", "right")
 * getFieldProps(attrs, "rightIcon", "arrow")
 */
export function getFieldProps<T extends Record<string, any>>(
  attrs: T,
  key: keyof T,
  defaultValue: T[typeof key] = undefined as T[typeof key]
): T[typeof key] {
  return attrs?.[key] ?? defaultValue
}

/**
 * 树形查找结果
 */
export interface FindTreeItemResult {
  /** 匹配节点 */
  node: Record<string, any> | null
  /** 从根到匹配节点的 label 路径 */
  labels: string[]
  /** 从根到匹配节点的 value 路径 */
  values: any[]
}

/**
 * 在树形数据中查找指定值的节点，返回匹配节点及其路径信息。
 *
 * 支持自定义字段名映射，适用于 Cascader、Picker 等树形选择组件。
 *
 * @param tree - 树形数据数组
 * @param targetValue - 要查找的目标值
 * @param options - 字段名配置
 * @param options.labelKey - label 字段名，默认 `"label"`
 * @param options.valueKey - value 字段名，默认 `"value"`
 * @param options.childrenKey - children 字段名，默认 `"children"`
 *
 * @returns 查找结果，包含匹配节点、label 路径和 value 路径
 *
 * @example
 * const result = findTreeItem(options, "guangzhou", {
 *   labelKey: "text",
 *   valueKey: "value",
 *   childrenKey: "children",
 * })
 * // result.labels => ["广东", "广州"]
 * // result.values => ["guangdong", "guangzhou"]
 */
export function findTreeItem(
  tree: any[],
  targetValue: any,
  options: {
    labelKey?: string
    valueKey?: string
    childrenKey?: string
  } = {}
): FindTreeItemResult {
  const { labelKey = "label", valueKey = "value", childrenKey = "children" } = options
  const result: FindTreeItemResult = { node: null, labels: [], values: [] }

  if (!Array.isArray(tree) || targetValue === undefined || targetValue === null) {
    return result
  }

  const search = (
    nodes: any[],
    labels: string[],
    values: any[]
  ): FindTreeItemResult | null => {
    for (const node of nodes) {
      const currentLabels = [...labels, node[labelKey]]
      const currentValues = [...values, node[valueKey]]

      if (node[valueKey] === targetValue) {
        return { node, labels: currentLabels, values: currentValues }
      }

      if (Array.isArray(node[childrenKey]) && node[childrenKey].length > 0) {
        const found = search(node[childrenKey], currentLabels, currentValues)

        if (found) return found
      }
    }

    return null
  }

  return search(tree, [], []) || result
}

/**
 * 从 URL 或文件路径中提取文件名。
 *
 * 去除查询参数和 hash 后，取最后一段路径作为文件名。
 * 用于上传组件中生成文件的唯一标识。
 *
 * @param url - 文件 URL 或路径
 *
 * @returns 文件名字符串，无法解析时返回原始输入或时间戳
 *
 * @example
 * getFileName("https://cdn.example.com/uploads/photo.jpg?t=123")
 * // => "photo.jpg"
 *
 * getFileName("blob:http://localhost:3000/abc-def")
 * // => "abc-def"
 */
export function getFileName(url: string | undefined | null): string {
  if (!url) return String(Date.now())

  try {
    const cleanUrl = url.split("?")[0].split("#")[0]
    const parts = cleanUrl.split("/")
    const fileName = parts[parts.length - 1]

    return fileName || String(Date.now())
  } catch {
    return String(Date.now())
  }
}
