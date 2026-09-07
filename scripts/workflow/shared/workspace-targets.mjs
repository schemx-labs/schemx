import { readdirSync, readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..")

const VALID_SCOPES = ["packages", "plugins", "examples"]
const TASK_SCRIPT_WHITELIST = {
  build: ["build", "build:h5"],
  dev: ["dev", "dev:h5"],
}
/**
 * 解析任务在一个目标中实际应执行的 npm script。
 *
 * `dev` 与 `build` 可以映射到 H5 默认脚本，其他任务只匹配同名脚本。
 *
 * @param {Record<string, string>} scripts - 目标 package.json 的 scripts
 * @param {string} task - 根命令请求的任务名
 * @returns {string | undefined} 命中的实际 script 名
 */
export function resolveTaskScript(scripts, task) {
  const candidates = TASK_SCRIPT_WHITELIST[task] ?? [task]

  return candidates.find((script) => Boolean(scripts[script]))
}

/**
 * 发现某个 scope 下所有可执行目标。
 *
 * @param {string} scope - packages | plugins | examples
 * @returns {{ dir: string, name: string, scope: string, scripts: Record<string, string> }[]}
 */
export function discoverTargets(scope) {
  if (!VALID_SCOPES.includes(scope)) {
    throw new Error(`未知 scope：${scope}，可选值为 ${VALID_SCOPES.join("、")}`)
  }

  const base = resolve(rootDir, scope)
  let entries

  try {
    entries = readdirSync(base, { withFileTypes: true })
  } catch {
    return []
  }

  const targets = []

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue
    }

    let pkg

    try {
      pkg = JSON.parse(readFileSync(resolve(base, entry.name, "package.json"), "utf8"))
    } catch {
      continue
    }

    targets.push({
      dir: entry.name,
      name: pkg.name,
      scope,
      scripts: pkg.scripts ?? {},
    })
  }

  targets.sort((left, right) => left.dir.localeCompare(right.dir))

  return targets
}

// 统一 CLI 的逗号分隔参数和库调用的数组参数。
function normalizeScopes(scopes) {
  if (Array.isArray(scopes)) {
    return scopes
  }

  return String(scopes)
    .split(",")
    .map((scope) => scope.trim())
    .filter(Boolean)
}

/**
 * 发现多个 scope 下的可执行目标。
 *
 * @param {string[] | string} scopes - 一个或多个 scope
 * @returns {{ dir: string, name: string, scope: string, scripts: Record<string, string> }[]}
 */
export function discoverAllTargets(scopes) {
  return normalizeScopes(scopes).flatMap((scope) => discoverTargets(scope))
}
