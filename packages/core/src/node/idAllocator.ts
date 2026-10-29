/**
 * Runtime 内节点的稳定 ID。
 */
export type NodeId = number

/**
 * Compiler 私有持有的节点 ID 分配器，不回收已分配的 ID。
 */
export interface NodeIdAllocator {
  /**
   * 返回下一个节点 ID，从 1 开始，0 保留给根节点。
   * @example const nodeId = allocator.allocate()
   */
  allocate(): NodeId
}

/**
 * 为 Compiler 创建独立的节点 ID 序列。
 * @example const allocator = createNodeIdAllocator()
 */
export function createNodeIdAllocator(): NodeIdAllocator {
  // 序列只随本分配器递增，不提供重置或回收操作。
  let nextId = 1

  // 使用闭包绑定序列，传递方法时不依赖 this。
  const allocate = (): NodeId => nextId++

  return { allocate }
}
