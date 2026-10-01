/**
 * 发布验证、发布与标记编排。
 */
import path from "node:path"

import { type Context } from "../core/context.ts"
import { hasScript, workspaceDependencyNames } from "../core/package-json.ts"
import { type Ui } from "../ui/ui.ts"

import { assertPackageArtifacts } from "./adapters/artifacts.ts"
import * as git from "./adapters/git.ts"
import * as github from "./adapters/github.ts"
import { publishPackage, writePackageVersion } from "./adapters/npm.ts"
import { writeReleaseNotes } from "./notes.ts"
import { type ReleasePlan } from "./plan.ts"
import * as preflight from "./preflight.ts"
import { hasStep, markStep } from "./state.ts"

/** 逐包执行的质量任务。 */
const QUALITY_TASKS = ["lint", "type-check", "test", "build"] as const

/**
 * 在任务中执行一次前置校验，并把失败原因作为错误输出。
 *
 * @param ui - 终端 UI。
 * @param title - 任务标题。
 * @param itemKey - 关联目标。
 * @param check - 校验逻辑，返回失败原因或 undefined。
 * @returns 退出码。
 */
async function runCheck(
  ui: Ui,
  title: string,
  itemKey: string | undefined,
  check: () => Promise<string | undefined>
): Promise<number> {
  return await ui.task(
    { title, ...(itemKey === undefined ? {} : { itemKey }), log: "live" },
    async () => {
      const reason = await check()

      if (reason !== undefined) {
        throw new Error(reason)
      }
    }
  )
}

/**
 * 对一个发布包执行质量脚本与发布产物检查。
 *
 * @param context - 执行上下文。
 * @param target - 逻辑包名。
 * @param packageName - npm 包名。
 * @param keepGoing - 单包内是否继续执行剩余任务。
 * @returns 退出码。
 */
async function verifyPackageQuality(
  context: Context,
  target: string,
  packageName: string,
  keepGoing: boolean
): Promise<number> {
  const { ui, catalog, root } = context

  const item = catalog.find(target, catalog.publishable())

  if (!item) {
    ui.status("error", `无法解析发布包：${target}`)

    return 2
  }

  let firstFailure = 0

  for (const task of QUALITY_TASKS) {
    if (!hasScript(item.manifest, task)) {
      ui.taskSkip(task, "package.json 未定义对应 script。")
      continue
    }

    const exitCode = await ui.task(
      { title: task, itemKey: packageName, log: "live" },
      async () =>
        await ui.exec("pnpm", ["--dir", item.relativeDir, "run", task], { cwd: root })
    )

    if (exitCode === 0) {
      continue
    }

    if (exitCode === 130) {
      return 130
    }

    firstFailure ||= exitCode
    if (!keepGoing) {
      return exitCode
    }
  }

  const artifactCode = await ui.task(
    { title: "检查发布产物", itemKey: packageName, log: "live" },
    async () => await assertPackageArtifacts(packageName)
  )

  if (artifactCode === 0) {
    return 0
  }

  if (artifactCode === 130) {
    return 130
  }

  firstFailure ||= artifactCode

  return firstFailure
}

/**
 * 消费冻结计划运行所有发布前检查，不执行任何发布写操作。
 *
 * @param context - 执行上下文。
 * @param plan - 冻结计划。
 * @param planFile - 计划文件路径。
 * @param keepGoing - 质量检查是否在失败后继续。
 * @returns 退出码。
 */
