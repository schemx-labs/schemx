/**
 * Descriptor 类型守卫与辅助函数。
 *
 * 提供 descriptor 类型判断的统一入口，避免散落的 `descriptor.type === "field"`
 * 字面量比较。
 *
 * @module core/runtime/descriptor/helper
 */

import type {
  DependencyDescriptor,
  FieldDescriptor,
  FormDescriptor,
  GroupDescriptor,
} from "./types"
import type { Values } from "../../types"

/**
 * 判断 descriptor 是否为 FieldDescriptor。
 *
 * @typeParam TValues - 表单值类型。
 * @param descriptor - 待判断的 descriptor。
 * @returns 为字段描述符时返回 true。
 */
export function isFieldDescriptor<TValues extends Values>(
  descriptor: FormDescriptor<TValues>
): descriptor is FieldDescriptor<TValues> {
  return descriptor.type === "field"
}

/**
 * 判断 descriptor 是否为 GroupDescriptor。
 *
 * @typeParam TValues - 表单值类型。
 * @param descriptor - 待判断的 descriptor。
 * @returns 为分组描述符时返回 true。
 */
export function isGroupDescriptor<TValues extends Values>(
  descriptor: FormDescriptor<TValues>
): descriptor is GroupDescriptor<TValues> {
  return descriptor.type === "group"
}

/**
 * 判断 descriptor 是否为 DependencyDescriptor。
 *
 * @typeParam TValues - 表单值类型。
 * @param descriptor - 待判断的 descriptor。
 * @returns 为依赖描述符时返回 true。
 */
export function isDependencyDescriptor<TValues extends Values>(
  descriptor: FormDescriptor<TValues>
): descriptor is DependencyDescriptor<TValues> {
  return descriptor.type === "dependency"
}
