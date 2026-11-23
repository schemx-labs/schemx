/**
 * 对象浅比较工具
 *
 * @module utils/equal
 */

/**
 * 浅比较两个对象的自有属性值是否相同。
 *
 * 用于避免 computed / shallowRef 每次返回新对象引用导致子组件不必要的更新。
 * 仅比较第一层属性，函数引用通过 === 判断。
 *
 * @param a - 旧对象
 * @param b - 新对象
 *
 * @returns 两个对象浅相等时返回 true
 *
 * @example
 * shallowEqual({ a: 1, b: 2 }, { a: 1, b: 2 }) // => true
 * shallowEqual({ a: 1 }, { a: 1, b: 2 })        // => false
 */
export const isShallowEqual = (
  a: Record<string, any>,
  b: Record<string, any>
): boolean => {
  const keysA = Object.keys(a)
  const keysB = Object.keys(b)
  if (keysA.length !== keysB.length) return false

  return keysA.every((key) => a[key] === b[key])
}