export async function verifyPlan(
  context: Context,
  plan: ReleasePlan,
  planFile: string,
  keepGoing: boolean
): Promise<number> {
  const { ui, catalog, env } = context

  const plannedNames = new Set(plan.packages.map((item) => item.name))

  ui.groupBegin({
    title: "发布前检查",
    description:
      "验证工作区、发布凭据与 registry；所有检查均在冻结计划之后执行，续跑时跳过已完成的包。",
  })

  const gating: readonly (readonly [string, () => Promise<string | undefined>])[] = [
    ["验证工作区状态", () => preflight.assertCleanWorktree()],
    ...(plan.channel === "latest"
      ? ([["验证正式发布分支", () => preflight.assertMainBranch()]] as const)
      : []),
    ["验证 npm registry", () => preflight.assertRegistry(env)],
    ["验证 npm 发布凭据", () => preflight.assertNpmAuth(env)],
  ]

  for (const [title, check] of gating) {
    const exitCode = await runCheck(ui, title, undefined, check)

    if (exitCode !== 0) {
      return exitCode
    }
  }

  if (plan.createGithubRelease) {
    const authCode = await runCheck(ui, "验证 GitHub 凭据", undefined, () =>
      preflight.assertGithubAuth()
    )

    if (authCode !== 0) {
      return authCode
    }

    for (const item of plan.packages) {
      if (hasStep(planFile, item.package, "tagged")) {
        continue
      }

      const code = await runCheck(ui, `验证 ${item.tag} 可用`, item.name, () =>
        git.assertReleaseTagAvailable(item.tag)
      )

      if (code !== 0) {
        return code
      }
    }

    for (const item of plan.packages) {
      if (hasStep(planFile, item.package, "released")) {
        continue
      }

      const code = await runCheck(
        ui,
        `验证 ${item.tag} GitHub Release 可用`,
        item.name,
        () => github.assertReleaseAvailable(env, item.tag)
      )

      if (code !== 0) {
        return code
      }
    }
  }

  // 计划内的 workspace 依赖由拓扑发布顺序保证先发布；未选中依赖必须已经可安装。
  for (const item of plan.packages) {
    if (hasStep(planFile, item.package, "published")) {
      continue
    }

    const target = catalog.find(item.package, catalog.publishable())

    if (!target) {
      continue
    }

    for (const dependency of workspaceDependencyNames(target.manifest)) {
      if (plannedNames.has(dependency)) {
        continue
      }

      const code = await runCheck(ui, `验证依赖 ${dependency} 可获得`, item.name, () =>
        preflight.assertDependencyAvailable(env, catalog, dependency)
      )

      if (code !== 0) {
        return code
      }
    }
  }

  for (const item of plan.packages) {
    if (hasStep(planFile, item.package, "published")) {
      continue
    }

    const available = await runCheck(
      ui,
      `验证 ${item.name}@${item.version} 可用`,
      item.name,
      () => preflight.assertVersionAvailable(env, item.name, item.version)
    )

    if (available !== 0) {
      return available
    }

    if (plan.prerelease) {
      const baseline = await runCheck(ui, `验证 ${item.name} 预发布基线`, item.name, () =>
        preflight.assertPrereleaseBaselineAvailable(env, item.name, item.baselineVersion)
      )

      if (baseline !== 0) {
        return baseline
      }
    }
  }

  ui.groupEnd("success", "发布前检查完成。")

  ui.groupBegin({
    title: "质量与产物",
    description: "逐包执行质量任务；产物检查使用 pnpm 的实际发布文件规则。",
  })

  const failed: string[] = []

  let firstFailure = 0

  for (const [index, item] of plan.packages.entries()) {
    ui.groupBegin({
      title: `[${index + 1}/${plan.packages.length}] ${item.name}`,
      itemKey: item.name,
    })

    const exitCode = await verifyPackageQuality(
      context,
      item.package,
      item.name,
      keepGoing
    )

    if (exitCode === 0) {
      ui.groupEnd("success", `${item.name} 检查完成。`)
      continue
    }

    if (exitCode === 130) {
      ui.groupEnd("cancelled", `${item.name} 检查已取消。`)
      ui.groupEnd("cancelled", "质量与产物检查已取消。")

      return 130
    }

    ui.groupEnd("failed", `${item.name} 检查失败。`)
    failed.push(`${item.name}（exit ${exitCode}）`)
    firstFailure ||= exitCode

    if (!keepGoing) {
      ui.groupEnd("failed", "质量与产物检查失败。")

      return exitCode
    }
  }

  if (firstFailure !== 0) {
    ui.summary({ title: "质量检查失败项", tone: "error", content: failed.join("\n") })
    ui.groupEnd("failed", `质量与产物检查失败：${failed.length} 个包未通过。`)

    return firstFailure
  }

  ui.groupEnd("success", `质量与产物检查完成：${plan.packages.length} 个包全部通过。`)
  ui.status(
    "success",
    "发布前检查完成：尚未执行 npm 发布、版本写入、Git Tag 或 GitHub Release。"
  )

  return 0
}

