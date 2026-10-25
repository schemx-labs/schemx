/**
 * 发布产物与依赖安装检查。只运行 npm/pnpm 的 dry-run，不生成或发布实际 tarball。
 */
import { mkdirSync } from "node:fs"

import { run, type RunResult } from "../../core/exec.ts"

/**
 * 使用 pnpm 的实际发布文件规则检查一个包。
 *
 * @param packageName - npm 包名。
 * @returns 执行结果。
 * @param execute - 可注入的命令执行器。
 */
export async function assertPackageArtifacts(
  packageName: string,
  execute: typeof run = run
): Promise<RunResult> {
  return await execute("pnpm", ["--filter", packageName, "pack", "--dry-run"])
}

/**
 * 为本地安装验证生成一个包的 tarball。
 *
 * @param packageName - npm 包名。
 * @param destination - 输出目录。
 * @returns 执行结果。
 * @param execute - 可注入的命令执行器。
 */
export async function packPackage(
  packageName: string,
  destination: string,
  execute: typeof run = run
): Promise<RunResult> {
  mkdirSync(destination, { recursive: true })

  return await execute("pnpm", [
    "--filter",
    packageName,
    "pack",
    "--pack-destination",
    destination,
  ])
}

/**
 * 校验锁文件与依赖安装状态。
 *
 * @returns 执行结果。
 */
export async function assertInstallation(): Promise<RunResult> {
  return await run("pnpm", ["install", "--frozen-lockfile"])
}
