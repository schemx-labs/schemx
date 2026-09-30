/**
 * 仓库根目录解析。脚本不再从任意工作目录启动，一律以模块位置推导绝对路径。
 */
import path from "node:path"

/**
 * 解析仓库根目录。
 *
 * @param fromDir - 调用方所在目录，默认取本模块目录（`scripts/workflow`）。
 * @returns 仓库根目录绝对路径。
 */
export function resolveRoot(fromDir: string = import.meta.dirname): string {
  return path.resolve(fromDir, "..", "..", "..")
}
