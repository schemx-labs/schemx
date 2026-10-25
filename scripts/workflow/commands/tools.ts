/**
 * 无目标或专用工具命令。
 */
import path from "node:path"

import { type Context } from "../core/context.ts"
import { usageError } from "../core/errors.ts"
import { hasScript } from "../core/package-json.ts"
import { checkBundleBoundaries } from "../packages/check-bundle-boundaries.ts"
import { checkPackageConfig } from "../packages/check-config.ts"
import { packLocal, renderPackResult } from "../packages/local-pack.ts"
import {
  endWorkflowFlow,
  formatWorkflowText,
  runWorkflowCommand,
  runWorkflowTask,
} from "../presentation.ts"
import { selectTargetIdentifiers } from "../target-selection.ts"

/** 工具命令的用法说明。 */
export function toolsUsage(): string {
  return [
    "用法：",
    "  pnpm workflow preview [Vite Preview options]",
    "  pnpm workflow pack-local [target]",
    "  pnpm workflow check:packages",
    "",
    "target：all、packages/core 或 core,vue 等逗号分隔的目标",
  ].join("\n")
}

/**
 * 运行 workspace 包配置与构建产物边界检查。
 *
 * @param context - 执行上下文。
 * @returns 首个失败退出码；取消时不继续后续检查。
 * @example await checkPackages(context)
 */
export async function checkPackages(context: Context): Promise<number> {
  const { terminal, root } = context

  let firstFailure = 0

  for (const [title, check] of [
    ["检查包配置", checkPackageConfig],
    ["检查构建产物边界", checkBundleBoundaries],
  ] as const) {
    const code = await runWorkflowTask({
      terminal,
      title,
      parentId: context.parentId,
      execute: async () => {
        const result = await check(root)

        if (!result.ok) {
          throw new Error(result.failures.join("\n"))
        }
      },
    })

    if (code === 130) {
      return code
    }

    firstFailure ||= code
  }

  return firstFailure
}

/**
 * 执行工具命令。
 *
 * @param context - 执行上下文。
 * @param command - 命令名。
 * @param args - 命令参数。
 * @returns 退出码。
 * @throws {WorkflowError} 参数非法时抛出。
 */
export async function runTool(
  context: Context,
  command: string,
  args: readonly string[]
): Promise<number> {
  const { terminal, root, catalog, env } = context

  if (
    command !== "preview" &&
    args.some((arg) => arg === "help" || arg === "-h" || arg === "--help")
  ) {
    terminal.text({
      content: formatWorkflowText({ terminal: terminal, content: toolsUsage() }),
      parentId: context.parentId,
    })

    return 0
  }

  switch (command) {
    case "check:packages": {
      if (args.length > 0) {
        throw usageError("check:packages 不接受目标或额外参数。")
      }

      const flowId3 = terminal.startFlow({
        domain: "tools",
        title: "包配置与产物检查",
        description: formatWorkflowText({
          terminal,
          content: "运行包配置与构建产物边界检查。",
        }),
      })

      const exitCode = await checkPackages({ ...context, parentId: flowId3 })

      endWorkflowFlow({
        terminal: terminal,
        flowId: flowId3,
        exitCode: exitCode,
        messages: {
          success: "包配置与产物检查完成。",
          failed: "包配置与产物检查失败。",
          cancelled: "包配置与产物检查已取消。",
        },
      })

      return exitCode
    }

    case "preview": {
      const flowId2 = terminal.startFlow({
        domain: "tools",
        title: "本地预览",
        description: formatWorkflowText({
          terminal,
          content: "启动 Vite Preview 服务。",
        }),
      })

      const exitCode = await runWorkflowCommand({
        terminal: terminal,
        title: "运行 Vite Preview",
        outputMode: "inherit",
        command: "pnpm",
        args: ["exec", "vite", "preview", ...args],
        cwd: root,
        parentId: flowId2,
      })

      endWorkflowFlow({
        terminal: terminal,
        flowId: flowId2,
        exitCode: exitCode,
        messages: {
          success: "预览服务已结束。",
          failed: "预览服务失败。",
          cancelled: "预览服务已取消。",
        },
      })

      return exitCode === 130 ? 0 : exitCode
    }

    case "pack-local": {
      if (args.length > 1 || args[0]?.startsWith("-")) {
        throw usageError(toolsUsage())
      }

      const requested = args[0] ?? env.SCHEMX_WORKFLOW_TARGETS ?? ""

      const flowId1 = terminal.startFlow({
        domain: "tools",
        title: "本地包打包",
        description: formatWorkflowText({
          terminal,
          content: "生成带时间戳的 dev 版本 tarball 供本地安装验证。",
        }),
      })

      const candidates = catalog
        .discover(["packages", "plugins"])
        .filter(
          (item) => item.scope === "packages" || hasScript(item.manifest, "pack:local")
        )
        .map((item) => ({
          scope: item.scope,
          directory: item.directory,
          relativeDir: item.relativeDir,
          name: item.name,
          script: "pack:local",
        }))

      const target = await selectTargetIdentifiers(
        terminal,
        {
          title: "请选择要本地打包的目标",
          candidates,
          requested,
          mode: "multi",
        },
        env
      )

      renderPackResult(
        terminal,
        await packLocal({
          root,
          terminal,
          catalog,
          targets: target,
          outputDir: path.join(root, ".packs"),
          parentId: flowId1,
        })
      )
      terminal.endFlow({
        flowId: flowId1,
        outcome: "success",
        message: "本地包打包完成。",
      })

      return 0
    }

    default:
      throw usageError(toolsUsage())
  }
}
