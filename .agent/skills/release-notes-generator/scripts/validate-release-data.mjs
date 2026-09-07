import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readJsonFile, validateReleaseData } from './lib/release-data.mjs'

// Path of this CLI file, used to resolve the repository configuration reliably.
const scriptFile = fileURLToPath(import.meta.url)

// Skill root derived from the fixed scripts location.
const skillRoot = path.resolve(path.dirname(scriptFile), '..')

// Target repository supplied by the Skill as its current working directory.
const repositoryRoot = process.cwd()

// Repository-specific release policy bundled with this customized Skill.
const defaultConfigPath = path.join(skillRoot, 'references', 'schemaform-release-config.json')

/**
 * Prints the validator usage contract.
 *
 * @returns {void}
 */
function printUsage() {
  console.log('用法：pnpm release:notes:validate -- <release-data.json> [...]')
}

/**
 * Validates every supplied Release Data document against repository policy.
 *
 * @returns {Promise<void>} Completion when every document is valid.
 */
async function main() {
  // Input paths passed after the package-manager argument separator.
  const inputPaths = process.argv.slice(2).filter(argument => argument !== '--')

  if (inputPaths.includes('--help') || inputPaths.includes('-h')) {
    printUsage()
    return
  }

  if (inputPaths.length === 0) {
    throw new Error('至少需要一个 Release Data JSON 文件。')
  }

  // Repository configuration that controls evidence and migration requirements.
  const config = await readJsonFile(defaultConfigPath)

  if (!isRecord(config) || !isRecord(config.validation)) {
    throw new Error('.release/config.json 缺少 validation 配置。')
  }

  // Validation flags consumed by the deterministic contract checker.
  const rules = {
    requireEvidence: config.validation.requireEvidence === true,
    requireMigrationForBreaking: config.validation.requireMigrationForBreaking === true,
  }
  // All invalid documents are reported together before the command exits.
  const failures = []

  for (const inputPath of inputPaths) {
    // Absolute input path used in diagnostics.
    const resolvedPath = path.resolve(repositoryRoot, inputPath)
    // Parsed Release Data candidate.
    const data = await readJsonFile(resolvedPath)
    // Contract violations for the current candidate.
    const errors = validateReleaseData(data, rules)

    if (errors.length > 0) {
      failures.push(`${resolvedPath}\n${errors.map(error => `  - ${error}`).join('\n')}`)
    }
  }

  if (failures.length > 0) {
    throw new Error(`Release Data 校验失败：\n${failures.join('\n')}`)
  }

  console.log(`Release Data 校验通过：${inputPaths.length} 个文件。`)
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

main().catch((error) => {
  // CLI failures include the original reason without a stack trace unless Node is asked for one.
  const message = error instanceof Error ? error.message : String(error)

  console.error(`release-notes 校验失败：${message}`)
  process.exitCode = 1
})
