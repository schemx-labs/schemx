import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readJsonFile, validateReleaseData } from './lib/release-data.mjs'

// Path of this CLI file, used to resolve repository files without relying on the caller directory.
const scriptFile = fileURLToPath(import.meta.url)

// Skill root derived from the fixed scripts location.
const skillRoot = path.resolve(path.dirname(scriptFile), '..')

// Target repository supplied by the Skill as its current working directory.
const repositoryRoot = process.cwd()

// Repository-specific release policy bundled with this customized Skill.
const defaultConfigPath = path.join(skillRoot, 'references', 'schemaform-release-config.json')

// Ordered category labels for package-scoped user-facing changes.
const packageSectionDefinitions = [
  { category: 'deprecation', title: 'Deprecations' },
  { category: 'feature', title: 'Features' },
  { category: 'fix', title: 'Fixes' },
  { category: 'improvement', title: 'Improvements' },
  { category: 'documentation', title: 'Documentation' },
]

/**
 * Parses the renderer's required input and output paths.
 *
 * @param {string[]} argumentsList - Arguments after the Node executable and script path.
 * @returns {{ input: string, output?: string, template?: string, archive: boolean }} Parsed renderer options.
 */
function parseArguments(argumentsList) {
  // Options populated by explicit command-line flags.
  const options = { archive: false }

  for (let index = 0; index < argumentsList.length; index += 1) {
    // Current command-line token.
    const argument = argumentsList[index]
    // Value paired with options that need one.
    const nextValue = argumentsList[index + 1]

    if (argument === '--') {
      continue
    }

    if (argument === '--input') {
      options.input = requireOptionValue(argument, nextValue)
      index += 1
      continue
    }

    if (argument === '--output') {
      options.output = requireOptionValue(argument, nextValue)
      index += 1
      continue
    }

    if (argument === '--template') {
      options.template = requireOptionValue(argument, nextValue)
      index += 1
      continue
    }

    if (argument === '--archive') {
      options.archive = true
      continue
    }

    if (argument === '--help' || argument === '-h') {
      printUsage()
      process.exit(0)
    }

    throw new Error(`不支持的参数：${argument}`)
  }

  if (!options.input) {
    throw new Error('--input 为必填参数。')
  }

  return options
}

/**
 * Requires an option to have a following non-empty value.
 *
 * @param {string} option - Option awaiting its value.
 * @param {string | undefined} value - Candidate following token.
 * @returns {string} Validated option value.
 */
function requireOptionValue(option, value) {
  if (!value || value.startsWith('--')) {
    throw new Error(`${option} 需要一个值。`)
  }

  return value
}

/**
 * Prints the renderer usage contract.
 *
 * @returns {void}
 */
function printUsage() {
  console.log('用法：pnpm release:notes:render -- --input <release-data.json> [--output <release-notes.md>] [--archive] [--template <template.md>]')
}

/**
 * Determines whether a value can safely be read as a record.
 *
 * @param {unknown} value - Value to inspect.
 * @returns {value is Record<string, unknown>} Whether the value is a non-array object.
 */
function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Converts an optional string array into a filtered string array.
 *
 * @param {unknown} value - Candidate string collection.
 * @returns {string[]} Non-empty strings in source order.
 */
function stringList(value) {
  return Array.isArray(value) ? value.filter(item => typeof item === 'string' && item.trim().length > 0) : []
}

/**
 * Returns changes matching one primary category.
 *
 * @param {Record<string, unknown>} data - Validated Release Data.
 * @param {string} category - Primary category to select.
 * @returns {Array<Record<string, unknown>>} Matching changes.
 */
function changesForCategory(data, category) {
  // All changes are records after validation; the filter preserves source ordering.
  const changes = Array.isArray(data.changes) ? data.changes : []

  return changes.filter(change => isRecord(change) && change.primaryCategory === category)
}

/**
 * Renders a concise list item for a normal release change.
 *
 * @param {Record<string, unknown>} change - Validated release change.
 * @returns {string} Markdown list item.
 */
function renderListItem(change) {
  // Optional user impact appended only when it makes a regular item more actionable.
  const impact = typeof change.userImpact === 'string' && change.userImpact.trim().length > 0 ? `（影响范围：${change.userImpact.trim()}）` : ''

  return `- ${change.summary}${impact}`
}

/**
 * Renders one detailed breaking-change entry with its migration contract.
 *
 * @param {Record<string, unknown>} change - Validated breaking change.
 * @returns {string} Markdown subsection.
 */
