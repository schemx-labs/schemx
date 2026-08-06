import { execFileSync } from 'node:child_process'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readJsonFile } from './lib/release-data.mjs'

// Path of this CLI file, used to resolve the repository root without relying on the caller directory.
const scriptFile = fileURLToPath(import.meta.url)

// Skill root derived from the fixed scripts location.
const skillRoot = path.resolve(path.dirname(scriptFile), '..')

// Target repository supplied by the Skill as its current working directory.
const defaultRepositoryRoot = process.cwd()

// Repository-specific release policy bundled with this customized Skill.
const defaultConfigPath = path.join(skillRoot, 'references', 'schemaform-release-config.json')

/**
 * Parses the supported context collection command-line options.
 *
 * @param {string[]} argumentsList - Arguments after the Node executable and script path.
 * @returns {{ from?: string, to: string, packages?: string[], output?: string }} Parsed options.
 */
function parseArguments(argumentsList) {
  // Parsed options with HEAD as the stable default target revision.
  const options = { to: 'HEAD' }

  for (let index = 0; index < argumentsList.length; index += 1) {
    // Current command-line token.
    const argument = argumentsList[index]
    // Value paired with options that need one.
    const nextValue = argumentsList[index + 1]

    if (argument === '--') {
      continue
    }

    if (argument === '--from') {
      options.from = requireOptionValue(argument, nextValue)
      index += 1
      continue
    }

    if (argument === '--to') {
      options.to = requireOptionValue(argument, nextValue)
      index += 1
      continue
    }

    if (argument === '--packages') {
      // Explicit package names restrict collection to a release subset.
      options.packages = requireOptionValue(argument, nextValue).split(',').map(value => value.trim()).filter(Boolean)
      index += 1
      continue
    }

    if (argument === '--output') {
      options.output = requireOptionValue(argument, nextValue)
      index += 1
      continue
    }

    if (argument === '--help' || argument === '-h') {
      printUsage()
      process.exit(0)
    }

    throw new Error(`不支持的参数：${argument}`)
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
 * Prints the context collector usage contract.
 *
 * @returns {void}
 */
function printUsage() {
  console.log('用法：pnpm release:notes:context -- [--from <ref>] [--to <ref>] [--packages <name,...>] [--output <file>]')
}

/**
 * Runs a Git command in the repository and returns UTF-8 output.
 *
 * @param {string[]} argumentsList - Git arguments excluding the executable name.
 * @returns {string} Trimmed standard output.
 */
function runGit(argumentsList) {
  // Git output is only source evidence and never executes shell interpolation.
  const output = execFileSync('git', argumentsList, {
    cwd: defaultRepositoryRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  return output.trim()
}

/**
 * Reads publishable workspace packages declared by repository configuration.
 *
 * @param {Record<string, unknown>} config - Parsed release configuration.
 * @returns {Promise<Array<{ name: string, root: string, version: string, dependencies: string[] }>>} Publishable package metadata.
 */
async function readWorkspacePackages(config) {
  // Configured workspace root names; SchemaForm currently publishes packages/* only.
  const packageRoots = config.monorepo?.packageRoots

  if (!Array.isArray(packageRoots) || packageRoots.length === 0) {
    throw new Error('.release/config.json 缺少 monorepo.packageRoots。')
  }

  // Allow-list that prevents examples, plugins, and internal-only workspaces from becoming releases.
  const publishPackages = new Set(config.monorepo?.publishPackages ?? [])
  // Resulting publishable package metadata.
  const packages = []

  for (const packageRoot of packageRoots) {
    // Absolute directory containing sibling workspace packages.
    const absoluteRoot = path.join(defaultRepositoryRoot, packageRoot)
    // Directory entry names discovered without an external glob dependency.
    const entries = await readDirectoryNames(absoluteRoot)

    for (const entry of entries) {
      // Repository-relative workspace directory.
      const relativeRoot = path.posix.join(packageRoot, entry)
      // Package manifest location.
      const manifestPath = path.join(defaultRepositoryRoot, relativeRoot, 'package.json')
      // Package manifest parsed only when the directory is a workspace package.
      const manifest = await readOptionalJsonFile(manifestPath)

      if (!manifest || typeof manifest.name !== 'string' || typeof manifest.version !== 'string' || !publishPackages.has(manifest.name)) {
        continue
      }

      // All dependency sections that can make another publishable package relevant.
      const dependencySections = [manifest.dependencies, manifest.peerDependencies, manifest.optionalDependencies]
      // Internal package names referenced by this package.
      const dependencies = dependencySections.flatMap(section => isRecord(section) ? Object.keys(section).filter(name => publishPackages.has(name)) : [])

      packages.push({
        name: manifest.name,
        root: relativeRoot,
        version: manifest.version,
        dependencies,
      })
    }
  }

  return packages.sort((left, right) => left.name.localeCompare(right.name))
}

/**
 * Reads immediate directory names without treating missing directories as packages.
 *
 * @param {string} directoryPath - Directory to list.
 * @returns {Promise<string[]>} Child directory names.
 */
async function readDirectoryNames(directoryPath) {
  // Node filesystem module is loaded here to keep the top-level dependency list focused.
  const { readdir } = await import('node:fs/promises')
  // Directory entries with file type information.
  const entries = await readdir(directoryPath, { withFileTypes: true })

  return entries.filter(entry => entry.isDirectory()).map(entry => entry.name)
}

/**
 * Parses an optional JSON file and returns undefined when it does not exist.
 *
 * @param {string} filePath - Candidate JSON file path.
 * @returns {Promise<Record<string, unknown> | undefined>} Parsed record when present.
 */
async function readOptionalJsonFile(filePath) {
  try {
    // Manifest contents are intentionally parsed directly because this helper treats absence as normal.
    const source = await readFile(filePath, 'utf8')
    // Parsed manifest that must be an object to be useful.
    const value = JSON.parse(source)

    return isRecord(value) ? value : undefined
  } catch (error) {
    if (isRecord(error) && error.code === 'ENOENT') {
      return undefined
    }

    throw new Error(`无法读取 package.json：${filePath}`, { cause: error })
  }
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
 * Resolves the previous package-scoped tag reachable from a target revision.
 *
 * @param {string} packageName - npm package name represented by the tag.
 * @param {string} targetRef - Commit or revision to inspect.
 * @param {string} tagPattern - Configured package tag pattern.
 * @returns {string | undefined} Reachable package tag when one exists.
 */
function resolvePackageTag(packageName, targetRef, tagPattern) {
  try {
    // Git glob derived from the configured package tag convention.
    const tagGlob = tagPattern.replace('{packageName}', packageName).replace('{version}', '*')
    // Tags pointing at the release target must be excluded from its comparison baseline.
    const targetTags = new Set(runGit(['tag', '--points-at', targetRef]).split('\n').filter(Boolean))
    // Reachable tags sorted consistently with the repository's existing release implementation.
    const tags = runGit(['tag', '--merged', targetRef, '--sort=-creatordate', '--list', tagGlob]).split('\n').filter(Boolean)

    return tags.find(tag => !targetTags.has(tag))
  } catch {
    return undefined
  }
}

/**
 * Builds a comparison range from an optional baseline tag and target ref.
 *
 * @param {string | undefined} baseline - Baseline tag or commit.
 * @param {string} targetRef - Target revision.
 * @returns {string} Git revision range.
 */
function buildRange(baseline, targetRef) {
  if (baseline) {
    return `${baseline}..${targetRef}`
  }

  // Empty tree yields a committed-history comparison for first releases, never a worktree diff.
  const emptyTree = runGit(['hash-object', '-t', 'tree', '/dev/null'])

  return `${emptyTree}..${targetRef}`
}

/**
 * Lists changed paths for one package within the supplied Git range.
 *
 * @param {string} range - Git revision range.
 * @param {string} packageRoot - Repository-relative package root.
 * @returns {string[]} Changed file paths.
 */
function listChangedFiles(range, packageRoot) {
  // Newline-delimited file list limited to one package root.
  const output = runGit(['diff', '--name-only', range, '--', packageRoot])

  return output ? output.split('\n') : []
}

/**
 * Lists commits that modified one package in the supplied Git range.
 *
 * @param {string} range - Git revision range.
 * @param {string} packageRoot - Repository-relative package root.
 * @returns {string[]} Commit identifiers.
 */
function listCommits(range, packageRoot) {
  // Newline-delimited full commit identifiers limited to one package root.
  const output = runGit(['log', '--format=%H', range, '--', packageRoot])

  return output ? output.split('\n') : []
}

/**
 * Finds packages that declare a direct dependency on a changed package.
 *
 * @param {Array<{ name: string, dependencies: string[] }>} packages - Publishable workspace packages.
 * @param {string} changedPackageName - Package with direct source changes.
 * @returns {string[]} Potentially affected dependents requiring semantic review.
 */
function findPotentialDependents(packages, changedPackageName) {
  return packages.filter(packageInfo => packageInfo.dependencies.includes(changedPackageName)).map(packageInfo => packageInfo.name)
}

/**
 * Writes JSON through a same-directory temporary file to avoid partial artifacts.
 *
 * @param {string} filePath - Destination JSON path.
 * @param {unknown} value - JSON-serializable value.
 * @returns {Promise<void>} Completion once the destination has been atomically replaced.
 */
async function writeJsonAtomically(filePath, value) {
  // Destination directory created before a temporary sibling is written.
  const directoryPath = path.dirname(filePath)
  // Temporary sibling retained on the same filesystem for an atomic rename.
  const temporaryPath = path.join(directoryPath, `.${path.basename(filePath)}.${process.pid}.tmp`)
  // Stable JSON text for human review and tool consumption.
  const contents = `${JSON.stringify(value, null, 2)}\n`

  await mkdir(directoryPath, { recursive: true })
  await writeFile(temporaryPath, contents, 'utf8')
  await rename(temporaryPath, filePath)
}

/**
 * Collects deterministic Git and workspace evidence for changed publishable packages.
 *
 * @returns {Promise<void>} Completion after JSON has been printed or persisted.
 */
async function main() {
  // Requested collection options.
  const options = parseArguments(process.argv.slice(2))
  // Repository configuration controlling package discovery and output policy.
  const config = await readJsonFile(defaultConfigPath)
  // Config must be a record before nested settings are read.
  const releaseConfig = isRecord(config) ? config : undefined

  if (!releaseConfig || releaseConfig.schemaVersion !== 1) {
    throw new Error('.release/config.json 必须使用 schemaVersion: 1。')
  }

  // Publishable workspace packages known to the release system.
  const workspacePackages = await readWorkspacePackages(releaseConfig)
  // Configured tag naming pattern used to resolve package-specific baselines.
  const tagPattern = isRecord(releaseConfig.monorepo) && typeof releaseConfig.monorepo.tagPattern === 'string'
    ? releaseConfig.monorepo.tagPattern
    : '{packageName}@{version}'
  // Requested names used to filter the configured publishable packages.
  const requestedPackages = options.packages ? new Set(options.packages) : undefined
  // Package set selected by the caller or all configured publishable packages.
  const candidatePackages = requestedPackages ? workspacePackages.filter(packageInfo => requestedPackages.has(packageInfo.name)) : workspacePackages

  if (requestedPackages && candidatePackages.length !== requestedPackages.size) {
    throw new Error('--packages 包含不受发布配置支持的包名。')
  }

  // Git target commit captured to keep subsequent evidence collection consistent.
  const targetCommit = runGit(['rev-parse', options.to])
  // Package entries with direct source modifications in their own resolved range.
  const directPackages = []

  for (const packageInfo of candidatePackages) {
    // Package-specific baseline requested by the caller or resolved from reachable package tags.
    const previousTag = options.from ?? resolvePackageTag(packageInfo.name, options.to, tagPattern)
    // Package-specific range, which can differ across independently released packages.
    const range = buildRange(previousTag, options.to)
    // Changed source files directly owned by the package.
    const files = listChangedFiles(range, packageInfo.root)

    if (files.length === 0) {
      continue
    }

    // Package commits supplying the retained Git evidence.
    const commits = listCommits(range, packageInfo.root)

    directPackages.push({
      name: packageInfo.name,
      root: packageInfo.root,
      version: packageInfo.version,
      impact: 'direct',
      previousTag: previousTag ?? null,
      range,
      files,
      commits,
      potentialDependents: findPotentialDependents(workspacePackages, packageInfo.name),
    })
  }

  // Stable, machine-readable context deliberately separated from semantic release conclusions.
  const context = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    repositoryRoot: defaultRepositoryRoot,
    target: {
      ref: options.to,
      commit: targetCommit,
    },
    directPackages,
  }

  if (options.output) {
    await writeJsonAtomically(path.resolve(defaultRepositoryRoot, options.output), context)
    return
  }

  process.stdout.write(`${JSON.stringify(context, null, 2)}\n`)
}

main().catch((error) => {
  // CLI failures include the original reason without a stack trace unless Node is asked for one.
  const message = error instanceof Error ? error.message : String(error)

  console.error(`release-notes context 收集失败：${message}`)
  process.exitCode = 1
})
