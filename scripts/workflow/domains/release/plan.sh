#!/usr/bin/env bash

# 发布计划的创建与读取。计划一旦创建，后续流程只读取其中的版本与发布配置。

# 将完整发布计划序列化为 JSON 文件。
# 包记录格式为 package|npmPackageName|currentVersion|baselineVersion|version。
plan_write() {
  # 计划文件绝对路径。
  local plan_file="$1"
  # 发布通道。
  local channel="$2"
  # 原始发布目标。
  local target="$3"
  # 版本动作或精确版本。
  local version_action="$4"
  # npm dist-tag。
  local dist_tag="$5"
  # 当前源码提交。
  local source_sha="$6"
  shift 6

  node - "$plan_file" "$channel" "$target" "$version_action" "$dist_tag" "$source_sha" "$@" <<'NODE'
const fs = require('node:fs')

const [file, channel, target, versionAction, distTag, sourceSha, ...records] = process.argv.slice(2)
const packages = records.map((record) => {
  const [package, name, currentVersion, baselineVersion, version] = record.split('|')
  if (!package || !name || !currentVersion || !baselineVersion || !version) throw new Error(`无效计划包记录：${record}`)
  return {
    name,
    package,
    currentVersion,
    baselineVersion,
    version,
    tag: `${name}@${version}`,
  }
})

const isPrerelease = channel !== 'latest' && channel !== 'dev'
const plan = {
  schemaVersion: 1,
  channel,
  target,
  versionAction,
  baselineVersion: packages.length === 1 ? packages[0].baselineVersion : '按包独立计算',
  distTag,
  sourceSha,
  createCommit: channel === 'latest',
  createTag: channel !== 'dev',
  createGithubRelease: channel !== 'dev',
  prerelease: isPrerelease,
  packages,
}

fs.mkdirSync(require('node:path').dirname(file), { recursive: true })
fs.writeFileSync(file, `${JSON.stringify(plan, null, 2)}\n`)
NODE
}

# 验证并输出冻结计划 JSON，供 dry-run 和工作流读取。
plan_read() {
  # 计划文件绝对路径。
  local plan_file="$1"
  node - "$plan_file" <<'NODE'
const fs = require('node:fs')
const file = process.argv[2]
const plan = JSON.parse(fs.readFileSync(file, 'utf8'))
if (plan.schemaVersion !== 1 || !Array.isArray(plan.packages) || plan.packages.length === 0) {
  throw new Error(`无效发布计划：${file}`)
}
process.stdout.write(`${JSON.stringify(plan)}\n`)
NODE
}

# 按冻结计划中的稳定顺序输出逻辑包名与 npm 包名。
plan_packages() {
  local plan_file="$1"
  node - "$plan_file" <<'NODE'
const fs = require('node:fs')
const plan = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))
for (const pkg of plan.packages || []) {
  if (!pkg.package || !pkg.name) throw new Error('发布计划缺少包信息')
  console.log(`${pkg.package}\t${pkg.name}`)
}
NODE
}

# 读取冻结计划的发布通道。
plan_channel() {
  local plan_file="$1"
  plan_value "$plan_file" channel
}

# 读取计划中的一个顶层标量字段；缺失字段视为无效冻结计划。
plan_value() {
  local plan_file="$1"
  local field="$2"

  jq -er --arg field "$field" '.[$field] // empty' "$plan_file"
}

# 按稳定顺序输出发布记录：逻辑包、npm 包名、版本和 Tag。
plan_release_records() {
  local plan_file="$1"

  jq -er '.packages[] | select(.package and .name and .version and .tag) | [.package, .name, .version, .tag] | @tsv' "$plan_file"
}

# 按稳定顺序输出用于版本可用性检查的包记录。
plan_version_records() {
  local plan_file="$1"

  jq -er '.packages[] | select(.name and .baselineVersion and .version) | [.name, .baselineVersion, .version] | @tsv' "$plan_file"
}