function renderBreakingChange(change) {
  // Optional impact line displayed before migration guidance.
  const impact = typeof change.userImpact === 'string' && change.userImpact.trim().length > 0 ? `\n\n影响范围：${change.userImpact.trim()}` : ''
  // Migration record validated for every breaking change by repository policy.
  const migration = isRecord(change.migration) ? change.migration : undefined
  // Explicit steps are preferable to generated prose when available.
  const steps = migration ? stringList(migration.steps) : []
  // Optional replacement API named by the reviewed data.
  const replacement = migration && typeof migration.replacement === 'string' && migration.replacement.trim().length > 0 ? `\n\n替代方案：${migration.replacement.trim()}` : ''
  // Verified before-and-after snippets retain Markdown code fences from reviewed input when supplied.
  const examples = renderMigrationExamples(migration)
  // Required migration status protects users from unsupported upgrade promises.
  const migrationBody = migration?.status === 'needs-maintainer-input'
    ? '迁移方式需要维护者补充。'
    : renderMigrationSteps(steps)

  return `### ${change.title}\n\n${change.summary}${impact}\n\n#### 迁移说明\n\n${migrationBody}${replacement}${examples}`
}

/**
 * Renders migration steps or a minimal verified acknowledgement.
 *
 * @param {string[]} steps - Explicit migration instructions.
 * @returns {string} Markdown migration body.
 */
function renderMigrationSteps(steps) {
  if (steps.length === 0) {
    return '已确认不需要额外迁移步骤。'
  }

  return steps.map((step, index) => `${index + 1}. ${step}`).join('\n')
}

/**
 * Renders optional before-and-after migration snippets.
 *
 * @param {Record<string, unknown> | undefined} migration - Validated migration object.
 * @returns {string} Markdown snippets or an empty string.
 */
function renderMigrationExamples(migration) {
  if (!migration) {
    return ''
  }

  // Original code sample supplied by the reviewed migration data.
  const before = typeof migration.before === 'string' && migration.before.trim().length > 0 ? `\n\n升级前：\n\n\`\`\`ts\n${migration.before.trim()}\n\`\`\`` : ''
  // Replacement code sample supplied by the reviewed migration data.
  const after = typeof migration.after === 'string' && migration.after.trim().length > 0 ? `\n\n升级后：\n\n\`\`\`ts\n${migration.after.trim()}\n\`\`\`` : ''

  return `${before}${after}`
}

/**
 * Renders package-scoped feature, improvement, fix, deprecation, and documentation sections.
 *
 * @param {Record<string, unknown>} data - Validated Release Data.
 * @returns {string | undefined} Markdown section when relevant changes exist.
 */
function renderPackageCategory(data, definition) {
  // Individual package sections in stable package order.
  const packageSections = []

  for (const packageName of stringList(data.packages)) {
    // Changes belonging to both the current package and category.
    const changes = changesForCategory(data, definition.category).filter(change => change.package === packageName)

    if (changes.length > 0) {
      packageSections.push(`### ${packageName}\n\n${changes.map(renderListItem).join('\n')}`)
    }
  }

  return packageSections.length > 0 ? `## ${definition.title}\n\n${packageSections.join('\n\n')}` : undefined
}

/**
 * Renders a compact cross-cutting facet index without duplicating full change descriptions.
 *
 * @param {Record<string, unknown>} data - Validated Release Data.
 * @param {string} facet - Facet to select.
 * @param {string} heading - Section heading.
 * @returns {string | undefined} Markdown section when relevant changes exist.
 */
function renderFacetIndex(data, facet, heading) {
  // Changes tagged with the requested facet.
  const changes = (Array.isArray(data.changes) ? data.changes : []).filter(change => isRecord(change) && stringList(change.facets).includes(facet))

  if (changes.length === 0) {
    return undefined
  }

  return `${heading}\n\n${changes.map(change => `- ${change.title}${change.primaryCategory === 'breaking' ? '（详见不兼容变更）' : ''}`).join('\n')}`
}

/**
 * Renders a validation section from recorded command outcomes.
 *
 * @param {Record<string, unknown>} data - Validated Release Data.
 * @returns {string | undefined} Markdown section when results exist.
 */
function renderValidation(data) {
  // Recorded verification outcomes, never inferred by this renderer.
  const results = Array.isArray(data.validation) ? data.validation.filter(isRecord) : []

  if (results.length === 0) {
    return undefined
  }

  // Display labels matching the release-note reader's language.
  const labels = {
    passed: '通过',
    failed: '失败',
    skipped: '跳过',
  }

  return `## Validation\n\n${results.map(result => `- ${result.name}：${labels[result.status] ?? result.status}${typeof result.environment === 'string' && result.environment.trim().length > 0 ? `（${result.environment.trim()}）` : ''}`).join('\n')}`
}

