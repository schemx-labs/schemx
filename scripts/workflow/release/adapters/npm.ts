/**
 * npm 适配器。
 *
 * @remarks 原实现在「正常返回」时才删除一次性 npmrc，收到信号会把含 NPM_TOKEN 的
 * 文件留在 `$TMPDIR`。这里用 try/finally 保证任何退出路径都清理。
 */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

import { run, type RunResult } from "../../core/exec.ts"

/** 默认 registry。 */
export const DEFAULT_REGISTRY = "https://registry.npmjs.org/"

/**
 * 返回当前生效的 registry。
 *
 * @param env - 环境变量。
 * @returns registry 地址。
 */
export function registryOf(env: NodeJS.ProcessEnv): string {
  return env.NPM_REGISTRY || DEFAULT_REGISTRY
}

/**
 * 创建一个包含 NPM_TOKEN 的一次性 npmrc。
 *
 * @param env - 环境变量。
 * @param authKey - 绑定目标 registry 的认证键。
 * @returns npmrc 路径；未提供 token 时返回 undefined。
 */
function createTokenConfig(env: NodeJS.ProcessEnv, authKey: string): string | undefined {
  const token = env.NPM_TOKEN

  if (!token) {
    return undefined
  }

  const registry = registryOf(env)

  const directory = mkdtempSync(path.join(tmpdir(), "schemx-npmrc-"))

  const configFile = path.join(directory, "npmrc")

  writeFileSync(
    configFile,
    `registry=${registry}\n${authKey}=${token}\nalways-auth=true\n`,
    { mode: 0o600 }
  )

  return configFile
}

/**
 * 在一次调用期间注入 NPM_TOKEN，并保证临时配置被清理。
 *
 * @param env - 环境变量。
 * @param execute - 需要认证环境的执行逻辑。
 * @returns 执行结果。
 */
export async function withNpmToken(
  env: NodeJS.ProcessEnv,
  execute: (scoped: NodeJS.ProcessEnv) => Promise<RunResult>
): Promise<RunResult> {
  if (!env.NPM_TOKEN || env.NPM_CONFIG_USERCONFIG) {
    return await execute(env)
  }

  // 保留 registry 路径，兼容非根路径的私有源。
  const host = registryOf(env)
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "")

  // pnpm 的 auth.ini 优先于用户 npmrc，本次调用需用环境变量固定凭据。
  const authKey = `//${host}/:_authToken`

  const configFile = createTokenConfig(env, authKey)

  if (!configFile) {
    return await execute(env)
  }

  try {
    return await execute({
      ...env,
      NPM_CONFIG_USERCONFIG: configFile,
      [`pnpm_config_${authKey}`]: env.NPM_TOKEN,
    })
  } finally {
    rmSync(path.dirname(configFile), { recursive: true, force: true })
  }
}

/** pnpm 在包于 registry 尚不存在时返回的错误码。 */
const PACKAGE_MISSING = "ERR_PNPM_FETCH_404"

/** pnpm 在包存在但指定版本不存在时返回的标记。 */
const VERSION_MISSING = ["ERR_PNPM_PACKAGE_NOT_FOUND", "No matching version found"]

/**
 * 判断一次 registry 查询是否因为「包尚不存在」失败。
 *
 * @param result - 查询结果。
 * @returns 是否为包不存在。
 */
function isPackageMissing(result: RunResult): boolean {
  return `${result.stdout}${result.stderr}`.includes(PACKAGE_MISSING)
}

/**
 * 判断一次 registry 查询是否因为「版本不存在」失败。
 *
 * @param result - 查询结果。
 * @returns 是否为版本不存在。
 */
function isVersionMissing(result: RunResult): boolean {
  const output = `${result.stdout}${result.stderr}`

  return VERSION_MISSING.some((marker) => output.includes(marker))
}

