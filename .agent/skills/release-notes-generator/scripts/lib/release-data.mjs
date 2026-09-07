import { readFile } from 'node:fs/promises'

// Categories that the Release Data schema permits as a primary user-facing section.
const primaryCategories = new Set([
  'breaking',
  'security',
  'feature',
  'improvement',
  'fix',
  'deprecation',
  'dependency',
  'documentation',
])

/**
 * Reads and parses a UTF-8 JSON document with its source path in parse errors.
 *
 * @param {string} filePath - Absolute or working-directory-relative JSON file path.
 * @returns {Promise<unknown>} Parsed JSON value.
 */
export async function readJsonFile(filePath) {
  // Source text whose parsing error should identify the supplied path.
  const source = await readFile(filePath, 'utf8')

  try {
    return JSON.parse(source)
  } catch (error) {
    throw new Error(`无法解析 JSON 文件：${filePath}`, { cause: error })
  }
}

/**
 * Checks the repository Release Data contract without requiring a runtime schema package.
 *
 * @param {unknown} value - Candidate Release Data value.
 * @param {{ requireEvidence: boolean, requireMigrationForBreaking: boolean }} rules - Repository validation rules.
 * @returns {string[]} Human-readable validation errors; an empty array denotes a valid value.
 */
export function validateReleaseData(value, rules) {
  // Collected contract violations reported together to make fixes efficient.
  const errors = []

  if (!isRecord(value)) {
    return ['Release Data 必须是 JSON 对象。']
  }

  requireNonEmptyString(value, 'version', errors)
  requireDate(value, 'date', errors)
  requireReleasePoint(value, 'from', errors)
  requireReleasePoint(value, 'to', errors)
  requireNonEmptyString(value, 'range', errors)
  requireNonEmptyString(value, 'summary', errors)
  validateNoInlineEvidence(value, 'summary', errors)
  validateStringListNoInlineEvidence(value.notices, 'notices', errors)

  if (!['repository', 'package'].includes(value.scope)) {
    errors.push('scope 必须为 repository 或 package。')
  }

  if (!Array.isArray(value.packages) || value.packages.length === 0 || value.packages.some(packageName => !isNonEmptyString(packageName))) {
    errors.push('packages 必须包含至少一个非空包名。')
  }

  if (!Array.isArray(value.changes)) {
    errors.push('changes 必须是数组。')
    return errors
  }

  // Unique identifiers prevent a renderer from accidentally merging unrelated changes.
  const changeIds = new Set()

  value.changes.forEach((change, index) => {
    validateChange(change, index, rules, changeIds, errors)
  })

  validateOptionalValidation(value.validation, errors)
  validateOptionalKnownIssues(value.knownIssues, errors)
  validateNoInlineEvidence(value, 'fullChangelog', errors)

  return errors
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
 * Determines whether a value is a non-empty string after trimming.
 *
 * @param {unknown} value - Value to inspect.
 * @returns {boolean} Whether the value is a meaningful string.
 */
function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0
}

/**
 * Requires one record field to be a non-empty string.
 *
 * @param {Record<string, unknown>} record - Record containing the field.
 * @param {string} field - Required field name.
 * @param {string[]} errors - Mutable error collection.
 * @returns {void}
 */
function requireNonEmptyString(record, field, errors) {
  if (!isNonEmptyString(record[field])) {
    errors.push(`${field} 必须是非空字符串。`)
  }
}

/**
 * Requires one record field to use the YYYY-MM-DD date form.
 *
 * @param {Record<string, unknown>} record - Record containing the field.
 * @param {string} field - Required date field name.
 * @param {string[]} errors - Mutable error collection.
 * @returns {void}
 */
function requireDate(record, field, errors) {
  // Date-only values keep release artifacts stable across time zones.
  const datePattern = /^\d{4}-\d{2}-\d{2}$/

  if (!isNonEmptyString(record[field]) || !datePattern.test(record[field])) {
    errors.push(`${field} 必须使用 YYYY-MM-DD 格式。`)
  }
}

/**
 * Requires a release endpoint object with a commit identifier.
 *
 * @param {Record<string, unknown>} record - Record containing the endpoint.
 * @param {string} field - Endpoint field name.
 * @param {string[]} errors - Mutable error collection.
 * @returns {void}
 */
function requireReleasePoint(record, field, errors) {
  // Candidate release endpoint whose commit makes the range reproducible.
  const point = record[field]

  if (!isRecord(point) || !isNonEmptyString(point.commit)) {
    errors.push(`${field}.commit 必须是非空字符串。`)
  }
}

/**
 * Validates one categorized user-facing change.
 *
 * @param {unknown} value - Candidate change value.
 * @param {number} index - Position in the changes collection.
 * @param {{ requireEvidence: boolean, requireMigrationForBreaking: boolean }} rules - Repository validation rules.
 * @param {Set<string>} changeIds - Seen change identifiers.
 * @param {string[]} errors - Mutable error collection.
 * @returns {void}
 */