/**
 * Renders a known-issues section from confirmed data.
 *
 * @param {Record<string, unknown>} data - Validated Release Data.
 * @returns {string | undefined} Markdown section when issues exist.
 */
function renderKnownIssues(data) {
  // Confirmed known issues only; the renderer does not infer new ones.
  const issues = Array.isArray(data.knownIssues) ? data.knownIssues.filter(isRecord) : []

  if (issues.length === 0) {
    return undefined
  }

  return `## Known Issues\n\n${issues.map(issue => {
    // Optional scope for the known issue.
    const affected = typeof issue.affected === 'string' && issue.affected.trim().length > 0 ? `（影响范围：${issue.affected.trim()}）` : ''
    // Optional documented workaround.
    const workaround = typeof issue.workaround === 'string' && issue.workaround.trim().length > 0 ? `；临时方案：${issue.workaround.trim()}` : ''

    return `- ${issue.summary}${affected}${workaround}`
  }).join('\n')}`
}

/**
 * Renders all optional Markdown sections in prescribed reader order.
 *
 * @param {Record<string, unknown>} data - Validated Release Data.
 * @param {Record<string, unknown>} config - Parsed release configuration.
 * @returns {string} Markdown sections separated by blank lines.
 */
function renderSections(data, config) {
  // Sections accumulated in final reader order.
  const sections = []
  // Prominent notices supplied by reviewed Release Data.
  const notices = stringList(data.notices)
  // Detailed incompatible changes.
  const breakingChanges = changesForCategory(data, 'breaking')
  // Confirmed security changes.
  const securityChanges = changesForCategory(data, 'security')
  // Dependency and environment changes relevant to users.
  const dependencyChanges = changesForCategory(data, 'dependency')
  // Configured renderer options with safe defaults.
  const renderOptions = isRecord(config.render) ? config.render : {}

  if (notices.length > 0) {
    sections.push(`## Important Notices\n\n${notices.map(notice => `- ${notice}`).join('\n')}`)
  }

  if (breakingChanges.length > 0) {
    sections.push(`## Breaking Changes\n\n${breakingChanges.map(renderBreakingChange).join('\n\n')}`)
  }

  if (securityChanges.length > 0) {
    sections.push(`## Security\n\n${securityChanges.map(renderListItem).join('\n')}`)
  }

  for (const definition of packageSectionDefinitions) {
    const packageCategory = renderPackageCategory(data, definition)

    if (packageCategory) {
      sections.push(packageCategory)
    }
  }

  // Cross-cutting type changes are indexed after package-specific details.
  const typeScriptChanges = renderFacetIndex(data, 'typescript', '## TypeScript Changes')

  if (typeScriptChanges) {
    sections.push(typeScriptChanges)
  }

  if (dependencyChanges.length > 0) {
    sections.push(`## Dependencies and Compatibility\n\n${dependencyChanges.map(renderListItem).join('\n')}`)
  }

  if (renderOptions.includeValidation !== false) {
    // Validation output is conditional because some public releases intentionally omit it.
    const validation = renderValidation(data)

    if (validation) {
      sections.push(validation)
    }
  }

  // Known issues always remain opt-in through the reviewed data itself.
  const knownIssues = renderKnownIssues(data)

  if (knownIssues) {
    sections.push(knownIssues)
  }

  if (renderOptions.includeFullChangelog !== false && typeof data.fullChangelog === 'string' && data.fullChangelog.trim().length > 0) {
    sections.push(`## Full Changelog\n\n${data.fullChangelog.trim()}`)
  }

  sections.push(renderAffectedPackages(data))

  return sections.join('\n\n')
}

/**
 * Renders YAML frontmatter from the stable release metadata.
 *
 * @param {Record<string, unknown>} data - Validated Release Data.
 * @returns {string} YAML frontmatter block.
 */
function renderMetadata(data) {
  // Package tag is the preferred public baseline; first releases explicitly state its absence.
  const previous = isRecord(data.from) && typeof data.from.tag === 'string' && data.from.tag.trim().length > 0 ? data.from.tag : '无 Tag'
  // A short SHA is enough for reader-facing release metadata.
  const targetCommit = isRecord(data.to) && typeof data.to.commit === 'string' ? data.to.commit.slice(0, 7) : ''

  const branch = typeof data.branch === 'string' && data.branch.trim().length > 0 ? data.branch.trim() : 'unknown'

  return `## 版本信息\n\n- 基准版本：${previous}\n- 比较范围：${data.range}\n- 目标提交：${targetCommit}\n- 当前分支：${branch}\n- 生成日期：${data.date}`
}

