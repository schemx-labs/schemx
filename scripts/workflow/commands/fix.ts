/**
 * 统一代码修复命令。
 *
 * @remarks `--staged` 只修复并重新暂存当前暂存文件；默认模式把参数转交给
 * workspace 的 `lint:fix` 与 `format`。
 */
import { existsSync } from "node:fs"
import path from "node:path"

import { type Context } from "../core/context.ts"
import { CANCELLED_EXIT_CODE, failure, usageError } from "../core/errors.ts"
import {
  endWorkflowFlow,
  formatWorkflowText,
  runWorkflowCommand,
} from "../presentation.ts"
import { ESLINT_IGNORED_FILE_PATTERN } from "../target-selection.ts"

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
    "默认模式依次执行 lint:fix 与 format；--staged 只修复当前暂存文件并重新暂存修复结果。",
  ].join("\n")
}

/**
 * 列出当前已暂存的文件。
 *
 * @param context - 仓库目录及绑定了取消信号的终端。
 * @returns 相对路径列表。
 */
async function stagedFiles(context: Context): Promise<readonly string[]> {
  const result = await context.terminal.executeCommand({
    command: "git",
    args: ["diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z"],
    cwd: context.root,
    outputMode: "capture",
  })

  if (result.exitCode !== 0) {
    throw failure(result.stderr || "无法读取暂存文件。")
  }

  return result.stdout
    .split("\0")
    .filter((file) => file !== "" && existsSync(path.join(context.root, file)))
}

/**
 * 只修复并重新暂存当前暂存文件。
 *
 * @param context - 执行上下文。
 * @returns 退出码。
 * @throws {WorkflowError} 修复命令失败时抛出。
 */
async function fixStaged(context: Context): Promise<number> {
  const { terminal, root } = context

  const files = await terminal.runTask({
    title: "读取暂存文件",
    parentId: context.parentId,
    execute: () => stagedFiles(context),
  })

  if (files.length === 0) {
    terminal.status({
      tone: "info",
      message: "没有已暂存文件，跳过代码修复。",
      parentId: context.parentId,
    })

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
    const eslintFiles = linted.filter((file) => !ESLINT_IGNORED_FILE_PATTERN.test(file))

    if (eslintFiles.length > 0) {
      const exitCode = await runWorkflowCommand({
        terminal: terminal,
        title: `修复 ${eslintFiles.length} 个文件的 lint 问题`,
        command: "pnpm",
        args: ["exec", "eslint", "--fix", "--", ...eslintFiles],
        cwd: root,
        parentId: context.parentId,
      })

      if (exitCode !== 0) {
        return exitCode
      }
    }
  }

  if (formatted.length > 0) {
    const exitCode = await runWorkflowCommand({
      terminal: terminal,
      title: `格式化 ${formatted.length} 个文件`,
      command: "pnpm",
      args: ["exec", "prettier", "--write", "--", ...formatted],
      cwd: root,
      parentId: context.parentId,
    })

    if (exitCode !== 0) {
      return exitCode
    }
  }

  // 只重新暂存本次实际改写的文件，避免扩大提交范围。
  const touched = [...new Set([...linted, ...formatted])]

  const restaged = await runWorkflowCommand({
    terminal: terminal,
    title: "重新暂存修复结果",
    command: "git",
    args: ["add", "--", ...touched],
    cwd: root,
    parentId: context.parentId,
  })

  if (restaged !== 0) {
    throw failure("重新暂存修复结果失败。")
  }

  terminal.status({
    tone: "success",
    message: `已修复并重新暂存 ${touched.length} 个文件。`,
    parentId: context.parentId,
  })

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
  const { terminal } = context

  if (args[0] === "--staged") {
    if (args.length !== 1) {
      throw usageError(fixUsage())
    }

    const flowId1 = terminal.startFlow({
      domain: "workspace",
      title: "修复已暂存文件",
      description: formatWorkflowText({ terminal, content: "只修复当前暂存内容。" }),
    })

    const exitCode = await fixStaged({ ...context, parentId: flowId1 })

    endWorkflowFlow({
      terminal: terminal,
      flowId: flowId1,
      exitCode: exitCode,
      messages: {
        success: "已暂存文件修复完成。",
        failed: "已暂存文件修复失败。",
        cancelled: "已暂存文件修复已取消。",
      },
    })

    return exitCode
  }

  if (args[0] === "-h" || args[0] === "--help" || args[0] === "help") {
    terminal.text({
      content: formatWorkflowText({ terminal: terminal, content: fixUsage() }),
      parentId: context.parentId,
    })

    return 0
  }

  const flowId2 = terminal.startFlow({
    domain: "workspace",
    title: "修复代码",
    description: formatWorkflowText({
      terminal,
      content: "依次执行 lint 自动修复与格式化。",
    }),
  })

  // 原实现在两步之间不检查取消，一次 Ctrl+C 之后仍会继续执行第二步。
  const lintExitCode = await runWorkspaceTask(context, "lint:fix", args)

  if (lintExitCode === CANCELLED_EXIT_CODE) {
    terminal.endFlow({
      flowId: flowId2,
      outcome: "cancelled",
      message: "代码修复已取消。",
    })

    return lintExitCode
  }

  const formatExitCode = await runWorkspaceTask(context, "format", args)

  const exitCode = lintExitCode !== 0 ? lintExitCode : formatExitCode

  endWorkflowFlow({
    terminal: terminal,
    flowId: flowId2,
    exitCode: exitCode,
    messages: {
      success: "代码修复完成。",
      failed: "代码修复未全部完成。",
      cancelled: "代码修复已取消。",
    },
  })

  return exitCode
}
