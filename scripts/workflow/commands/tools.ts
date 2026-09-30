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
import { selectTargetIdentifiers } from "../ui/target-selection.ts"
import { type Ui } from "../ui/ui.ts"

/** 工具命令的用法说明。 */
export function toolsUsage(): string {
  return ["用法：", "  pnpm workflow <preview|pack-local|check:packages>"].join("\n")
}

/**
 * 报告一组检查失败。
 *
 * @param ui - 终端 UI。
 * @param title - 失败标题。
 * @param failures - 失败原因。
 */
function reportFailures(ui: Ui, title: string, failures: readonly string[]): void {
  ui.status("error", `${title}：`)
  for (const failure of failures) {
    ui.note(failure)
  }
}

/**
 * 运行 workspace 包配置与构建产物边界检查。
 *
 * @param context - 执行上下文。
 * @returns 退出码。
 */
export function checkPackages(context: Context): number {
  const { ui, root } = context

  let failed = false

  const config = checkPackageConfig(root)

  if (!config.ok) {
    reportFailures(ui, "包配置检查失败", config.failures)
    failed = true
  } else {
    ui.status("success", "包配置检查通过。")
  }

  const boundaries = checkBundleBoundaries(root)

  if (!boundaries.ok) {
    reportFailures(ui, "构建产物边界检查失败", boundaries.failures)
    failed = true
  } else {
    ui.status("success", "构建产物 external 边界检查通过。")
  }

  return failed ? 1 : 0
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
  const { ui, root, catalog, env } = context

  switch (command) {
    case "check:packages": {
      ui.flowBegin({
        domain: "tools",
        title: "包完整检查",
        description: "运行包配置与构建产物边界检查。",
      })
      const exitCode = checkPackages(context)

      ui.flowEndFromExitCode(exitCode, {
        success: "包完整检查完成。",
        failed: "包完整检查失败。",
        cancelled: "包完整检查已取消。",
      })

      return exitCode
    }

    case "preview": {
      ui.flowBegin({
        domain: "tools",
        title: "本地预览",
        description: "启动 Vite Preview 服务。",
      })
      const exitCode = await ui.service(
        { title: "启动 Vite Preview", spin: false },
        "pnpm",
        ["exec", "vite", "preview", ...args],
        root
      )

      ui.flowEndFromExitCode(exitCode, {
        success: "预览服务已结束。",
        failed: "预览服务失败。",
        cancelled: "预览服务已取消。",
      })

      return exitCode === 130 ? 0 : exitCode
    }

    case "pack-local": {
      if (args.length > 1) {
        throw usageError(toolsUsage())
      }

      const requested = args[0] ?? env.SCHEMX_WORKFLOW_TARGETS ?? ""

      ui.flowBegin({
        domain: "tools",
        title: "本地包打包",
        description: "生成带时间戳的 dev 版本 tarball 供本地安装验证。",
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

      const target = await selectTargetIdentifiers(ui, {
        title: "请选择要本地打包的目标",
        candidates,
        requested,
        mode: "multi",
      })

      renderPackResult(
        ui,
        await packLocal({
          root,
          ui,
          catalog,
          targets: target,
          outputDir: path.join(root, ".packs"),
        })
      )
      ui.flowEnd("success", "本地包打包完成。")

      return 0
    }

    default:
      throw usageError(toolsUsage())
  }
}