/**
 * Renders the affected publishable packages as a stable reader-facing index.
 *
 * @param {Record<string, unknown>} data - Validated Release Data.
 * @returns {string} Markdown section.
 */
function renderAffectedPackages(data) {
  return `## Affected Packages\n\n${stringList(data.packages).map(packageName => `- ${packageName}`).join('\n')}`
}

/**
 * Applies the repository's minimal Markdown template to reviewed release content.
 *
 * @param {string} template - Template source.
 * @param {Record<string, unknown>} data - Validated Release Data.
 * @param {Record<string, unknown>} config - Parsed release configuration.
 * @returns {string} Complete Markdown artifact.
 */
function renderTemplate(template, data, config) {
  // Supported placeholder values for the intentionally small template contract.
  const replacements = {
    metadata: renderMetadata(data),
    summary: data.summary,
    sections: renderSections(data, config),
  }

  return template.replace(/\{\{(metadata|summary|sections)\}\}/g, (_, key) => replacements[key]).replace(/\n{3,}/g, '\n\n').trimEnd() + '\n'
}

/**
 * Resolves one configured path pattern against a package release identity.
 *
 * @param {string} pattern - Configured output path pattern.
 * @param {{ packageName: string, packageRoot: string, version: string }} values - Release path values.
 * @returns {string} Repository-relative resolved path.
 */
function interpolateOutputPath(pattern, values) {
  // Logical package token excludes the npm scope to keep archive directories compact.
  const packageToken = values.packageName.replace(/^@[^/]+\//, '')

  return pattern
    .replaceAll('{package}', packageToken)
    .replaceAll('{packageName}', values.packageName)
    .replaceAll('{packageRoot}', values.packageRoot)
    .replaceAll('{version}', values.version)
}

/**
 * Resolves a repository-level output pattern without package substitutions.
 *
 * @param {string} pattern - Configured repository output path pattern.
 * @param {string} version - Release version.
 * @returns {string} Repository-relative resolved path.
 */
function interpolateRepositoryOutputPath(pattern, version) {
  return pattern.replaceAll('{version}', version)
}

/**
 * Resolves the workspace root of one configured publishable package.
 *
 * @param {string} packageName - npm package name to locate.
 * @param {Record<string, unknown>} config - Parsed release configuration.
 * @returns {Promise<string>} Repository-relative package root.
 */
async function resolvePackageRoot(packageName, config) {
  // Monorepo settings that declare which workspace directories contain release packages.
  const monorepo = isRecord(config.monorepo) ? config.monorepo : undefined
  // Candidate workspace root names.
  const packageRoots = monorepo && Array.isArray(monorepo.packageRoots) ? monorepo.packageRoots.filter(item => typeof item === 'string') : []

  for (const packageRoot of packageRoots) {
    // Absolute parent directory containing package subdirectories.
    const absoluteRoot = path.join(repositoryRoot, packageRoot)
    // Child entries with directory type information.
    const entries = await readdir(absoluteRoot, { withFileTypes: true })

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue
      }

      // Repository-relative candidate package root.
      const relativeRoot = path.posix.join(packageRoot, entry.name)
      // Package manifest source used only to match its published name.
      const source = await readFile(path.join(repositoryRoot, relativeRoot, 'package.json'), 'utf8')
      // Parsed package manifest.
      const manifest = JSON.parse(source)

      if (isRecord(manifest) && manifest.name === packageName) {
        return relativeRoot
      }
    }
  }

  throw new Error(`无法从 monorepo.packageRoots 解析发布包：${packageName}`)
}

/**
 * Resolves explicit or configured Markdown output paths for one package release.
 *
 * @param {{ output?: string, archive: boolean }} options - Parsed renderer options.
 * @param {Record<string, unknown>} data - Validated Release Data.
 * @param {Record<string, unknown>} config - Parsed release configuration.
 * @returns {Promise<string[]>} Absolute output paths in write order.
 */