/**
 * 报告一次不可回滚的发布中断，并给出可以直接执行的恢复步骤。
 *
 * @param ui - 终端 UI。
 * @param planFile - 计划文件路径。
 * @param published - 已发布包描述。
 * @param failed - 失败包描述。
 * @param pending - 未执行包描述。
 */
export function reportInterruption(
  ui: Ui,
  planFile: string,
  published: string,
  failed: string,
  pending: string
): void {
  ui.summary({
    title: "发布中断",
    tone: "error",
    content: `已发布：${published}\n失败：${failed}\n未执行：${pending || "无"}`,
  })
  if (published !== "" && published !== "无") {
    ui.status("error", "已成功发布的包无法撤回；其版本已记录在发布进度文件中。")
  }

  ui.status(
    "warning",
    `修复失败原因后续跑：node scripts/workflow.ts release execute ${planFile}`
  )
  ui.status("warning", "续跑会读取已有进度，按冻结计划继续未完成的步骤。")
}

/**
 * 按计划记录串行发布尚未发布的 npm 包，逐包写入版本并记录进度。
 *
 * @param context - 执行上下文。
 * @param plan - 冻结计划。
 * @param planFile - 计划文件路径。
 * @param writeVersion - 是否在发布前写入目标版本。
 * @returns 退出码。
 */
export async function publishPackages(
  context: Context,
  plan: ReleasePlan,
  planFile: string,
  writeVersion: boolean
): Promise<number> {
  const { ui, catalog, root, env } = context

  const published: string[] = []

  for (const [index, item] of plan.packages.entries()) {
    const target = catalog.find(item.package, catalog.publishable())

    if (!target) {
      ui.status("error", `无法解析发布包：${item.package}`)

      return 2
    }

    const directory = path.join(root, target.relativeDir)

    // 续跑时同样写入版本：已发布的包需要保留版本改动交给版本提交，未发布的包会被回滚。
    if (writeVersion) {
      const code = await ui.task(
        { title: `写入 ${item.name}@${item.version}`, itemKey: item.name, log: "live" },
        async () => await writePackageVersion(directory, item.version)
      )

      if (code !== 0) {
        return code
      }
    }

    if (hasStep(planFile, item.package, "published")) {
      published.push(`${item.name}@${item.version}`)
      ui.status("info", `跳过已发布的 ${item.name}@${item.version}。`)
      continue
    }

    const code = await ui.task(
      { title: `发布 ${item.name}@${item.version}`, itemKey: item.name, log: "live" },
      async () =>
        await publishPackage(env, directory, plan.distTag, (command, args, options) =>
          ui.exec(command, args, options)
        )
    )

    if (code === 0) {
      markStep(planFile, plan, item.package, "published")
      published.push(`${item.name}@${item.version}`)
      continue
    }

    const remaining = plan.packages.slice(index + 1)

    reportInterruption(
      ui,
      planFile,
      published.length > 0 ? published.join("、") : "无",
      `${item.name}@${item.version}`,
      remaining.map((entry) => `${entry.name}@${entry.version}`).join("、")
    )

    return code
  }

  return 0
}

/**
 * 只把已成功发布的包纳入正式版版本提交。
 *
 * @param context - 执行上下文。
 * @param plan - 冻结计划。
 * @param planFile - 计划文件路径。
 * @param message - 提交信息。
 * @returns 退出码。
 */
