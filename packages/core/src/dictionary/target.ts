/**
 * 字典与 Renderer 的属性边界。
 */

/**
 * 字典不得覆盖的字段控制与对象保留属性。
 */
const RESERVED_TARGETS = [
  "value",
  "modelValue",
  "onChange",
  "onBlur",
  "onUpdate:value",
  "onUpdate:modelValue",
  "disabled",
  "readonly",
  "placeholder",
  "readonlyPlaceholder",
  "loading",
  "formItemProps",
  "dict",
  "key",
  "ref",
  "__proto__",
  "constructor",
  "prototype",
] as const

/**
 * 声明推导中排除的字典目标。
 */
export type ReservedDictionaryTarget = (typeof RESERVED_TARGETS)[number]

/**
 * 解析字典注入属性，并阻止运行时配置覆盖受控属性。
 * @param targetKey - 字段声明的目标，省略时写入 options。
 * @returns 可以写入 ViewSchema 的属性名。
 * @example resolveDictionaryTarget(undefined) // "options"
 */
export function resolveDictionaryTarget(targetKey: string | undefined): string {
  // 默认目标沿用所有内置选项组件的约定。
  const target = targetKey === undefined ? "options" : targetKey

  if (
    typeof target !== "string" ||
    !target.trim() ||
    RESERVED_TARGETS.some((key) => key === target)
  ) {
    throw new TypeError(`[schemx] 不能将字段字典注入组件属性 "${String(target)}"。`)
  }

  return target
}
