/**
 * 统一代码修复命令。
 *
 * @remarks `--staged` 只修复并重新暂存当前暂存文件；默认模式把参数转交给
 * workspace 的 `lint:fix` 与 `format`。
 */
import { execFileSync } from "node:child_process"

import { type Context } from "../core/context.ts"
import { CANCELLED_EXIT_CODE, failure, usageError } from "../core/errors.ts"

import { runWorkspaceTask } from "./workspace.ts"

/** 需要 lint 与格式化的扩展名。 */
const LINTED_EXTENSIONS = [".ts", ".tsx", ".vue", ".js", ".jsx", ".mjs", ".cjs"] as const

/** 只需要格式化的扩展名。 */
const FORMATTED_EXTENSIONS = [".json", ".css", ".scss"] as const

/** fix 命令的用法说明。 */
export function fixUsage(): string {
  return [
    "用法：",
    "  pnpm workflow fix [target] [--keep-going]",
    "  pnpm workflow fix --staged",
    "",
    "默认模式执行 format 与 lint:fix；--staged 只修复当前暂存文件并重新暂存修复结果。",
  ].join("\n")
}

/**
 * 列出当前已暂存的文件。
 *
 * @param root - 仓库根目录。
 * @returns 相对路径列表。
 */
function stagedFiles(root: string): readonly string[] {
  const output = execFileSync(
    "git",
    ["diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z"],
    { cwd: root, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 }
  )

  return output.split("\0").filter((line) => line !== "")
}

/**
 * 只修复并重新暂存当前暂存文件。
 *
 * @param context - 执行上下文。
 * @returns 退出码。
 * @throws {WorkflowError} 修复命令失败时抛出。
 */
async function fixStaged(context: Context): Promise<number> {
  const { ui, root } = context

  const files = stagedFiles(root)

  if (files.length === 0) {
    ui.status("info", "没有已暂存文件，跳过代码修复。")

    return 0
  }

  const linted = files.filter((file) =>
    LINTED_EXTENSIONS.some((extension) => file.endsWith(extension))
  )

  const formatted = files.filter(
    (file) =>
      linted.includes(file) ||
      FORMATTED_EXTENSIONS.some((extension) => file.endsWith(extension))
  )

  if (linted.length > 0) {
    const exitCode = await ui.task(
      { title: `修复 ${linted.length} 个文件的 lint 问题`, log: "live" },
      async () =>
        await ui.exec("pnpm", ["exec", "eslint", "--fix", ...linted], { cwd: root })
    )

    if (exitCode !== 0) {
      return exitCode
    }
  }

  if (formatted.length > 0) {
    const exitCode = await ui.task(
      { title: `格式化 ${formatted.length} 个文件`, log: "live" },
      async () =>
        await ui.exec("pnpm", ["exec", "vp", "fmt", "--write", ...formatted], {
          cwd: root,
        })
    )

    if (exitCode !== 0) {
      return exitCode
    }
  }

  // 只重新暂存本次实际改写的文件，避免扩大提交范围。
  const touched = [...new Set([...linted, ...formatted])]

  const restaged = await ui.task(
    { title: "重新暂存修复结果", log: "live" },
    async () => await ui.exec("git", ["add", "--", ...touched], { cwd: root })
  )

  if (restaged !== 0) {
    throw failure("重新暂存修复结果失败。")
  }

  ui.status("success", `已修复并重新暂存 ${touched.length} 个文件。`)

  return 0
}

/**
 * 执行代码修复。
 *
 * @param context - 执行上下文。
 * @param args - 命令参数。
 * @returns 退出码。
 */
export async function runFix(context: Context, args: readonly string[]): Promise<number> {
  const { ui } = context

  if (args[0] === "--staged") {
    if (args.length !== 1) {
      throw usageError(fixUsage())
    }

    ui.flowBegin({
      domain: "workspace",
      title: "修复已暂存文件",
      description: "只修复当前暂存内容。",
    })
    const exitCode = await fixStaged(context)

    ui.flowEndFromExitCode(exitCode, {
      success: "已暂存文件修复完成。",
      failed: "已暂存文件修复失败。",
      cancelled: "已暂存文件修复已取消。",
    })

    return exitCode
  }

  if (args[0] === "-h" || args[0] === "--help" || args[0] === "help") {
    ui.note(fixUsage())

    return 0
  }

  ui.flowBegin({
    domain: "workspace",
    title: "修复代码",
    description: "依次执行 lint 自动修复与格式化。",
  })

  // 原实现在两步之间不检查取消，一次 Ctrl+C 之后仍会继续执行第二步。
  const lintExitCode = await runWorkspaceTask(context, "lint:fix", args)

  if (lintExitCode === CANCELLED_EXIT_CODE) {
    ui.flowEnd("cancelled", "代码修复已取消。")

    return lintExitCode
  }

  const formatExitCode = await runWorkspaceTask(context, "format", args)

  const exitCode = lintExitCode !== 0 ? lintExitCode : formatExitCode

  ui.flowEndFromExitCode(exitCode, {
    success: "代码修复完成。",
    failed: "代码修复未全部完成。",
    cancelled: "代码修复已取消。",
  })

  return exitCode
}
