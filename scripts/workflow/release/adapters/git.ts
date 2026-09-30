/**
 * Git 发布适配器。Tag 名称由冻结计划提供，方法不推导包或版本。
 */
import { run, runOrThrow } from "../../core/exec.ts"

/**
 * 将文件加入暂存区并创建发布提交。
 *
 * @param message - 提交信息。
 * @param files - 待提交文件路径。
 */
export async function commitReleaseVersion(
  message: string,
  files: readonly string[]
): Promise<void> {
  await runOrThrow("git", ["add", "--", ...files])
  await runOrThrow("git", ["commit", "-m", message])
}

/**
 * 创建指向指定提交的带注释发布 Tag。
 *
 * @param tagName - Tag 名称。
 * @param target - 目标提交。
 */
export async function createReleaseTag(tagName: string, target: string): Promise<void> {
  await runOrThrow("git", ["tag", "-a", tagName, target, "-m", `release: ${tagName}`])
}

/**
 * 确认本地与 origin 均不存在同名 Tag。
 *
 * @param tagName - Tag 名称。
 * @returns 无错误信息；Tag 已存在或远端查询异常时返回原因。
 */
export async function assertReleaseTagAvailable(
  tagName: string
): Promise<string | undefined> {
  const local = await run("git", [
    "rev-parse",
    "--verify",
    "--quiet",
    `refs/tags/${tagName}`,
  ])

  if (local.code === 0) {
    return `Git Tag 已存在：${tagName}`
  }

  const remote = await run("git", [
    "ls-remote",
    "--exit-code",
    "--tags",
    "origin",
    `refs/tags/${tagName}`,
  ])

  if (remote.code === 0) {
    return `远端 Git Tag 已存在：${tagName}`
  }

  // ls-remote 的退出码 2 表示「查询成功但没有匹配项」，其余非零都是查询故障。
  if (remote.code === 2) {
    return undefined
  }

  return `无法确认远端 Git Tag ${tagName} 是否可用：${(remote.stderr || remote.stdout).trim()}`
}

/**
 * 判断指定路径在当前工作区是否存在未提交改动。
 *
 * @param target - 路径。
 * @returns 是否存在改动。
 */
export async function isPathDirty(target: string): Promise<boolean> {
  const result = await run("git", ["status", "--porcelain", "--", target], {
    capture: true,
  })

  return result.stdout.trim() !== ""
}

/**
 * 推送当前分支上的发布提交。
 */
export async function pushReleaseCommit(): Promise<void> {
  await runOrThrow("git", ["push", "origin", "HEAD"])
}

/**
 * 推送一个已创建的发布 Tag。
 *
 * @param tagName - Tag 名称。
 */
export async function pushReleaseTag(tagName: string): Promise<void> {
  await runOrThrow("git", ["push", "origin", tagName])
}

/**
 * 返回当前源码短 SHA。
 *
 * @returns 短 SHA；不在 Git 仓库中时返回 `local`。
 */
export async function currentSha(): Promise<string> {
  const result = await run("git", ["rev-parse", "--short", "HEAD"], { capture: true })

  return result.code === 0 ? result.stdout.trim() : "local"
}

/**
 * 返回工作区未提交改动。
 *
 * @returns porcelain 输出。
 */
export async function statusPorcelain(): Promise<string> {
  const result = await run("git", ["status", "--porcelain"], { capture: true })

  return result.stdout.trim()
}

/**
 * 返回当前分支名。
 *
 * @returns 分支名；游离 HEAD 时返回 `HEAD detached`。
 */
export async function currentBranch(): Promise<string> {
  const result = await run("git", ["branch", "--show-current"], { capture: true })

  return result.stdout.trim() || "HEAD detached"
}