function validateChange(value, index, rules, changeIds, errors) {
  // Prefix that identifies the invalid change without requiring its title to be valid.
  const label = `changes[${index}]`

  if (!isRecord(value)) {
    errors.push(`${label} 必须是对象。`)
    return
  }

  requireNonEmptyString(value, 'id', errors)
  requireNonEmptyString(value, 'title', errors)
  requireNonEmptyString(value, 'summary', errors)
  validateNoInlineEvidence(value, 'title', errors, `${label}.title`)
  validateNoInlineEvidence(value, 'summary', errors, `${label}.summary`)
  validateNoInlineEvidence(value, 'userImpact', errors, `${label}.userImpact`)
  validateMigrationNoInlineEvidence(value.migration, `${label}.migration`, errors)

  if (isNonEmptyString(value.id)) {
    if (changeIds.has(value.id)) {
      errors.push(`${label}.id 与其他变更重复：${value.id}。`)
    }
    changeIds.add(value.id)
  }

  if (!primaryCategories.has(value.primaryCategory)) {
    errors.push(`${label}.primaryCategory 不受支持。`)
  }

  if (rules.requireEvidence && (!isRecord(value.evidence) || !Array.isArray(value.evidence.commits) || value.evidence.commits.length === 0 || value.evidence.commits.some(commit => !isNonEmptyString(commit)))) {
    errors.push(`${label}.evidence.commits 必须包含至少一个提交证据。`)
  }

  if (value.primaryCategory === 'breaking' && rules.requireMigrationForBreaking) {
    if (!isRecord(value.migration) || !['verified', 'needs-maintainer-input'].includes(value.migration.status)) {
      errors.push(`${label}.migration 必须声明 verified 或 needs-maintainer-input。`)
    }
  }
}

/**
 * Rejects audit annotations embedded in prose that will be visible to release-note readers.
 *
 * @param {Record<string, unknown>} record - Candidate record containing a public prose field.
 * @param {string} field - Field name to inspect.
 * @param {string[]} errors - Mutable validation errors.
 * @param {string} [label] - Field name used in a validation error.
 * @returns {void}
 */
function validateNoInlineEvidence(record, field, errors, label = field) {
  const value = record[field]

  if (typeof value === 'string' && /[（(]\s*证据\s*[：:]/u.test(value)) {
    errors.push(`${label} 不得内嵌“证据：提交 SHA”；请保留在 evidence 字段中。`)
  }
}

/**
 * Validates public string arrays against embedded audit annotations.
 *
 * @param {unknown} value - Candidate string list.
 * @param {string} field - Field name used in a validation error.
 * @param {string[]} errors - Mutable validation errors.
 * @returns {void}
 */
function validateStringListNoInlineEvidence(value, field, errors) {
  if (!Array.isArray(value)) {
    return
  }

  value.forEach((item, index) => {
    if (typeof item === 'string' && /[（(]\s*证据\s*[：:]/u.test(item)) {
      errors.push(`${field}[${index}] 不得内嵌“证据：提交 SHA”；请保留在 evidence 字段中。`)
    }
  })
}

/**
 * Validates migration prose against embedded audit annotations.
 *
 * @param {unknown} value - Candidate migration object.
 * @param {string} field - Field name used in a validation error.
 * @param {string[]} errors - Mutable validation errors.
 * @returns {void}
 */
function validateMigrationNoInlineEvidence(value, field, errors) {
  if (!isRecord(value)) {
    return
  }

  for (const key of ['affected', 'before', 'after', 'replacement']) {
    validateNoInlineEvidence(value, key, errors, `${field}.${key}`)
  }

  validateStringListNoInlineEvidence(value.steps, `${field}.steps`, errors)
}

/**
 * Validates optional executed verification results.
 *
 * @param {unknown} value - Candidate validation result collection.
 * @param {string[]} errors - Mutable error collection.
 * @returns {void}
 */
function validateOptionalValidation(value, errors) {
  if (value === undefined) {
    return
  }

  if (!Array.isArray(value) || value.some(result => !isRecord(result) || !isNonEmptyString(result.name) || !['passed', 'failed', 'skipped'].includes(result.status))) {
    errors.push('validation 中的每项必须包含 name 和合法 status。')
  }
}

/**
 * Validates optional confirmed known issues.
 *
 * @param {unknown} value - Candidate known issue collection.
 * @param {string[]} errors - Mutable error collection.
 * @returns {void}
 */
function validateOptionalKnownIssues(value, errors) {
  if (value === undefined) {
    return
  }

  if (!Array.isArray(value) || value.some(issue => !isRecord(issue) || !isNonEmptyString(issue.summary))) {
    errors.push('knownIssues 中的每项必须包含非空 summary。')
    return
  }

  value.forEach((issue, index) => {
    validateNoInlineEvidence(issue, 'summary', errors, `knownIssues[${index}].summary`)
    validateNoInlineEvidence(issue, 'affected', errors, `knownIssues[${index}].affected`)
    validateNoInlineEvidence(issue, 'workaround', errors, `knownIssues[${index}].workaround`)
  })
}
