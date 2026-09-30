/**
 * SemVer 基线与预发布版本计算。纯逻辑，不访问 registry。
 */

/** 支持的发布通道。 */
export const CHANNELS = ["dev", "alpha", "beta", "rc", "next", "latest"] as const

/** 发布通道。 */
export type Channel = (typeof CHANNELS)[number]

/** 受支持的版本动作。 */
export type VersionAction = "current" | "patch" | "minor" | "major"

/** 精确版本基线的匹配模式。 */
const STABLE_VERSION = /^\d+\.\d+\.\d+$/

/** 需要从 registry 查询序号的预发布通道。 */
const SEQUENCE_CHANNELS: ReadonlySet<string> = new Set(["alpha", "beta", "rc", "next"])

/** 版本计算所需的外部输入。 */
export interface VersionContext {
  /** 可注入的源码短 SHA，用于可复现测试。 */
  readonly sha?: string
  /** 可注入的时间戳，用于可复现测试。 */
  readonly timestamp?: string
}

/**
 * 判断版本是否为无 prerelease 与 build metadata 的正式版本。
 *
 * @param version - 版本串。
 * @returns 是否为正式版本。
 */
export function isStable(version: string): boolean {
  return STABLE_VERSION.test(version)
}

/**
 * 判断发布通道是否合法。
 *
 * @param channel - 通道名。
 * @returns 是否合法。
 */
export function isChannel(channel: string): channel is Channel {
  return (CHANNELS as readonly string[]).includes(channel)
}

/**
 * 判断版本动作是否合法。
 *
 * @param action - 版本动作或精确版本。
 * @returns 是否合法。
 */
export function isAction(action: string): boolean {
  return (
    action === "current" ||
    action === "patch" ||
    action === "minor" ||
    action === "major" ||
    isStable(action)
  )
}

/**
 * 判断通道是否需要从 registry 查询预发布序号。
 *
 * @param channel - 通道名。
 * @returns 是否需要查询。
 */
export function needsSequence(channel: string): boolean {
  return SEQUENCE_CHANNELS.has(channel)
}

/**
 * 根据当前正式版本与版本动作计算目标正式版本基线。
 *
 * @param currentVersion - 当前 package.json 版本。
 * @param action - 版本动作或精确版本。
 * @returns 正式版本基线。
 * @throws {Error} 当前版本为预发布且无法据此推导时抛出。
 */
export function baseline(currentVersion: string, action: string): string {
  if (action === "current") {
    if (!isStable(currentVersion)) {
      throw new Error(`当前版本 ${currentVersion} 不是正式版本，无法沿用。`)
    }

    return currentVersion
  }

  if (isStable(action)) {
    return action
  }

  if (!isStable(currentVersion)) {
    throw new Error(`当前版本 ${currentVersion} 不是正式版本，无法推导 ${action} 基线。`)
  }

  const [major = "0", minor = "0", patch = "0"] = currentVersion.split(".")

  switch (action) {
    case "patch":
      return `${major}.${minor}.${Number(patch) + 1}`
    case "minor":
      return `${Number(major)}.${Number(minor) + 1}.0`
    case "major":
      return `${Number(major) + 1}.0.0`
    default:
      throw new Error(`未知版本动作：${action}`)
  }
}

/**
 * 根据通道、正式版本基线与已确认序号生成实际 npm 版本。
 *
 * @param channel - 发布通道。
 * @param baselineVersion - 正式版本基线。
 * @param sequence - registry 查询得到的下一个序号；`dev` 通道忽略该值。
 * @param context - 可注入的时间戳与源码 SHA。
 * @returns 实际发布版本。
 * @throws {Error} 通道或序号非法时抛出。
 */
export function releaseVersion(
  channel: string,
  baselineVersion: string,
  sequence: number,
  context: VersionContext = {}
): string {
  if (!isStable(baselineVersion)) {
    throw new Error(`版本基线 ${baselineVersion} 不是正式版本。`)
  }

  switch (channel) {
    case "latest":
      return baselineVersion
    case "dev": {
      const timestamp =
        context.timestamp ?? new Date().toISOString().replace(/\D/g, "").slice(0, 14)

      const sha = context.sha ?? "local"

      return `${baselineVersion}-dev.${timestamp}.${sha}`
    }

    case "alpha":
    case "beta":
    case "rc":
    case "next": {
      if (!Number.isInteger(sequence) || sequence < 0) {
        throw new Error(`预发布序号非法：${sequence}`)
      }

      return `${baselineVersion}-${channel}.${sequence}`
    }

    default:
      throw new Error(`未知发布通道：${channel}`)
  }
}

/**
 * 返回发布使用的 npm dist-tag。
 *
 * @param channel - 发布通道。
 * @returns dist-tag。
 * @throws {Error} 通道非法时抛出。
 */
export function distTag(channel: string): string {
  if (!isChannel(channel)) {
    throw new Error(`未知发布通道：${channel}`)
  }

  return channel
}
