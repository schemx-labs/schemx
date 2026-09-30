/**
 * GitHub Release 适配器。发布说明来源由调用方决定，不读取或修改发布计划。
 */
import { failure } from "../../core/errors.ts"
import { run, runOrThrow } from "../../core/exec.ts"

/** 从 remote URL 中提取 owner/repo 的四种前缀形式。 */
const URL_PREFIXES: readonly string[] = [
  "git@github.com:",
  "ssh://git@github.com/",
  "https://github.com/",
  "http://github.com/",
]

/**
 * 解析 GitHub 仓库标识。
 *
 * @param env - 环境变量。
 * @returns `owner/repo`。
 * @throws {WorkflowError} 无法解析时抛出。
 */
export async function repository(env: NodeJS.ProcessEnv): Promise<string> {
  let value = env.GITHUB_REPOSITORY ?? ""

  if (value === "") {
    const result = await run("git", ["config", "--get", "remote.origin.url"], {
      capture: true,
    })

    value = result.code === 0 ? result.stdout.trim() : ""
  }

  for (const prefix of URL_PREFIXES) {
    if (value.startsWith(prefix)) {
      value = value.slice(prefix.length)
      break
    }
  }

  value = value.replace(/\.git$/, "")

  if (!/^[^/]+\/[^/]+$/.test(value)) {
    throw failure(
      "无法从 origin remote 解析 GitHub 仓库，请设置 GITHUB_REPOSITORY=owner/repo。"
    )
  }

  return value
}

/**
 * 创建一条包级 GitHub Release。
 *
 * @param env - 环境变量。
 * @param tagName - Tag 名称。
 * @param notesFile - 发布说明文件路径。
 * @param prerelease - 是否标记为预发布。
 */
export async function createRelease(
  env: NodeJS.ProcessEnv,
  tagName: string,
  notesFile: string,
  prerelease: boolean
): Promise<void> {
  const repo = await repository(env)

  const args = [
    "release",
    "create",
    tagName,
    "--repo",
    repo,
    "--title",
    tagName,
    "--notes-file",
    notesFile,
  ]

  if (prerelease) {
    args.push("--prerelease")
  }

  await runOrThrow("gh", args)
}

/**
 * 确认目标 GitHub Release 不存在。
 *
 * @param env - 环境变量。
 * @param tagName - Tag 名称。
 * @returns 无错误信息；Release 已存在或查询异常时返回原因。
 */
export async function assertReleaseAvailable(
  env: NodeJS.ProcessEnv,
  tagName: string
): Promise<string | undefined> {
  const repo = await repository(env)

  const result = await run("gh", ["release", "view", tagName, "--repo", repo], {
    capture: true,
  })

  if (result.code === 0) {
    return `GitHub Release 已存在：${tagName}`
  }

  const output = `${result.stdout}${result.stderr}`

  if (output.includes("release not found") || output.includes("HTTP 404")) {
    return undefined
  }

  return `无法确认 GitHub Release ${tagName} 是否可用：${output.trim()}`
}

/**
 * 确认 GitHub CLI 已认证。
 *
 * @returns 无错误信息；未认证时返回原因。
 */
export async function assertAuthenticated(): Promise<string | undefined> {
  const result = await run("gh", ["auth", "status"], { capture: true })

  return result.code === 0 ? undefined : "GitHub CLI 未认证；请执行 gh auth login。"
}
