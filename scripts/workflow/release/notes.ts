/**
 * GitHub Release notes 生成器。
 *
 * @remarks 只读取 Git 与包级说明文件，并将 Markdown 写入调用方指定文件。
 */
import { accessSync, constants, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"

import { failure } from "../core/errors.ts"
import { run } from "../core/exec.ts"

/** 提交主题到发布说明分类的匹配规则。 */
const CATEGORIES: readonly (readonly [string, RegExp])[] = [
  ["Features", /^feat(\(|:|!)/],
  ["Fixes", /^fix(\(|:|!)/],
  ["Performance", /^perf(\(|:|!)/],
  ["Refactors", /^refactor(\(|:|!)/],
  ["Documentation", /^docs(\(|:|!)/],
  ["Tooling", /^(chore|build|ci|test)(\(|:|!)/],
]

/** 与任一分类都不匹配的前缀。 */
const CATEGORIZED = /^(feat|fix|perf|refactor|docs|chore|build|ci|test)(\(|:|!)/

/** Release notes 生成所需的输入。 */
export interface NotesInput {
  /** 仓库根目录。 */
  readonly root: string
  /** 逻辑包名。 */
  readonly target: string
  /** npm 包名。 */
  readonly packageName: string
  /** 发布版本。 */
  readonly version: string
  /** Tag 名称。 */
  readonly tagName: string
  /** Tag 目标提交。 */
  readonly targetRef: string
  /** 输出文件绝对路径。 */
  readonly outputFile: string
  /** 环境变量。 */
  readonly env: NodeJS.ProcessEnv
  /** 包目录相对路径。 */
  readonly relativeDir: string
}

/**
 * 找到指定提交可见的、同一 npm 包最近一次发布 Tag。
 *
 * @param packageName - npm 包名。
 * @param currentTag - 当前 Tag。
 * @param targetRef - 目标提交。
 * @returns 上一个 Tag 名称；没有时返回空串。
 */
export async function previousTag(
  packageName: string,
  currentTag: string,
  targetRef: string
): Promise<string> {
  const result = await run("git", ["tag", "--sort=-creatordate", "--merged", targetRef], {
    capture: true,
  })

  if (result.code !== 0) {
    return ""
  }

  for (const tag of result.stdout.split("\n")) {
    if (tag !== "" && tag !== currentTag && tag.startsWith(`${packageName}@`)) {
      return tag
    }
  }

  return ""
}

/**
 * 按固定分类把提交主题写成分节 Markdown。
 *
 * @param subjects - 提交主题列表。
 * @returns Markdown 片段。
 */
function summarizeCommits(subjects: readonly string[]): string {
  if (subjects.length === 0) {
    return "\n- 本次发布没有检测到新的 Git commit。\n"
  }

  const sections: string[] = []

  for (const [title, pattern] of CATEGORIES) {
    const matched = subjects.filter((subject) => pattern.test(subject))

    if (matched.length > 0) {
      sections.push(
        `\n### ${title}\n\n${matched.map((line) => `- ${line}`).join("\n")}\n`
      )
    }
  }

  const unmatched = subjects.filter((subject) => !CATEGORIZED.test(subject))

  if (unmatched.length > 0) {
    sections.push(`\n### Other\n\n${unmatched.map((line) => `- ${line}`).join("\n")}\n`)
  }

  return sections.join("")
}

/**
 * 读取指定区间的提交主题。
 *
 * @param commitRange - Git 区间。
 * @returns 主题列表。
 */
async function commitSubjects(commitRange: string): Promise<readonly string[]> {
  const result = await run("git", ["log", "--no-merges", "--format=%s", commitRange], {
    capture: true,
  })

  if (result.code !== 0) {
    return []
  }

  return result.stdout.split("\n").filter((line) => line !== "")
}

/**
 * 判断文件是否可读。
 *
 * @param filePath - 文件路径。
 * @returns 是否可读。
 */
function existsReadable(filePath: string): boolean {
  try {
    accessSync(filePath, constants.R_OK)

    return true
  } catch {
    return false
  }
}

/**
 * 为一个发布包生成完整的 Release notes。
 *
 * @param input - 生成输入。
 * @throws {WorkflowError} 说明文件不可读或生成器无输出时抛出。
 */
export async function writeReleaseNotes(input: NotesInput): Promise<void> {
  const { root, packageName, version, tagName, targetRef, outputFile, env, relativeDir } =
    input

  const previous = await previousTag(packageName, tagName, targetRef)

  const commitRange = previous === "" ? targetRef : `${previous}..${targetRef}`

  const header = [
    `## ${tagName}`,
    "",
    `- \`${packageName}@${version}\``,
    "",
    "### 变更摘要",
  ].join("\n")

  // 展示的对比范围必须与实际用于生成摘要的区间一致。
  const scope =
    previous === ""
      ? "\n这是当前仓库可追踪到的首个 release tag。\n"
      : `\n对比范围：\`${commitRange}\`\n`

  let content = `${header}\n${scope}`

  const notesFile =
    env.SCHEMX_RELEASE_NOTES_FILE || path.join(root, relativeDir, "release-notes.md")

  if (existsReadable(notesFile)) {
    content += `\n### 发布说明\n\n${readFileSync(notesFile, "utf8")}\n`
    writeFileSync(outputFile, content)

    return
  }

  if (env.SCHEMX_RELEASE_NOTES_FILE) {
    throw failure(`指定的 Release notes 文件不存在：${notesFile}`)
  }

  const generator = env.SCHEMX_RELEASE_NOTES_GENERATOR

  if (generator) {
    const generated = await run(generator, [
      "--repository",
      root,
      "--package",
      input.target,
      "--version",
      version,
      "--tag",
      tagName,
      "--previous-tag",
      previous,
      "--commit-range",
      commitRange,
    ])

    if (generated.code !== 0) {
      throw failure(
        `Release notes 生成器执行失败：${(generated.stderr || generated.stdout).trim()}`
      )
    }

    if (generated.stdout.trim() === "") {
      throw failure(`Release notes 生成器未返回内容：${generator}`)
    }

    content += `\n### 发布说明\n\n${generated.stdout}\n`
    writeFileSync(outputFile, content)

    return
  }

  content += await summarizeCommits(await commitSubjects(commitRange))
  writeFileSync(outputFile, content)
}