/**
 * 查询一个 npm 版本是否已发布。
 *
 * @param env - 环境变量。
 * @param packageName - npm 包名。
 * @param version - 版本。
 * @returns `available` 表示尚未发布，`published` 表示已发布，`unknown` 表示查询失败。
 */
export async function queryVersionState(
  env: NodeJS.ProcessEnv,
  packageName: string,
  version: string
): Promise<"available" | "published" | "unknown"> {
  const result = await withNpmToken(env, (scoped) =>
    run(
      "pnpm",
      ["view", `${packageName}@${version}`, "version", "--registry", registryOf(scoped)],
      {
        env: scoped,
        capture: true,
      }
    )
  )

  if (result.code === 0) {
    return "published"
  }

  // 包尚未发布时其任意版本都不可用；网络或权限故障不得当作「可用」。
  return isVersionMissing(result) || isPackageMissing(result) ? "available" : "unknown"
}

/**
 * 从 npm 已发布版本中计算指定基线与预发布通道的下一个序号。
 *
 * @param env - 环境变量。
 * @param packageName - npm 包名。
 * @param baselineVersion - 正式版本基线。
 * @param channel - 预发布通道。
 * @returns 下一个序号；包在 registry 上尚不存在时为 0。
 * @throws {Error} registry 查询失败时抛出。
 */
export async function nextPrereleaseSequence(
  env: NodeJS.ProcessEnv,
  packageName: string,
  baselineVersion: string,
  channel: string
): Promise<number> {
  const result = await withNpmToken(env, (scoped) =>
    run(
      "pnpm",
      ["view", packageName, "versions", "--json", "--registry", registryOf(scoped)],
      {
        env: scoped,
        capture: true,
      }
    )
  )

  if (result.code !== 0) {
    // 首次发布的包在 registry 上尚不存在，等价于零个已发布版本，首个预发布序号为 0。
    if (isPackageMissing(result)) {
      return 0
    }

    throw new Error(
      `无法查询 ${packageName} 的已发布版本：${(result.stderr || result.stdout).trim()}`
    )
  }

  const raw = result.stdout.trim()

  const parsed: unknown = raw === "" ? [] : JSON.parse(raw)

  const versions: string[] = Array.isArray(parsed)
    ? (parsed as string[])
    : [String(parsed)]

  const pattern = new RegExp(
    `^${baselineVersion.split(".").join("[.]")}-${channel}[.]([0-9]+)$`
  )

  let max = -1

  for (const version of versions) {
    const match = pattern.exec(version)

    if (match?.[1] !== undefined) {
      max = Math.max(max, Number(match[1]))
    }
  }

  return max + 1
}

/**
 * 把目标版本写入一个包的 package.json。
 *
 * @param packageDirectory - 包目录。
 * @param version - 目标版本。
 * @returns 执行结果。
 */
export async function writePackageVersion(
  packageDirectory: string,
  version: string
): Promise<RunResult> {
  return await run("npm", [
    "--prefix",
    packageDirectory,
    "version",
    version,
    "--no-git-tag-version",
  ])
}

/**
 * 发布一个已写入目标版本的包。
 *
 * @param env - 环境变量。
 * @param packageDirectory - 包目录。
 * @param distTag - npm dist-tag。
 * @param execute - 发布命令执行器；调用方可提供 UI 实时输出，默认捕获结果。
 * @returns 执行结果。
 */
export async function publishPackage(
  env: NodeJS.ProcessEnv,
  packageDirectory: string,
  distTag: string,
  execute: typeof run = run
): Promise<RunResult> {
  const args = [
    "--dir",
    packageDirectory,
    "publish",
    "--access",
    "public",
    "--registry",
    registryOf(env),
    "--tag",
    distTag,
    "--no-git-checks",
  ]

  // 可选 NPM_OTP 透传给 pnpm，供启用 npm 2FA 的非交互发布使用。
  if (env.NPM_OTP) {
    args.push("--otp", env.NPM_OTP)
  }

  return await withNpmToken(env, (scoped) => execute("pnpm", args, { env: scoped }))
}