async function resolveOutputPaths(options, data, config) {
  if (options.output) {
    return [path.resolve(repositoryRoot, options.output)]
  }

  // Output settings that define repository and package-level destinations.
  const output = isRecord(config.output) ? config.output : undefined

  if (!output) {
    throw new Error('.release/config.json 缺少 output 配置。')
  }

  if (data.scope === 'repository') {
    if (typeof output.repositoryLatest !== 'string') {
      throw new Error('.release/config.json 缺少 output.repositoryLatest。')
    }

    const outputs = [path.resolve(repositoryRoot, interpolateRepositoryOutputPath(output.repositoryLatest, data.version))]

    if (options.archive) {
      if (typeof output.repositoryArchive !== 'string') {
        throw new Error('.release/config.json 缺少 output.repositoryArchive。')
      }

      outputs.push(path.resolve(repositoryRoot, interpolateRepositoryOutputPath(output.repositoryArchive, data.version)))
    }

    return [...new Set(outputs)]
  }

  if (data.scope !== 'package' || !Array.isArray(data.packages) || data.packages.length !== 1 || typeof data.packages[0] !== 'string') {
    throw new Error('未指定 --output 时，Release Data 必须是 repository 或仅包含一个包的 package 作用域。')
  }

  if (typeof output.latest !== 'string') {
    throw new Error('.release/config.json 缺少 output.latest。')
  }

  // Single package represented by this Release Data document.
  const packageName = data.packages[0]
  // Package root resolved from the configured workspace map.
  const packageRoot = await resolvePackageRoot(packageName, config)
  // Common token values for every configured output pattern.
  const values = { packageName, packageRoot, version: data.version }
  // Latest package-local note consumed by the existing release workflow.
  const outputs = [path.resolve(repositoryRoot, interpolateOutputPath(output.latest, values))]

  if (options.archive) {
    if (typeof output.archive !== 'string') {
      throw new Error('.release/config.json 缺少 output.archive。')
    }

    outputs.push(path.resolve(repositoryRoot, interpolateOutputPath(output.archive, values)))
  }

  return [...new Set(outputs)]
}

/**
 * Writes Markdown through a same-directory temporary file to avoid partial output.
 *
 * @param {string} filePath - Destination Markdown path.
 * @param {string} contents - Rendered Markdown contents.
 * @returns {Promise<void>} Completion once the destination has been atomically replaced.
 */
async function writeAtomically(filePath, contents) {
  // Destination directory created before a temporary sibling is written.
  const directoryPath = path.dirname(filePath)
  // Temporary sibling retained on the same filesystem for an atomic rename.
  const temporaryPath = path.join(directoryPath, `.${path.basename(filePath)}.${process.pid}.tmp`)

  await mkdir(directoryPath, { recursive: true })
  await writeFile(temporaryPath, contents, 'utf8')
  await rename(temporaryPath, filePath)
}

/**
 * Validates and renders one reviewed Release Data document.
 *
 * @returns {Promise<void>} Completion once every selected output path has been replaced.
 */
async function main() {
  // Explicit renderer input and output options.
  const options = parseArguments(process.argv.slice(2))
  // Repository settings shared with the validator.
  const config = await readJsonFile(defaultConfigPath)

  if (!isRecord(config) || !isRecord(config.validation) || !isRecord(config.render)) {
    throw new Error('.release/config.json 缺少 validation 或 render 配置。')
  }

  // Validated JSON input prepared by the release-notes Skill.
  const data = await readJsonFile(path.resolve(repositoryRoot, options.input))
  // Repository validation flags that guard public output.
  const rules = {
    requireEvidence: config.validation.requireEvidence === true,
    requireMigrationForBreaking: config.validation.requireMigrationForBreaking === true,
  }
  // Contract violations must stop rendering before an existing note can be replaced.
  const errors = validateReleaseData(data, rules)

  if (errors.length > 0) {
    throw new Error(`输入 Release Data 不合法：\n${errors.map(error => `- ${error}`).join('\n')}`)
  }

  // Repository default template, optionally overridden for controlled experiments.
  const templatePath = options.template ?? config.render.template

  if (typeof templatePath !== 'string' || templatePath.trim().length === 0) {
    throw new Error('.release/config.json 缺少 render.template。')
  }

  // Text template with only the documented placeholder contract.
  const template = await readFile(path.resolve(skillRoot, templatePath), 'utf8')
  // Final Markdown built exclusively from reviewed structured data.
  const markdown = renderTemplate(template, data, config)

  // Explicit or configuration-derived destinations for this package Release Note.
  const outputPaths = await resolveOutputPaths(options, data, config)

  for (const outputPath of outputPaths) {
    await writeAtomically(outputPath, markdown)
    console.log(`Release Note 已写入：${outputPath}`)
  }
}

main().catch((error) => {
  // CLI failures include the original reason without a stack trace unless Node is asked for one.
  const message = error instanceof Error ? error.message : String(error)

  console.error(`release-notes 渲染失败：${message}`)
  process.exitCode = 1
})
