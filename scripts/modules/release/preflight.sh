#!/usr/bin/env bash

# 发布前外部状态校验。每个方法只验证一个事实并通过退出码报告结果。

preflight_root="$(cd "$(dirname "$BASH_SOURCE")/../.." && pwd)"
if ! declare -F ui_status >/dev/null 2>&1; then
  source "$preflight_root/lib/ui.sh"
fi

# 确认工作区没有未提交改动。
preflight_assert_clean_worktree() {
  local status
  status="$(git status --porcelain)"
  [[ -z "$status" ]] || {
    ui_status error '工作区存在未提交改动：'
    ui_note "$status"
    return 1
  }
}

# 确认正式版发布位于 main 分支。
preflight_assert_main_branch() {
  local branch
  branch="$(git branch --show-current)"
  [[ -n "$branch" ]] || branch='HEAD detached'
  [[ "$branch" == 'main' ]] || {
    ui_status error "正式发布必须位于 main 分支；当前分支：$branch。"
    return 1
  }
}

# 确认 pnpm 当前 registry 与预期 registry 一致。
preflight_assert_registry() {
  local expected_registry="${NPM_REGISTRY:-https://registry.npmjs.org/}"
  local actual_registry
  actual_registry="$(pnpm config get registry)"
  [[ "$actual_registry" == "$expected_registry" ]] || {
    ui_status error "npm registry 不匹配：当前 $actual_registry，预期 $expected_registry。"
    return 1
  }
}

# 使用 NPM_TOKEN 时创建一次性 npmrc；未提供 token 时不修改用户认证配置。
preflight_create_npm_token_config() {
  local registry="${NPM_REGISTRY:-https://registry.npmjs.org/}"
  local token="${NPM_TOKEN:-}"
  local auth_host
  local config_file

  [[ -n "$token" ]] || return 0
  auth_host="${registry#http://}"
  auth_host="${auth_host#https://}"
  auth_host="${auth_host%/}"
  config_file="$(mktemp "${TMPDIR:-/tmp}/schemx-npmrc.XXXXXX")" || return
  {
    printf 'registry=%s\n' "$registry"
    printf '//%s/:_authToken=%s\n' "$auth_host" "$token"
    printf 'always-auth=true\n'
  } >"$config_file"
  printf '%s' "$config_file"
}

# 在一次子命令调用期间注入 NPM_TOKEN，并始终清理临时 npmrc。
preflight_with_npm_token() {
  local config_file=''
  local exit_code

  if [[ -n "${NPM_TOKEN:-}" && -z "${NPM_CONFIG_USERCONFIG:-}" ]]; then
    config_file="$(preflight_create_npm_token_config)" || return
    NPM_CONFIG_USERCONFIG="$config_file" "$@"
    exit_code=$?
    rm -f "$config_file"
    return "$exit_code"
  fi
  "$@"
}

# 确认 npm 身份可用于目标 registry。
preflight_assert_npm_auth() {
  if ! preflight_with_npm_token pnpm whoami --registry "${NPM_REGISTRY:-https://registry.npmjs.org/}" >/dev/null; then
    ui_status error 'npm 未登录或当前 registry 无发布权限；请设置 NPM_TOKEN 或执行 pnpm login。'
    return 1
  fi
}

# 确认 GitHub CLI 已认证。
preflight_assert_github_auth() {
  if ! gh auth status >/dev/null 2>&1; then
    ui_status error 'GitHub CLI 未认证；请执行 gh auth login。'
    return 1
  fi
}

# 确认一个候选 npm 版本尚未发布；查询故障不得当作可用。
preflight_assert_version_available() {
  local package_name="$1"
  local version="$2"
  local output status
  if output="$(pnpm view "${package_name}@${version}" version --registry "${NPM_REGISTRY:-https://registry.npmjs.org/}" 2>&1)"; then
    ui_status error "$package_name@$version 已发布。"
    return 1
  else
    status=$?
  fi
  [[ "$status" -ne 0 && ( "$output" == *'No matching version found'* || "$output" == *'ERR_PNPM_NO_MATCHING_VERSION'* || "$output" == *'404 Not Found'* || "$output" == *'E404'* ) ]] || {
    ui_status error "无法确认 $package_name@$version 是否可用：$output"
    return 1
  }
}

# 确认预发布依赖的正式版本基线尚未发布，避免产生 SemVer 优先级倒退的版本。
preflight_assert_prerelease_baseline_available() {
  local package_name="$1"
  local baseline="$2"

  if ! preflight_assert_version_available "$package_name" "$baseline"; then
    ui_status error "预发布基线 $package_name@$baseline 不可用；请选择下一条版本线。"
    return 1
  fi
}

# 从 npm 已发布版本中计算指定基线与预发布通道的下一个序号。
preflight_next_prerelease_sequence() {
  local package_name="$1"
  local baseline="$2"
  local channel="$3"
  local registry="${NPM_REGISTRY:-https://registry.npmjs.org/}"
  local versions
  if _ui_can_spinner; then
    versions="$(gum spin --spinner dot --title "正在查询 ${package_name} 的 ${channel} 预发布序号" --show-error -- pnpm view "$package_name" versions --json --registry "$registry")" || return
  else
    versions="$(pnpm view "$package_name" versions --json --registry "$registry")" || return
  fi
  node -e '
const fs = require("node:fs")
const [baseline, channel] = process.argv.slice(1)
const input = fs.readFileSync(0, "utf8").trim()
const values = input ? JSON.parse(input) : []
const versions = Array.isArray(values) ? values : [values]
const pattern = new RegExp(`^${baseline.split(".").join("[.]")}-${channel}[.]([0-9]+)$`)
let max = -1
for (const version of versions) {
  const match = String(version).match(pattern)
  if (match) max = Math.max(max, Number(match[1]))
}
process.stdout.write(`${max + 1}\n`)
' "$baseline" "$channel" <<< "$versions"
}
