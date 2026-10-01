/**
 * release 子命令分派。
 */
import { existsSync, mkdirSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

import { type Context } from "../core/context.ts"
import { usageError, WorkflowError } from "../core/errors.ts"
import { packPackage } from "../release/adapters/artifacts.ts"
import { executePlan } from "../release/execute.ts"
import { renderPlan } from "../release/feedback.ts"
import { selectChannel, selectTarget, selectVersionAction } from "../release/inputs.ts"
import { verifyPlan } from "../release/operations.ts"
import { readPlan } from "../release/plan.ts"
import { createPlan, type PlanContext } from "../release/planning.ts"
import { removeState } from "../release/state.ts"
import { findTarget, resolveTargets } from "../release/targets.ts"
import { runBatchFlow } from "../ui/batch.ts"

/** release 命令的用法说明。 */
export function releaseUsage(): string {
  return [
    "用法：",
    "  pnpm workflow release plan <channel> <target> <version-action> [--output <file>]",
    "  pnpm workflow release dry-run <channel> <target> <version-action>",
    "  pnpm workflow release publish [channel] [target] [version-action]",
    "  pnpm workflow release check [channel] [target] [version-action] [--keep-going]",
    "  pnpm workflow release pack [target] [--keep-going]",
    "  pnpm workflow release verify <plan-file> [--keep-going]",
    "  pnpm workflow release execute <plan-file>",
    "",
    "channel：dev、alpha、beta、rc、next、latest",
    "target：all、core、vue、vant、element-plus，或以英文逗号分隔的多个包",
    "version-action：patch、minor、major、current（仅 latest）或精确 x.y.z",
  ].join("\n")
}

/** 有限 release 子命令共用的参数解析结果。 */
interface ParsedArguments {
  /** 位置参数。 */
  readonly positional: readonly string[]
  /** 是否在失败后继续。 */
  readonly keepGoing: boolean
}

/**
 * 解析 `--keep-going` 并保留其余位置参数。
 *
 * @param args - 子命令参数。
 * @returns 解析结果。
 * @throws {WorkflowError} 出现未知选项时抛出。
 */
function parseKeepGoing(args: readonly string[]): ParsedArguments {
  const positional: string[] = []

  let keepGoing = false

  for (const argument of args) {
    if (argument === "--keep-going") {
      keepGoing = true
    } else if (argument.startsWith("-")) {
      throw usageError(`未知 release 选项：${argument}`)
    } else {
      positional.push(argument)
    }
  }

  return { positional, keepGoing }
}

/**
 * 收集交互输入，失败时统一结束分组。
 *
 * @param context - 执行上下文。
 * @param channelArg - 命令行通道。
 * @param targetArg - 命令行目标。
 * @param actionArg - 命令行版本动作。
 * @returns 通道、目标与版本动作。
 * @throws {WorkflowError} 输入被取消时抛出。
 */
async function collectInputs(
  context: Context,
  channelArg: string,
  targetArg: string,
  actionArg: string
): Promise<{ channel: string; target: string; action: string }> {
  const { ui } = context

  ui.groupBegin({
    title: "发布配置",
    description: "发布通道和版本动作为单选；发布包支持多选。",
  })

  try {
    const channel = await selectChannel(ui, channelArg)

    const target = await selectTarget(ui, context.catalog, targetArg)

    const action = await selectVersionAction(ui, channel, actionArg)

    ui.groupEnd("success", "发布配置完成。")

    return { channel, target, action }
  } catch (error) {
    ui.groupEnd("cancelled", "发布配置已取消。")
    throw error
  }
}

/**
 * 生成发布计划文件路径。
 *
 * @param root - 仓库根目录。
 * @param channel - 发布通道。
 * @param stable - 是否生成稳定可引用的路径（发布流程需要，plan 只用于临时输出）。
 * @returns 计划文件路径。
 */
function planFilePath(root: string, channel: string, stable: boolean): string {
  if (!stable) {
    return path.join(tmpdir(), `schemx-release-plan-${process.pid}-${Date.now()}.json`)
  }

  const directory = path.join(root, ".release", "plans")

  mkdirSync(directory, { recursive: true })
  const stamp = new Date().toISOString().replace(/\D/g, "").slice(0, 14)

  // 同一秒内重跑时补一个序号，避免覆盖上一份计划。
  let unique = path.join(directory, `${stamp}-${channel}.json`)

  let index = 1

  while (existsSync(unique)) {
    unique = path.join(directory, `${stamp}-${channel}-${index}.json`)
    index += 1
  }

  return unique
}

/**
 * 注入可复现测试用的外部输入。
 *
 * @param env - 环境变量。
 * @returns 计划上下文。
 */
function planContextFrom(env: NodeJS.ProcessEnv): PlanContext {
  return {
    ...(env.SCHEMX_RELEASE_SHA === undefined ? {} : { sha: env.SCHEMX_RELEASE_SHA }),
    ...(env.SCHEMX_RELEASE_TIMESTAMP === undefined
      ? {}
      : { timestamp: env.SCHEMX_RELEASE_TIMESTAMP }),
    ...(env.SCHEMX_RELEASE_PRERELEASE_SEQUENCE === undefined
      ? {}
      : { prereleaseSequence: env.SCHEMX_RELEASE_PRERELEASE_SEQUENCE }),
  }
}

/**
 * `release plan` 与 `release dry-run`。
 *
 * @param context - 执行上下文。
 * @param dryRun - 是否为 dry-run。
 * @param args - 子命令参数。
 * @returns 退出码。
 */
async function runPlan(
  context: Context,
  dryRun: boolean,
  args: readonly string[]
): Promise<number> {
  const { ui, root, env } = context

  if (args.length < 3) {
    ui.note(releaseUsage())

    return 2
  }

  const channel = args[0] ?? ""

  const target = args[1] ?? ""

  const versionAction = args[2] ?? ""

  let planFile = ""

  if (args[3] === "--output") {
    planFile = args[4] ?? ""
    if (planFile === "") {
      throw usageError("release plan --output 需要一个文件路径。")
    }
  } else if (args.length > 3) {
    throw usageError("release plan 接受了多余参数。")
  }

  ui.flowBegin({
    domain: "release",
    title: "生成发布计划",
    description: "生成并冻结版本计划；不会执行发布写操作。",
  })

  try {
    planFile ||= planFilePath(root, channel, false)
    await ui.task(
      { title: "解析发布版本并冻结计划", throwOnError: true },
      async () =>
        await createPlan(
          context,
          channel,
          target,
          versionAction,
          planFile,
          planContextFrom(env)
        )
    )
    renderPlan(ui, readPlan(planFile))

    if (dryRun) {
      ui.status(
        "success",
        "dry-run 已完成：未执行质量检查、npm 发布、Git Tag 或 GitHub Release。"
      )
    }

    ui.flowEnd("success", `${dryRun ? "dry-run" : "plan"} 完成。`)
  } catch (error) {
    const code = error instanceof WorkflowError ? error.exitCode : 1

    ui.flowEndFromExitCode(code, {
      success: "计划已生成。",
      failed: "发布计划创建失败。",
      cancelled: "发布计划创建已取消。",
    })
    throw error
  }

  // 计划路径是本命令唯一的机器可读结果，必须走 stdout。
  process.stdout.write(`${planFile}\n`)

  return 0
}

/**
 * `release check`：以发布同样的输入冻结计划并执行全部无副作用校验。
 *
 * @param context - 执行上下文。
 * @param args - 子命令参数。
 * @returns 退出码。
 */
async function runCheck(context: Context, args: readonly string[]): Promise<number> {
  const { ui, root, env } = context

  const { positional, keepGoing } = parseKeepGoing(args)

  if (positional.length > 3) {
    ui.note(releaseUsage())

    return 2
  }

  ui.flowBegin({
    domain: "release",
    title: "发布合规检查",
    description: "复用发布流程的计划和发布前校验，但不执行任何外部写入。",
  })

  let planFile = ""

  try {
    const { channel, target, action } = await collectInputs(
      context,
      positional[0] ?? "",
      positional[1] ?? "",
      positional[2] ?? ""
    )

    ui.groupBegin({
      title: "生成发布计划",
      description: "查询 registry 并冻结待发布的版本、Tag 与源码提交。",
    })
    planFile = planFilePath(root, channel, false)

    try {
      await ui.task(
        { title: "解析发布版本并冻结计划", throwOnError: true },
        async () =>
          await createPlan(
            context,
            channel,
            target,
            action,
            planFile,
            planContextFrom(env)
          )
      )
      renderPlan(ui, readPlan(planFile))
      ui.groupEnd("success", "发布检查计划已冻结。")
    } catch (error) {
      ui.groupEnd("failed", "发布检查计划生成失败。")
      throw error
    }
  } catch (error) {
    if (planFile !== "") {
      rmSync(planFile, { force: true })
    }

    const code = error instanceof WorkflowError ? error.exitCode : 1

    ui.flowEndFromExitCode(code, {
      success: "发布合规检查完成。",
      failed: "发布合规检查失败。",
      cancelled: "发布检查已取消。",
    })
    throw error
  }

  const exitCode = await verifyPlan(context, readPlan(planFile), planFile, keepGoing)

  removeState(planFile)
  rmSync(planFile, { force: true })

  ui.flowEndFromExitCode(exitCode, {
    success:
      "发布合规检查完成：未执行版本写入、npm 发布、Git 推送或 GitHub Release 创建。",
    failed: "发布合规检查失败。",
    cancelled: "发布检查已取消。",
  })

  return exitCode
}

/**
 * `release publish`：收集交互输入、冻结计划，再交给执行器处理发布写操作。
 *
 * @param context - 执行上下文.
 * @param args - 子命令参数。
 * @returns 退出码。
 * @throws {WorkflowError} 参数非法时抛出。
 */
async function runPublish(context: Context, args: readonly string[]): Promise<number> {
  const { ui, root, env } = context

  if (args.length > 3) {
    throw usageError(releaseUsage())
  }

  if (args.includes("--keep-going")) {
    throw usageError("release publish 不支持 --keep-going。")
  }

  ui.flowBegin({
    domain: "release",
    title: "发布流程",
    description: "选择通道、发布包与版本基线后，系统会冻结计划并等待最终确认。",
  })

  let planFile = ""

  let exitCode = 0

  try {
    const { channel, target, action } = await collectInputs(
      context,
      args[0] ?? "",
      args[1] ?? "",
      args[2] ?? ""
    )

    ui.groupBegin({
      title: "生成发布计划",
      description: "查询 registry 并冻结各包的版本计划。",
    })
    planFile = planFilePath(root, channel, true)
    await ui.task(
      { title: "解析发布版本并冻结计划", throwOnError: true },
      async () =>
        await createPlan(context, channel, target, action, planFile, planContextFrom(env))
    )
    ui.groupEnd("success", "发布计划已冻结。")

    exitCode = await executePlan(context, planFile)
  } catch (error) {
    // 只有在还没有产生发布进度时才丢弃计划文件，避免丢失续跑依据。
    if (planFile !== "" && !existsSync(`${planFile}.state.json`)) {
      rmSync(planFile, { force: true })
    }

    const code = error instanceof WorkflowError ? error.exitCode : 1

    ui.flowEndFromExitCode(code, {
      success: "发布完成。",
      failed: "发布流程失败。",
      cancelled: "发布流程已取消。",
    })
    throw error
  }

  if (exitCode === 0) {
    removeState(planFile)
    rmSync(planFile, { force: true })
    ui.flowEnd("success", "发布完成。")
  } else {
    ui.status("warning", `已保留冻结计划：${planFile}`)
    ui.flowEndFromExitCode(exitCode, {
      success: "发布完成。",
      failed: "发布流程失败。",
      cancelled: "发布流程已取消。",
    })
  }

  return exitCode
}

/**
 * `release pack`：生成可供本地安装验证的 tarball，不执行 npm 发布。
 *
 * @param context - 执行上下文.
 * @param args - 子命令参数。
 * @returns 退出码。
 */
async function runPack(context: Context, args: readonly string[]): Promise<number> {
  const { ui, root, catalog } = context

  const { positional, keepGoing } = parseKeepGoing(args)

  if (positional.length > 1) {
    ui.note(releaseUsage())

    return 2
  }

  const target = positional[0] ?? "all"

  const packages = resolveTargets(catalog, target)

  const destination = path.join(root, ".packs")

  return await runBatchFlow(ui, {
    label: "本地打包",
    description: "输出目录：.packs；生成 tarball 供本地安装验证，不执行 npm 发布。",
    items: packages,
    keepGoing,
    identify: (item) => findTarget(catalog, item)?.name ?? item,
    taskLabel: "打包",
    execute: async (item, index, total) => {
      const resolved = findTarget(catalog, item)

      if (!resolved) {
        ui.status("error", `无效发布目标：${item}`)

        return 2
      }

      return await ui.task(
        { title: "打包", itemKey: resolved.name, last: index === total },
        async () => await packPackage(resolved.name, destination)
      )
    },
  })
}

/**
 * `release verify`：读取冻结计划并执行发布前检查。
 *
 * @param context - 执行上下文.
 * @param args - 子命令参数。
 * @returns 退出码。
 */
async function runVerify(context: Context, args: readonly string[]): Promise<number> {
  const { ui } = context

  const { positional, keepGoing } = parseKeepGoing(args)

  if (positional.length !== 1) {
    ui.note(releaseUsage())

    return 2
  }

  const planFile = positional[0] ?? ""

  ui.flowBegin({
    domain: "release",
    title: "验证发布计划",
    description: "读取冻结计划并执行发布前检查。",
  })

  const exitCode = await verifyPlan(context, readPlan(planFile), planFile, keepGoing)

  ui.flowEndFromExitCode(exitCode, {
    success: "发布计划验证完成。",
    failed: "发布计划验证失败。",
    cancelled: "发布计划验证已取消。",
  })

  return exitCode
}

/**
 * `release execute`：消费冻结计划并执行发布步骤。
 *
 * @param context - 执行上下文.
 * @param args - 子命令参数。
 * @returns 退出码。
 */
async function runExecute(context: Context, args: readonly string[]): Promise<number> {
  const { ui } = context

  if (args.length !== 1) {
    ui.note(releaseUsage())

    return 2
  }

  const planFile = args[0] ?? ""

  ui.flowBegin({
    domain: "release",
    title: "执行发布",
    description: "消费冻结计划并执行发布步骤。",
  })

  const exitCode = await executePlan(context, planFile)

  if (exitCode === 0) {
    ui.flowEnd("success", "发布完成。")
  } else {
    ui.flowEndFromExitCode(exitCode, {
      success: "发布完成。",
      failed: "发布流程失败。",
      cancelled: "发布流程已取消。",
    })
  }

  return exitCode
}

/**
 * 执行 release 子命令。
 *
 * @param context - 执行上下文.
 * @param args - 子命令及参数。
 * @returns 退出码。
 * @throws {WorkflowError} 子命令非法时抛出。
 */
export async function runRelease(
  context: Context,
  args: readonly string[]
): Promise<number> {
  const command = args[0] ?? "help"

  const rest = args.slice(1)

  switch (command) {
    case "plan":
      return await runPlan(context, false, rest)
    case "dry-run":
      return await runPlan(context, true, rest)
    case "publish":
      return await runPublish(context, rest)
    case "check":
      return await runCheck(context, rest)
    case "pack":
      return await runPack(context, rest)
    case "verify":
      return await runVerify(context, rest)
    case "execute":
      return await runExecute(context, rest)
    case "help":
    case "-h":
    case "--help":
      context.ui.note(releaseUsage())

      return 0
    default:
      context.ui.note(releaseUsage())
      throw usageError(`未知 release 子命令：${command}`)
  }
}
