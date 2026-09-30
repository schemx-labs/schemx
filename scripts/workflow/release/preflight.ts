/**
 * 发布前外部状态校验。每个检查只验证一个事实并返回失败原因。
 *
 * @remarks 原实现通过 `domains/release/runner.sh` 的 25 分支 case 在子进程中调用这些
 * 检查，父子进程边界只是为了让 Shell 获得独立的 `set -euo pipefail`；在单进程的
 * TypeScript 实现里直接调用即可。
 */
import { type Catalog } from "../core/catalog.ts"
import { run } from "../core/exec.ts"

import * as git from "./adapters/git.ts"
import * as github from "./adapters/github.ts"
import { queryVersionState, registryOf, withNpmToken } from "./adapters/npm.ts"
import { dependencyVersion } from "./targets.ts"

/** 校验结果；`undefined` 表示通过。 */
export type CheckResult = string | undefined

/**
 * 确认工作区没有未提交改动。
 *
 * @returns 失败原因或 undefined。
 */
export async function assertCleanWorktree(): Promise<CheckResult> {
  const status = await git.statusPorcelain()

  return status === "" ? undefined : "工作区存在未提交改动"
}

/**
 * 确认正式版发布位于 main 分支。
 *
 * @returns 失败原因或 undefined。
 */
export async function assertMainBranch(): Promise<CheckResult> {
  const branch = await git.currentBranch()

  return branch === "main"
    ? undefined
    : `正式发布必须位于 main 分支；当前分支：${branch}。`
}

/**
 * 确认 pnpm 当前 registry 与预期 registry 一致。
 *
 * @param env - 环境变量。
 * @returns 失败原因或 undefined。
 */
export async function assertRegistry(env: NodeJS.ProcessEnv): Promise<CheckResult> {
  const expected = registryOf(env)

  // 必须与发布走同一套配置，否则一次性 npmrc 里的 registry 不参与判定。
  const result = await withNpmToken(env, (scoped) =>
    run("pnpm", ["config", "get", "registry"], { env: scoped, capture: true })
  )

  const actual = result.stdout.trim()

  return actual === expected
    ? undefined
    : `npm registry 不匹配：当前 ${actual}，预期 ${expected}。`
}

/**
 * 确认 npm 身份可用于目标 registry。
 *
 * @remarks 必须用 `npm` 而非 `pnpm`：pnpm 11 的 `whoami` 请求的是 pnpm 私有 registry
 * 端点 `/pnpm`，对 registry.npmjs.org 恒返回 401，会把有效凭据误判为无效。
 *
 * @param env - 环境变量。
 * @returns 失败原因或 undefined。
 */
export async function assertNpmAuth(env: NodeJS.ProcessEnv): Promise<CheckResult> {
  const result = await withNpmToken(env, (scoped) =>
    run("npm", ["whoami", "--registry", registryOf(scoped)], {
      env: scoped,
      capture: true,
    })
  )

  if (result.code === 0) {
    return undefined
  }

  const reason = env.NPM_TOKEN
    ? "NPM_TOKEN 无效或对目标 registry 无发布权限。"
    : "未检测到 npm 凭据：NPM_TOKEN 未设置且 pnpm 未登录。"

  return `${reason}请在 shell 中导出 NPM_TOKEN，或执行 pnpm login。`
}

/**
 * 确认 GitHub CLI 已认证。
 *
 * @returns 失败原因或 undefined。
 */
export async function assertGithubAuth(): Promise<CheckResult> {
  return await github.assertAuthenticated()
}

/**
 * 确认一个候选 npm 版本尚未发布。
 *
 * @param env - 环境变量。
 * @param packageName - npm 包名。
 * @param version - 版本。
 * @returns 失败原因或 undefined。
 */
export async function assertVersionAvailable(
  env: NodeJS.ProcessEnv,
  packageName: string,
  version: string
): Promise<CheckResult> {
  const state = await queryVersionState(env, packageName, version)

  if (state === "published") {
    return `${packageName}@${version} 已发布。`
  }

  if (state === "unknown") {
    return `无法确认 ${packageName}@${version} 是否可用：registry 查询失败。`
  }

  return undefined
}

/**
 * 确认一个 npm 版本已经发布；用于校验未参与本次发布的 workspace 依赖可被安装。
 *
 * @param env - 环境变量。
 * @param packageName - npm 包名。
 * @param version - 版本。
 * @returns 失败原因或 undefined。
 */
export async function assertVersionPublished(
  env: NodeJS.ProcessEnv,
  packageName: string,
  version: string
): Promise<CheckResult> {
  const state = await queryVersionState(env, packageName, version)

  if (state === "published") {
    return undefined
  }

  if (state === "available") {
    return `${packageName}@${version} 尚未发布；依赖它的包发布后无法安装。`
  }

  return `无法确认 ${packageName}@${version} 是否已发布：registry 查询失败。`
}

/**
 * 确认预发布依赖的正式版本基线尚未发布，避免产生 SemVer 优先级倒退的版本。
 *
 * @param env - 环境变量。
 * @param packageName - npm 包名。
 * @param baselineVersion - 正式版本基线。
 * @returns 失败原因或 undefined。
 */
export async function assertPrereleaseBaselineAvailable(
  env: NodeJS.ProcessEnv,
  packageName: string,
  baselineVersion: string
): Promise<CheckResult> {
  const state = await queryVersionState(env, packageName, baselineVersion)

  if (state === "published") {
    return `预发布基线 ${packageName}@${baselineVersion} 已发布；请选择下一条版本线。`
  }

  if (state === "unknown") {
    return `无法确认预发布基线 ${packageName}@${baselineVersion} 是否可用：registry 查询失败。`
  }

  return undefined
}

/**
 * 确认一个包已发布的 workspace 依赖当前可从 registry 获得。
 *
 * @param env - 环境变量。
 * @param catalog - 目录索引。
 * @param dependencyName - 依赖的 npm 包名。
 * @returns 失败原因或 undefined。
 */
export async function assertDependencyAvailable(
  env: NodeJS.ProcessEnv,
  catalog: Catalog,
  dependencyName: string
): Promise<CheckResult> {
  const version = dependencyVersion(dependencyName, catalog)

  if (version === "") {
    return undefined
  }

  return await assertVersionPublished(env, dependencyName, version)
}
