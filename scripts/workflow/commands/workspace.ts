/**
 * workspace 批处理命令。
 *
 * @remarks `build` 与 `lint`/`test` 等任务在原实现里是两套几乎逐字相同的脚本
 * （`commands/build.sh` 与 `commands/workspace.sh` 的执行规则完全一致，只有 usage
 * 文案不同），这里合并为一个入口，任务名即分支。
 */
import path from "node:path"

import { runBatchFlow } from "../batch.ts"
import { type Context } from "../core/context.ts"
import { hasScript, readManifestSafe } from "../core/package-json.ts"
import {
  formatWorkflowText,
  runWorkflowCommand,
  workflowExitCode,
} from "../presentation.ts"
import {
  ESLINT_IGNORED_FILE_PATTERN,
  LINT_FILE_PATTERN,
  parseBatchArguments,
  selectTaskTargets,
  taskLabel,
  type TaskTarget,
} from "../target-selection.ts"

import type { ParentId, Terminal } from "../ui/index.ts"

/** 批处理任务的用法说明。 */
export function workspaceUsage(): string {
  return [
    "用法：",
    "  pnpm workflow <task> [target] [--keep-going]",
    "",
    "task：build、build:analyze、check、lint、lint:fix、format、format:check、type-check、type-check:tests、test",
    "target：all、自动发现的目录（如 scripts、packages/core）、根目录 .，或以英文逗号分隔的多个目标",
    "lint、format 和 check 按实际文件发现目录；其他任务按 workspace script 发现目标。",
    "check 执行静态检查；type-check 与 test 完成后还会检查项目脚本。",
  ].join("\n")
}

/**
 * 检查实际文件，或在 workspace 目录中执行已有任务脚本。
 *
 * @param terminal - 终端实例。
 * @param root - 仓库根目录。
 * @param item - 目标。
 * @param parentId - 当前批处理分组的标识。
 * @returns 退出码。
 */
async function runTarget(
  terminal: Terminal,
  root: string,
  item: TaskTarget,
  parentId?: ParentId
): Promise<number> {
  if (item.files) {
    // 检查和修复共用同一份自动发现的文件清单。
    const commands: string[][] = []

    const linted = item.files.filter((file) => LINT_FILE_PATTERN.test(file))

    if (linted.length > 0 && ["lint", "lint:fix", "check"].includes(item.script)) {
      const fix = item.script === "lint:fix" ? ["--fix"] : []

      const eslintFiles = linted.filter((file) => !ESLINT_IGNORED_FILE_PATTERN.test(file))

      if (eslintFiles.length > 0) {
        commands.push(["exec", "eslint", ...fix, "--", ...eslintFiles])
      }
    }

    if (["format", "format:check", "check"].includes(item.script)) {
      commands.push([
        "exec",
        "prettier",
        item.script === "format" ? "--write" : "--check",
        "--",
        ...item.files,
      ])
    }

    // check 保留目录已有的类型检查，不再重复执行包内 lint 和格式检查。
    const manifest = readManifestSafe(path.join(root, item.relativeDir, "package.json"))

    if (
      item.script === "check" &&
      item.relativeDir !== "." &&
      manifest &&
      hasScript(manifest, "type-check")
    ) {
      commands.push(["--dir", item.relativeDir, "run", "type-check"])
    }

    for (const args of commands) {
      const exitCode = await runWorkflowCommand({
        terminal,
        parentId,
        title: item.script,
        target: item.name,
        command: "pnpm",
        args,
        cwd: root,
      })

      if (exitCode !== 0) {
        return exitCode
      }
    }

    return 0
  }

  return await runWorkflowCommand({
    terminal: terminal,
    parentId: parentId,
    title: item.script,
    target: item.name,
    command: "pnpm",
    args: ["--dir", item.relativeDir, "run", item.script],
    cwd: root,
  })
}

/**
 * 执行一个批处理任务。
 *
 * @param context - 执行上下文。
 * @param task - 任务名，对应各包的同名 npm script。
 * @param args - 命令参数。
 * @returns 退出码。
 */
export async function runWorkspaceTask(
  context: Context,
  task: string,
  args: readonly string[]
): Promise<number> {
  const { terminal, catalog, root } = context

  const label = taskLabel(task)

  let target = ""

  let keepGoing = false

  try {
    const parsed = parseBatchArguments(args)

    if (parsed.help) {
      terminal.text({
        content: formatWorkflowText({ terminal: terminal, content: workspaceUsage() }),
        parentId: context.parentId,
      })

      return 0
    }

    target = parsed.target
    keepGoing = parsed.keepGoing
  } catch (error) {
    terminal.status({
      tone: "error",
      message: error instanceof Error ? error.message : String(error),
      parentId: context.parentId,
    })
    terminal.text({
      content: formatWorkflowText({ terminal: terminal, content: workspaceUsage() }),
      parentId: context.parentId,
    })

    return 2
  }

  let items: readonly TaskTarget[]

  try {
    items = await selectTaskTargets(terminal, catalog, task, target, "multi", context.env)
  } catch (error) {
    const code = workflowExitCode(error)

    terminal.status({
      tone: code === 130 ? "warning" : "error",
      message: `${label}目标选择${code === 130 ? "已取消" : "失败"}。`,
      parentId: context.parentId,
    })
    throw error
  }

  if (items.length === 0) {
    const flowId1 = terminal.startFlow({
      domain: "workspace",
      title: label,
      description: formatWorkflowText({
        terminal,
        content: "按选中 workspace 目标逐个执行对应 script。",
      }),
    })

    terminal.status({
      tone: "warning",
      message: `没有可执行 ${task} 的目标，无需执行。`,
      parentId: flowId1,
    })
    terminal.endFlow({
      flowId: flowId1,
      outcome: "success",
      message: `${label}完成：没有可用目标。`,
    })

    return 0
  }

  return await runBatchFlow(terminal, {
    label,
    description: "按选中目录处理实际文件，或执行对应的 workspace script。",
    items,
    keepGoing,
    identify: (item) => item.name,
    taskLabel: label,
    execute: async (item, _index, _total, parentId) =>
      await runTarget(terminal, root, item, parentId),
  })
}
