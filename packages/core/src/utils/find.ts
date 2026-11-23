/**
 * 树结构输入类型。
 *
 * 可以是一棵树的根节点，也可以是一组树节点。
 *
 * @typeParam TNode - 树节点类型。
 *
 * @example
 * ```ts
 * const singleTree: TreeInput<TreeNode> = rootNode
 * const forest: TreeInput<TreeNode> = [node1, node2]
 * ```
 */
export type TreeInput<TNode> = TNode | readonly TNode[]

/**
 * BFS 树查询配置项。
 *
 * @typeParam TNode - 树节点类型。
 */
export interface TreeTraverseOptions<TNode> {
  /**
   * 获取当前节点的子节点。
   *
   * 如果不传入该参数，默认会尝试读取节点上的 `children` 字段。
   *
   * @param node - 当前遍历到的树节点。
   * @returns 当前节点的子节点数组。如果没有子节点，可以返回 `undefined`、`null` 或空数组。
   *
   * @example
   * ```ts
   * findNodeBFS(tree, node => node.id === '1-1', {
   *   getChildren: node => node.children,
   * })
   * ```
   *
   * @example
   * ```ts
   * // 自定义 children 字段
   * findNodeBFS(menuTree, node => node.key === 'user', {
   *   getChildren: node => node.items,
   * })
   * ```
   */
  getChildren?: (node: TNode) => TNode[] | undefined | null
}

/**
 * 默认获取子节点的方法。
 *
 * 默认会尝试读取节点上的 `children` 字段。
 *
 * @typeParam TNode - 树节点类型。
 *
 * @param node - 当前树节点。
 * @returns 当前节点的 `children` 字段。
 *
 * @remarks
 * 这是一个内部兜底方法。
 * 对于公共库来说，如果不想假设用户的数据结构一定存在 `children` 字段，
 * 也可以选择不提供默认行为，并强制调用方传入 `getChildren`。
 *
 * @example
 * ```ts
 * interface TreeNode {
 *   id: string
 *   children?: TreeNode[]
 * }
 *
 * const children = defaultGetChildren<TreeNode>(node)
 * ```
 */
function defaultGetChildren<TNode>(node: TNode): readonly TNode[] | undefined | null {
  return (node as { children?: readonly TNode[] }).children
}

/**
 * 使用 BFS，也就是广度优先搜索，从树结构中查找第一个满足条件的节点。
 *
 * BFS 会按照层级从上到下、从左到右进行遍历。
 * 也就是说，它会先遍历当前层的所有节点，再继续遍历下一层的子节点。
 *
 * @typeParam TNode - 树节点类型。
 *
 * @param tree - 要查询的树结构。可以是一棵树的根节点，也可以是一组根节点。
 * @param predicate - 查询条件函数。返回 `true` 时表示找到目标节点，并立即停止遍历。
 * @param options - BFS 查询配置项。
 *
 * @returns 返回第一个满足条件的节点。如果没有找到，则返回 `undefined`。
 *
 * @remarks
 * 该函数默认会将节点视为 `{ children?: TNode[] }` 结构。
 * 如果你的树节点使用的不是 `children` 字段，例如 `items`、`routes`、`nodes`，
 * 则应该通过 `options.getChildren` 显式指定如何获取子节点。
 *
 * @remarks
 * 该实现使用数组加索引模拟队列，而不是使用 `Array.prototype.shift()`。
 * 这样可以避免在大量节点场景下频繁移动数组元素，性能更稳定。
 *
 * @remarks
 * BFS 更适合查找靠近根节点的节点。
 * 如果目标节点通常位于较深层级，或者你需要优先深入某个分支，可以考虑 DFS。
 *
 * @example
 * ```ts
 * interface TreeNode {
 *   id: string
 *   label: string
 *   children?: TreeNode[]
 * }
 *
 * const tree: TreeNode[] = [
 *   {
 *     id: '1',
 *     label: '节点 1',
 *     children: [
 *       {
 *         id: '1-1',
 *         label: '节点 1-1',
 *       },
 *     ],
 *   },
 * ]
 *
 * const node = findNodeBFS(tree, item => item.id === '1-1')
 *
 * // node 类型为 TreeNode | undefined
 * console.log(node?.label)
 * ```
 *
 * @example
 * ```ts
 * interface MenuNode {
 *   key: string
 *   title: string
 *   items?: MenuNode[]
 * }
 *
 * const menus: MenuNode[] = [
 *   {
 *     key: 'system',
 *     title: '系统管理',
 *     items: [
 *       {
 *         key: 'user',
 *         title: '用户管理',
 *       },
 *     ],
 *   },
 * ]
 *
 * const menu = findNodeBFS(menus, item => item.key === 'user', {
 *   getChildren: item => item.items,
 * })
 *
 * // menu 类型为 MenuNode | undefined
 * console.log(menu?.title)
 * ```
 *
 * @example
 * ```ts
 * // 支持传入单个根节点
 * const node = findNodeBFS(rootNode, item => item.id === 'target')
 * ```
 */