export async function commitPublishedVersions(
  context: Context,
  plan: ReleasePlan,
  planFile: string,
  message: string
): Promise<number> {
  const { ui, catalog, root } = context

  const files: string[] = []

  for (const item of plan.packages) {
    if (!hasStep(planFile, item.package, "published")) {
      continue
    }

    const target = catalog.find(item.package, catalog.publishable())

    if (target) {
      files.push(`${target.relativeDir}/package.json`)
    }
  }

  if (files.length === 0) {
    return 0
  }

  const installCode = await ui.task(
    { title: "同步 pnpm-lock.yaml", log: "live" },
    async () => await ui.exec("pnpm", ["install", "--lockfile-only"], { cwd: root })
  )

  if (installCode !== 0) {
    return installCode
  }

  // 锁文件只有确实变化时才纳入提交，避免引入无关 diff。
  if (await git.isPathDirty("pnpm-lock.yaml")) {
    files.push("pnpm-lock.yaml")
  }

  return await ui.task(
    { title: `提交正式版版本变更：${files.length} 个文件`, log: "live" },
    async () => await git.commitReleaseVersion(message, files)
  )
}

/**
 * 为已成功发布的包创建 Tag、推送并创建 GitHub Release。
 *
 * @param context - 执行上下文。
 * @param plan - 冻结计划。
 * @param planFile - 计划文件路径。
 * @param tagTarget - Tag 目标提交。
 * @returns 退出码。
 */
export async function createMarkers(
  context: Context,
  plan: ReleasePlan,
  planFile: string,
  tagTarget: string
): Promise<number> {
  const { ui, catalog, root, env } = context

  const published = plan.packages.filter((item) =>
    hasStep(planFile, item.package, "published")
  )

  if (plan.createTag) {
    for (const item of published) {
      if (hasStep(planFile, item.package, "tagged")) {
        ui.status("info", `跳过已推送的 ${item.tag}。`)
        continue
      }

      const createCode = await ui.task(
        { title: `创建 ${item.tag}`, itemKey: item.name, log: "live" },
        async () => await git.createReleaseTag(item.tag, tagTarget)
      )

      if (createCode !== 0) {
        return createCode
      }

      const pushCode = await ui.task(
        { title: `推送 ${item.tag}`, itemKey: item.name, log: "live" },
        async () => await git.pushReleaseTag(item.tag)
      )

      if (pushCode !== 0) {
        return pushCode
      }

      markStep(planFile, plan, item.package, "tagged")
    }
  }

  if (!plan.createGithubRelease) {
    return 0
  }

  for (const item of published) {
    if (hasStep(planFile, item.package, "released")) {
      ui.status("info", `跳过已创建的 GitHub Release：${item.tag}。`)
      continue
    }

    const target = catalog.find(item.package, catalog.publishable())

    if (!target) {
      ui.status("error", `无法解析发布包：${item.package}`)

      return 2
    }

    const notesFile = path.join(root, ".release", "notes", `${item.tag}.md`)

    const notesCode = await ui.task(
      { title: `生成 ${item.tag} Release notes`, itemKey: item.name, log: "live" },
      async () => {
        await writeReleaseNotes({
          root,
          target: item.package,
          packageName: item.name,
          version: item.version,
          tagName: item.tag,
          targetRef: tagTarget,
          outputFile: notesFile,
          env,
          relativeDir: target.relativeDir,
        })
      }
    )

    if (notesCode !== 0) {
      return notesCode
    }

    const releaseCode = await ui.task(
      { title: `创建 GitHub Release：${item.tag}`, itemKey: item.name, log: "live" },
      async () => {
        await github.createRelease(env, item.tag, notesFile, plan.prerelease)
      }
    )

    if (releaseCode !== 0) {
      return releaseCode
    }

    markStep(planFile, plan, item.package, "released")
  }

  return 0
}
