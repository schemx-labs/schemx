/**
 * 命令执行上下文。
 *
 * @remarks 原实现靠 `workflow_root`、`BATCH_CURRENT_TARGET`、`WORKSPACE_BATCH_*` 等
 * 全局变量在层之间传递上下文，这些契约没有任何检查；这里改为显式参数。
 */
import { Catalog } from "./catalog.ts"

import type { ParentId, Terminal } from "../ui/index.ts"

/** 一个命令执行所需的全部上下文。 */
export interface Context {
  /** 仓库根目录。 */
  readonly root: string
  /** 终端 UI。 */
  readonly terminal: Terminal
  /** 显式传递当前业务范围，不修改终端内部状态。 */
  readonly parentId?: ParentId | undefined
  /** workspace 目录索引。 */
  readonly catalog: Catalog
  /** 环境变量。 */
  readonly env: NodeJS.ProcessEnv
}

/**
 * 创建执行上下文。
 *
 * @param root - 仓库根目录。
 * @param terminal - 终端实例。
 * @param env - 环境变量。
 * @returns 执行上下文。
 */
export function createContext(
  root: string,
  terminal: Terminal,
  env: NodeJS.ProcessEnv = process.env
): Context {
  return { root, terminal, catalog: new Catalog(root), env }
}