export function findNodeBFS<TNode>(
  tree: TreeInput<TNode>,
  predicate: (node: TNode) => boolean,
  options: TreeTraverseOptions<TNode> = {}
): TNode | undefined {
  const getChildren = options.getChildren ?? defaultGetChildren<TNode>

  const queue: TNode[] = Array.isArray(tree) ? [...tree] : [tree]
  let index = 0

  while (index < queue.length) {
    const node = queue[index]

    index++

    if (predicate(node)) {
      return node
    }

    const children = getChildren(node)

    if (children?.length) {
      queue.push(...children)
    }
  }

  return undefined
}

/**
 * 使用 DFS，也就是深度优先搜索，从树结构中查找第一个满足条件的节点。
 *
 * DFS 会优先深入当前节点的子节点分支。
 * 也就是说，它会先沿着一个分支尽可能向下查找，
 * 当前分支查找完成后，再回到同层的下一个分支。
 *
 * @typeParam TNode - 树节点类型。
 *
 * @param tree - 要查询的树结构。可以是一棵树的根节点，也可以是一组根节点。
 * @param predicate - 查询条件函数。返回 `true` 时表示找到目标节点，并立即停止遍历。
 * @param options - DFS 查询配置项。
 *
 * @returns 返回第一个满足条件的节点。如果没有找到，则返回 `undefined`。
 *
 * @remarks
 * 该函数默认会将节点视为 `{ children?: TNode[] }` 结构。
 * 如果你的树节点使用的不是 `children` 字段，例如 `items`、`routes`、`nodes`，
 * 则应该通过 `options.getChildren` 显式指定如何获取子节点。
 *
 * @remarks
 * 该实现使用栈模拟 DFS，而不是使用递归。
 * 这样可以避免树层级过深时出现调用栈溢出的问题。
 *
 * @remarks
 * 该函数的遍历顺序是“从左到右”的前序 DFS。
 * 为了保证这一点，子节点入栈时会反向入栈。
 *
 * @remarks
 * DFS 更适合查找位于较深层级的节点。
 * 如果目标节点通常靠近根节点，或者你希望按照层级优先查找，可以考虑 BFS。
 *
 * @example
 * ```ts
 * interface TreeNode {
 *   id: string
 *   label: string
 *   children?: TreeNode[]
 * }
 *
 * const tree: TreeNode[] = [
 *   {
 *     id: '1',
 *     label: '节点 1',
 *     children: [
 *       {
 *         id: '1-1',
 *         label: '节点 1-1',
 *       },
 *     ],
 *   },
 * ]
 *
 * const node = findNodeDFS(tree, item => item.id === '1-1')
 *
 * // node 类型为 TreeNode | undefined
 * console.log(node?.label)
 * ```
 *
 * @example
 * ```ts
 * interface MenuNode {
 *   key: string
 *   title: string
 *   items?: MenuNode[]
 * }
 *
 * const menus: MenuNode[] = [
 *   {
 *     key: 'system',
 *     title: '系统管理',
 *     items: [
 *       {
 *         key: 'user',
 *         title: '用户管理',
 *       },
 *     ],
 *   },
 * ]
 *
 * const menu = findNodeDFS(menus, item => item.key === 'user', {
 *   getChildren: item => item.items,
 * })
 *
 * // menu 类型为 MenuNode | undefined
 * console.log(menu?.title)
 * ```
 *
 * @example
 * ```ts
 * // 支持传入单个根节点
 * const node = findNodeDFS(rootNode, item => item.id === 'target')
 * ```
 */
export function findNodeDFS<TNode>(
  tree: TreeInput<TNode>,
  predicate: (node: TNode) => boolean,
  options: TreeTraverseOptions<TNode> = {}
): TNode | undefined {
  const getChildren = options.getChildren ?? defaultGetChildren<TNode>

  const stack: TNode[] = Array.isArray(tree) ? [...tree].reverse() : [tree]

  while (stack.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const node = stack.pop()!

    if (predicate(node)) {
      return node
    }

    const children = getChildren(node)

    if (children?.length) {
      for (let index = children.length - 1; index >= 0; index--) {
        stack.push(children[index])
      }
    }
  }

  return undefined
}
