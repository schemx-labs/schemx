/** Element Plus 选项标准化与只读展示工具。 */

type ElementOptionValue = string | number | boolean

interface ElementFieldNames {
  label?: string
  value?: string
  disabled?: string
  children?: string
}

interface ElementOption {
  label?: string
  value?: ElementOptionValue
  disabled?: boolean
  [key: string]: unknown
}

/**
 * 将 Schemx 选项映射为 Element Plus 默认的 label/value/disabled 结构。
 *
 * @param options - 待映射的选项列表。
 * @param fieldNames - 选项字段名映射。
 * @returns 可传给 Element Plus 的规范化选项列表。
 */
export function normalizeElementOptions(
  options: readonly ElementOption[] | undefined,
  fieldNames: ElementFieldNames = {}
): ElementOption[] {
  const labelKey = fieldNames.label ?? "label"

  const valueKey = fieldNames.value ?? "value"

  const disabledKey = fieldNames.disabled ?? "disabled"

  return (options ?? []).map((option) => ({
    ...option,
    label: String(option[labelKey] ?? option[valueKey] ?? ""),
    value: option[valueKey] as ElementOptionValue | undefined,
    disabled: Boolean(option[disabledKey]),
  }))
}

/**
 * 根据字段映射读取选项值。
 *
 * @param option - 当前选项。
 * @param fieldNames - 选项字段名映射。
 * @returns 选项的基础值。
 */
export function getElementOptionValue(
  option: ElementOption,
  fieldNames: ElementFieldNames = {}
): ElementOptionValue | undefined {
  return option[fieldNames.value ?? "value"] as ElementOptionValue | undefined
}

/**
 * 根据字段映射读取选项标签。
 *
 * @param option - 当前选项。
 * @param fieldNames - 选项字段名映射。
 * @returns 选项的显示文本。
 */
export function getElementOptionLabel(
  option: ElementOption,
  fieldNames: ElementFieldNames = {}
): string {
  const label = option[fieldNames.label ?? "label"]

  const value = getElementOptionValue(option, fieldNames)

  return String(label ?? value ?? "")
}

/**
 * 将一个或多个选项值转换为只读展示文本。
 *
 * @param value - 当前字段值。
 * @param options - 可用于反查标签的选项列表。
 * @param fieldNames - 选项字段名映射。
 * @param separator - 多选值之间的分隔符。
 * @returns 选项标签拼接后的文本。
 */
export function getElementOptionDisplayValue(
  value: ElementOptionValue | ElementOptionValue[] | null | undefined,
  options: readonly ElementOption[],
  fieldNames: ElementFieldNames = {},
  separator = "、"
): string {
  const values = Array.isArray(value) ? value : [value]

  return values
    .filter((item): item is ElementOptionValue => item !== null && item !== undefined)
    .map((item) => {
      const option = options.find(
        (candidate) => getElementOptionValue(candidate, fieldNames) === item
      )

      return option ? getElementOptionLabel(option, fieldNames) : String(item)
    })
    .join(separator)
}

/**
 * 判断值是否属于选择类 Renderer 支持的基础值。
 *
 * @param value - 待判断的运行时值。
 * @returns 是否为 string、number 或 boolean。
 */
export function isElementOptionValue(value: unknown): value is ElementOptionValue {
  return (
    typeof value === "string" || typeof value === "number" || typeof value === "boolean"
  )
}

/**
 * 规范化选择类 Renderer 的单选或多选值。
 *
 * @param value - Element Plus 产生的运行时值。
 * @param multiple - 是否处于多选模式。
 * @returns Schemx 选择类 Renderer 的基础值契约。
 */
export function normalizeElementSelection(
  value: unknown,
  multiple = false
): ElementOptionValue | ElementOptionValue[] | null {
  if (multiple) {
    if (!Array.isArray(value)) return []

    return value.filter(isElementOptionValue)
  }

  return isElementOptionValue(value) ? value : null
}
