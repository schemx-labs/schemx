#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TMP_DIR="$(mktemp -d)"
MOCK_BIN="$TMP_DIR/bin"
COMMAND_LOG="$TMP_DIR/commands.log"

mkdir -p "$MOCK_BIN"
touch "$COMMAND_LOG"

# 删除隔离测试目录，避免 mock 工具和日志残留。
cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

cat >"$MOCK_BIN/git" <<'MOCK'
#!/usr/bin/env bash
set -euo pipefail

printf 'git %s\n' "$*" >>"${COMMAND_LOG:?}"

if [[ -n "${MOCK_COMMAND_FAIL_MATCH:-}" && "git $*" == *"$MOCK_COMMAND_FAIL_MATCH"* ]]; then
  printf 'mock git failure: %s\n' "$*" >&2
  exit 1
fi

case "$1" in
  branch)
    if [[ "${2:-}" == "--show-current" ]]; then
      printf '%s\n' "${MOCK_BRANCH:-main}"
      exit 0
    fi
    ;;
  status)
    exit 0
    ;;
  rev-parse)
    if [[ "${2:-}" == "--short" ]]; then
      printf 'abc1234\n'
      exit 0
    fi
    ;;
  config)
    if [[ "${2:-}" == "--get" && "${3:-}" == "remote.origin.url" ]]; then
      printf 'git@github.com:Jiohon/schemx.git\n'
      exit 0
    fi
    ;;
  tag)
    if [[ "${2:-}" == "-l" ]]; then
      if [[ -n "${MOCK_LOCAL_TAG_EXISTS:-}" && "${3:-}" == "$MOCK_LOCAL_TAG_EXISTS" ]]; then
        printf '%s\n' "$MOCK_LOCAL_TAG_EXISTS"
      fi
      exit 0
    fi
    if [[ "${2:-}" == "--sort=-creatordate" ]]; then
      printf '@schemx/core@0.1.22\n'
      printf '@schemx/vue@0.1.19\n'
      printf '@schemx/vant@0.1.9\n'
      exit 0
    fi
    exit 0
    ;;
  ls-remote)
    if [[ "${MOCK_REMOTE_TAG_ERROR:-0}" == "1" ]]; then
      printf 'fatal: unable to access remote\n' >&2
      exit 128
    fi
    if [[ "${MOCK_REMOTE_TAG_EXISTS:-0}" == "1" ]]; then
      printf 'abc123\t%s\n' "${*: -1}"
      exit 0
    fi
    exit 2
    ;;
  add)
    exit 0
    ;;
  commit)
    exit 0
    ;;
  log)
    if [[ "$*" == *"--format=%s"* ]]; then
      printf 'feat(core): 支持动态 schema 更新\n'
      printf 'fix(vue): 修复 renderer 字段值同步链路\n'
      printf 'chore(发布): 优化发布流程\n'
      exit 0
    fi
    ;;
  push)
    exit 0
    ;;
esac

printf 'unexpected git command: %s\n' "$*" >&2
exit 1
MOCK

cat >"$MOCK_BIN/pnpm" <<'MOCK'
#!/usr/bin/env bash
set -euo pipefail

printf 'pnpm %s\n' "$*" >>"${COMMAND_LOG:?}"

if [[ -n "${MOCK_COMMAND_FAIL_MATCH:-}" && "pnpm $*" == *"$MOCK_COMMAND_FAIL_MATCH"* ]]; then
  printf 'mock pnpm failure: %s\n' "$*" >&2
  exit 1
fi

case "$1" in
  config)
    printf 'https://registry.npmjs.org/\n'
    ;;
  whoami)
    if [[ "${MOCK_NPM_AUTH_FAIL:-0}" == "1" && -z "${NPM_CONFIG_USERCONFIG:-}" ]]; then
      printf 'npm whoami failed\n' >&2
      exit 1
    fi
    printf 'mock-user\n'
    ;;
  view)
    if [[ -n "${MOCK_PNPM_VIEW_EXISTS:-}" && "$*" == *"${MOCK_PNPM_VIEW_EXISTS}"* ]]; then
      printf '0.0.0\n'
      exit 0
    fi
    printf 'ERR_PNPM_NO_MATCHING_VERSION No matching version found\n' >&2
    exit 1
    ;;
  *)
    ;;
esac
MOCK

cat >"$MOCK_BIN/npm" <<'MOCK'
#!/usr/bin/env bash
set -euo pipefail

printf 'npm %s\n' "$*" >>"${COMMAND_LOG:?}"

if [[ "${MOCK_NPM_VERSION_MUTATE:-0}" == "1" ]]; then
  prefix=""
  version=""
  args=("$@")
  for ((i = 0; i < ${#args[@]}; i++)); do
    if [[ "${args[$i]}" == "--prefix" ]]; then
      prefix="${args[$((i + 1))]}"
    elif [[ "${args[$i]}" == "version" ]]; then
      version="${args[$((i + 1))]}"
    fi
  done

  if [[ -n "$prefix" && -n "$version" ]]; then
    "${REAL_NODE:?}" -e '
const fs = require("node:fs");
const path = process.argv[1];
const version = process.argv[2];
const pkg = JSON.parse(fs.readFileSync(path, "utf8"));
pkg.version = version;
fs.writeFileSync(path, JSON.stringify(pkg, null, 2) + "\n");
' "$prefix/package.json" "$version"
  fi
fi

if [[ -n "${MOCK_COMMAND_FAIL_MATCH:-}" && "npm $*" == *"$MOCK_COMMAND_FAIL_MATCH"* ]]; then
  printf 'mock npm failure: %s\n' "$*" >&2
  exit 1
fi
MOCK

cat >"$MOCK_BIN/gh" <<'MOCK'
#!/usr/bin/env bash
set -euo pipefail

printf 'gh %s\n' "$*" >>"${COMMAND_LOG:?}"

case "$1" in
  auth)
    if [[ "${2:-}" == "status" ]]; then
      if [[ "${MOCK_GITHUB_AUTH_FAIL:-0}" == "1" ]]; then
        printf 'gh auth failed\n' >&2
        exit 1
      fi
      exit 0
    fi
    ;;
  release)
    if [[ "${2:-}" == "view" ]]; then
      if [[ "${MOCK_GITHUB_RELEASE_ERROR:-0}" == "1" ]]; then
        printf 'failed to connect to api.github.com\n' >&2
        exit 1
      fi
      if [[ "${MOCK_GITHUB_RELEASE_EXISTS:-0}" == "1" ]]; then
        exit 0
      fi
      printf 'release not found\n' >&2
      exit 1
    fi
    if [[ "${2:-}" == "create" ]]; then
      tag_name="${3:-}"
      pkg="${tag_name#@schemx/}"
      pkg="${pkg%%@*}"
      version="${tag_name#@schemx/${pkg}@}"
      notes_file=""

      while [[ "$#" -gt 0 ]]; do
        if [[ "$1" == "--notes-file" ]]; then
          notes_file="${2:-}"
          break
        fi
        shift
      done

      if [[ -z "$notes_file" || ! -f "$notes_file" ]]; then
        printf 'missing release notes file\n' >&2
        exit 1
      fi

      grep -Fq "## @schemx/${pkg}@${version}" "$notes_file"
      grep -Fq "@schemx/${pkg}@${version}" "$notes_file"
      if [[ -n "${MOCK_EXPECT_RELEASE_NOTE:-}" ]]; then
        grep -Fq "$MOCK_EXPECT_RELEASE_NOTE" "$notes_file"
      else
        grep -Fq 'feat(core): 支持动态 schema 更新' "$notes_file"
      fi
      exit 0
    fi
    ;;
esac

printf 'unexpected gh command: %s\n' "$*" >&2
exit 1
MOCK

cat >"$MOCK_BIN/node" <<'MOCK'
#!/usr/bin/env bash
set -euo pipefail

if [[ "${MOCK_RELEASE_CANCEL:-0}" == "1" && "${1:-}" == */select-release-option.mjs ]]; then
  result_file=""
  for ((index = 1; index <= $#; index++)); do
    if [[ "${!index}" == "--result-file" ]]; then
      next_index=$((index + 1))
      result_file="${!next_index}"
      break
    fi
  done
  printf '已取消选择\n' >&2
  if [[ -n "$result_file" ]]; then
    printf '__SCHEMX_RELEASE_CANCELLED__\n' >"$result_file"
  else
    printf '__SCHEMX_RELEASE_CANCELLED__\n'
  fi
  exit 0
fi

exec "${REAL_NODE:?}" "$@"
MOCK

chmod +x "$MOCK_BIN/git" "$MOCK_BIN/pnpm" "$MOCK_BIN/npm" "$MOCK_BIN/gh" "$MOCK_BIN/node"

export REAL_NODE="$(command -v node)"
export PATH="$MOCK_BIN:$PATH"
export COMMAND_LOG

# 在 mock PATH 下执行发布入口。
run_release() {
  bash "$ROOT_DIR/scripts/release/release.sh" "$@" 2>&1
}

# 断言文本包含预期片段。
assert_contains() {
  local haystack="$1"
  local needle="$2"

  if [[ "$haystack" != *"$needle"* ]]; then
    printf '期望输出包含：%s\n实际输出：\n%s\n' "$needle" "$haystack" >&2
    exit 1
  fi
}

# 断言文本不包含不应出现的片段。
assert_not_contains() {
  local haystack="$1"
  local needle="$2"

  if [[ "$haystack" == *"$needle"* ]]; then
    printf '期望输出不包含：%s\n实际输出：\n%s\n' "$needle" "$haystack" >&2
    exit 1
  fi
}

# 断言片段出现次数，验证不会重复执行关键操作。
assert_occurrences() {
  local haystack="$1"
  local needle="$2"
  local expected="$3"
  local actual

  actual="$(printf '%s' "$haystack" | grep -Fo -- "$needle" | wc -l | tr -d ' ')"

  if [[ "$actual" != "$expected" ]]; then
    printf '期望输出中 %s 出现 %s 次，实际出现 %s 次。\n实际输出：\n%s\n' "$needle" "$expected" "$actual" "$haystack" >&2
    exit 1
  fi
}

# 断言被 mock 的外部命令已被调用。
assert_log_contains() {
  local needle="$1"

  if ! grep -Fq -- "$needle" "$COMMAND_LOG"; then
    printf '期望命令日志包含：%s\n实际日志：\n' "$needle" >&2
    cat "$COMMAND_LOG" >&2
    exit 1
  fi
}

# 断言失败路径在危险命令前停止。
assert_log_not_contains() {
  local needle="$1"

  if grep -Fq -- "$needle" "$COMMAND_LOG"; then
    printf '期望命令日志不包含：%s\n实际日志：\n' "$needle" >&2
    cat "$COMMAND_LOG" >&2
    exit 1
  fi
}

# 断言两条命令在日志中的先后顺序。
assert_log_order() {
  local first="$1"
  local second="$2"
  local first_line second_line

  first_line="$(grep -Fn -- "$first" "$COMMAND_LOG" | head -1 | cut -d: -f1 || true)"
  second_line="$(grep -Fn -- "$second" "$COMMAND_LOG" | head -1 | cut -d: -f1 || true)"

  if [[ -z "$first_line" || -z "$second_line" || "$first_line" -ge "$second_line" ]]; then
    printf '期望命令 %s 早于 %s。\n实际日志：\n' "$first" "$second" >&2
    cat "$COMMAND_LOG" >&2
    exit 1
  fi
}

# 断言两个输出片段的先后顺序。
assert_text_order() {
  local content="$1"
  local first="$2"
  local second="$3"
  local before_second

  before_second="${content%%"$second"*}"
  if [[ "$content" != *"$first"* || "$content" != *"$second"* || "$before_second" != *"$first"* ]]; then
    printf '期望输出 %s 早于 %s。\n实际输出：\n%s\n' "$first" "$second" "$content" >&2
    exit 1
  fi
}

# 根据测试工作区当前版本计算 patch 候选，避免版本发布后断言过期。
expected_patch_version() {
  local pkg="$1"
  local current_version

  current_version="$(node -p "require('$ROOT_DIR/packages/$pkg/package.json').version")"
  bash -c "source '$ROOT_DIR/scripts/release/common.sh'; next_stable_version '$current_version' patch"
}

# 验证帮助只暴露统一发布入口。
test_help_lists_channel_commands_without_package_shortcuts() {
  local output
  output="$(run_release help)"

  assert_contains "$output" "pnpm release:publish [dev|alpha|beta|rc|next|latest] [all|core[,vue,vant]] [current|patch|minor|major|x.y.z]"
  assert_not_contains "$output" "pnpm release:publish:alpha"
  assert_not_contains "$output" "pnpm release:version:patch"
  assert_not_contains "$output" "bash scripts/release/release.sh publish-alpha"
  assert_not_contains "$output" "bash scripts/release/release.sh version"
}

# 验证 package.json 不再保留分散的发布快捷命令。
test_package_scripts_keep_single_publish_entry() {
  local scripts
  scripts="$(node -e "
const pkg = require('$ROOT_DIR/package.json');
console.log(Object.keys(pkg.scripts).filter((name) => name.startsWith('release:')).join('\n'));
")"

  assert_contains "$scripts" "release:publish"
  assert_not_contains "$scripts" "release:publish:"
  assert_not_contains "$scripts" "release:version:"
}

# 验证根命令统一委托目标选择器，而不是维护 scope 前缀变体。
test_root_scripts_use_bare_commands() {
  node -e "
const assert = require('node:assert/strict');
const pkg = require('$ROOT_DIR/package.json');
const scripts = pkg.scripts || {};

// 运行类任务统一为裸命令，经 run-with-targets 按 scope 分组交互选择
for (const name of [
  'lint',
  'lint:fix',
  'format',
  'format:check',
  'type-check',
  'check',
  'test',
  'build',
  'build:analyze',
  'dev',
  'pack-local',
  'install-local',
  'check:package-config',
  'check:bundle-boundaries',
  'check:packages',
]) {
  assert.ok(scripts[name], \`缺少根命令 \${name}\`);
}

// 不再保留 packages:* / plugins:* / examples:* 前缀的运行类命令
for (const name of [
  'packages:build',
  'packages:check',
  'packages:lint',
  'packages:pack-local',
  'plugins:build',
  'plugins:check',
  'plugins:lint',
  'plugins:pack-local',
  'examples:vant:dev',
  'examples:install-local',
  'packages:check-config',
  'packages:check-bundle-boundaries',
  'packages:check-contract',
  'packages:install-local-to-examples',
]) {
  assert.ok(!scripts[name], \`不应继续保留 scope 前缀命令 \${name}\`);
}

assert.equal(scripts['lint'], 'node scripts/run-with-targets.mjs lint');
assert.equal(scripts['check:package-config'], 'node scripts/packages/check-config.mjs');
assert.equal(scripts['check:bundle-boundaries'], 'node scripts/packages/check-bundle-boundaries.mjs');
assert.equal(scripts['check:packages'], 'pnpm check:package-config && pnpm check:bundle-boundaries');
"
}

# 验证本地 tarball 使用唯一版本以绕开缓存。
test_pack_local_helper_creates_timestamped_versions() {
  local output

  output="$(node --input-type=module -e "
import { createTimestampedVersion } from '$ROOT_DIR/scripts/packages/pack-local.mjs';
console.log(createTimestampedVersion('0.2.0', '20260709153045'));
")"

  if [[ "$output" != "0.2.0-dev.20260709153045" ]]; then
    printf '本地 pack 版本应追加 dev 时间戳。\n实际输出：%s\n' "$output" >&2
    exit 1
  fi
}

# 验证安装提示仅由 tarball 路径组成。
test_pack_local_creates_install_command_from_tarballs() {
  local output

  output="$(node --input-type=module -e "
import assert from 'node:assert/strict';
import { createInstallCommand } from '$ROOT_DIR/scripts/packages/pack-local.mjs';

assert.equal(
  createInstallCommand(['/tmp/core.tgz', '/tmp/plugin.tgz']),
  'pnpm i /tmp/core.tgz /tmp/plugin.tgz'
);
")"

  if [[ -n "$output" ]]; then
    printf '生成本地 tarball 安装命令时不应额外输出。\n实际输出：%s\n' "$output" >&2
    exit 1
  fi
}

# 验证插件打包脚本提供机器可读的 tarball 输出标记。
test_plugin_pack_reports_generated_tarball_path() {
  node -e "
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const source = readFileSync('$ROOT_DIR/scripts/plugins/pack-vite-plugin.sh', 'utf8');

assert.ok(source.includes('__SCHEMX_LOCAL_TARBALL__='));
"
}

# 验证本地打包脚本未回归已移除的手工 tarball 分析逻辑。
test_pack_local_does_not_keep_manual_tarball_analysis() {
  node -e "
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const source = readFileSync('$ROOT_DIR/scripts/packages/pack-local.mjs', 'utf8');

assert.doesNotMatch(source, /function (formatSize|collectFiles|analyzeTarball|printTarballAnalysis)\\b/);
assert.doesNotMatch(source, /\\b(mkdtempSync|readdirSync|rmSync|statSync|tmpdir|relative)\\b/);
assert.match(source, /import \{ createTerminalSession \} from \"\.\.\/lib\/terminal-feedback\/index\.mjs\"/);
assert.match(source, /session\.run\(/);
"
}

# 验证各脚本复用统一的终端分隔样式。
test_terminal_section_uses_shared_separator() {
  local output

  output="$(node --input-type=module -e "
import { createTerminalUi } from '$ROOT_DIR/scripts/lib/terminal-feedback/index.mjs';

let output = '';
const ui = createTerminalUi({
  output: { write(value) { output += value; } },
  input: { isTTY: false },
});
ui.section('构建 @schemx/core');
process.stdout.write(output);
")"

  assert_contains "$output" "◇ 构建 @schemx/core"
}

# 验证发布测试入口也遵循统一的终端输出约定。
test_release_test_uses_shared_separator() {
  node -e "
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const source = readFileSync('$ROOT_DIR/scripts/release/release.test.sh', 'utf8');

assert.ok(source.includes('scripts/terminal.mjs'));
assert.ok(source.includes('release:test ['));
"
}

# 验证目标运行器逐包执行，避免递归 pnpm 混合日志。
test_run_with_targets_separates_each_target() {
  local output

  output="$(node "$ROOT_DIR/scripts/run-with-targets.mjs" build 2>&1)"

  assert_contains "$output" "构建 @schemx/core"
  assert_contains "$output" "构建 @schemx/vue"
  assert_contains "$output" "构建 @schemx/vant"
  assert_not_contains "$output" "pnpm -r"
  assert_log_contains "pnpm --filter @schemx/core run build"
  assert_log_contains "pnpm --filter @schemx/vue run build"
  assert_log_contains "pnpm --filter @schemx/vant run build"
}

# 验证风险更高的正式发布通道位于交互列表末尾。
test_release_channel_choices_put_latest_last() {
  local output

  output="$(bash -c "source '$ROOT_DIR/scripts/release/common.sh'; release_channel_choices")"

  if [[ "$output" != "dev、alpha、beta、rc、next、latest" ]]; then
    printf '发布通道选项应把 latest 放在最后。\n实际输出：%s\n' "$output" >&2
    exit 1
  fi
}

# 验证选择 custom 后由同一个 Clack 交互会话读取完整的正式版本号。
test_custom_version_uses_clack_prompt() {
  local selected

  selected="$(SCHEMX_RELEASE_VERSION_ACTION=custom SCHEMX_RELEASE_CUSTOM_VERSION=0.2.3 node "$ROOT_DIR/scripts/select-release-option.mjs" --kind version-action --channel latest --target core current patch minor major custom)"

  if [[ "$selected" != "0.2.3" ]]; then
    printf 'custom 版本输入应返回完整版本号。实际结果：%s\n' "$selected" >&2
    exit 1
  fi

  selected="$(SCHEMX_RELEASE_CUSTOM_VERSION=0.2.3 node "$ROOT_DIR/scripts/select-release-option.mjs" --kind custom-version --channel latest --target core)"

  if [[ "$selected" != "0.2.3" ]]; then
    printf '直接 custom 版本输入应返回完整版本号。实际结果：%s\n' "$selected" >&2
    exit 1
  fi
}

# 验证正式版本可以在不修改 package.json 的情况下计算。
test_next_stable_version_calculates_without_mutating_files() {
  local package_before output

  package_before="$(cat "$ROOT_DIR/packages/core/package.json")"
  output="$(bash -c "source '$ROOT_DIR/scripts/release/common.sh'; next_stable_version 1.2.3 minor")"

  if [[ "$output" != "1.3.0" ]]; then
    printf 'minor 候选版本应为 1.3.0，实际为 %s。\n' "$output" >&2
    exit 1
  fi

  if [[ "$(cat "$ROOT_DIR/packages/core/package.json")" != "$package_before" ]]; then
    printf '计算候选版本不应修改 package.json。\n' >&2
    exit 1
  fi
}

# 验证 npm 可用性检查使用调用方提供的候选版本。
test_version_availability_uses_explicit_candidate() {
  : >"$COMMAND_LOG"

  bash "$ROOT_DIR/scripts/release/check-versions-available.sh" "core=9.8.7" >/dev/null

  assert_log_contains "pnpm view @schemx/core@9.8.7 version --registry https://registry.npmjs.org/"
}

# 验证 npm 查询异常不会被误判为候选版本可用。
test_version_availability_rejects_registry_lookup_error() {
  local output status

  export MOCK_COMMAND_FAIL_MATCH="pnpm view @schemx/core@9.8.7"
  set +e
  output="$(bash "$ROOT_DIR/scripts/release/check-versions-available.sh" "core=9.8.7" 2>&1)"
  status=$?
  set -e
  unset MOCK_COMMAND_FAIL_MATCH

  [[ "$status" -ne 0 ]]
  assert_contains "$output" "无法确认 npm 候选版本"
}

# 验证正式版候选发布标记没有冲突时通过。
test_release_markers_accept_available_candidate() {
  local output

  : >"$COMMAND_LOG"
  output="$(bash "$ROOT_DIR/scripts/release/check-release-markers-available.sh" "core=9.8.7" 2>&1)"

  assert_contains "$output" "@schemx/core@9.8.7 可创建"
  assert_log_contains "git tag -l @schemx/core@9.8.7"
  assert_log_contains "git ls-remote --exit-code --tags origin refs/tags/@schemx/core@9.8.7"
  assert_log_contains "gh release view @schemx/core@9.8.7 --repo Jiohon/schemx"
}

# 验证本地候选 tag 冲突会阻止发布。
test_release_markers_reject_local_tag() {
  local output status

  export MOCK_LOCAL_TAG_EXISTS="@schemx/core@9.8.7"
  set +e
  output="$(bash "$ROOT_DIR/scripts/release/check-release-markers-available.sh" "core=9.8.7" 2>&1)"
  status=$?
  set -e
  unset MOCK_LOCAL_TAG_EXISTS

  [[ "$status" -ne 0 ]]
  assert_contains "$output" "本地 Git tag 已存在：@schemx/core@9.8.7"
}

# 验证远端候选 tag 冲突会阻止发布。
test_release_markers_reject_remote_tag() {
  local output status

  export MOCK_REMOTE_TAG_EXISTS=1
  set +e
  output="$(bash "$ROOT_DIR/scripts/release/check-release-markers-available.sh" "core=9.8.7" 2>&1)"
  status=$?
  set -e
  unset MOCK_REMOTE_TAG_EXISTS

  [[ "$status" -ne 0 ]]
  assert_contains "$output" "远端 Git tag 已存在：@schemx/core@9.8.7"
}

# 验证同名 GitHub Release 冲突会阻止发布。
test_release_markers_reject_github_release() {
  local output status

  export MOCK_GITHUB_RELEASE_EXISTS=1
  set +e
  output="$(bash "$ROOT_DIR/scripts/release/check-release-markers-available.sh" "core=9.8.7" 2>&1)"
  status=$?
  set -e
  unset MOCK_GITHUB_RELEASE_EXISTS

  [[ "$status" -ne 0 ]]
  assert_contains "$output" "GitHub Release 已存在：@schemx/core@9.8.7"
}

# 验证远端 tag 查询异常会中止预检。
test_release_markers_reject_remote_lookup_error() {
  local output status

  export MOCK_REMOTE_TAG_ERROR=1
  set +e
  output="$(bash "$ROOT_DIR/scripts/release/check-release-markers-available.sh" "core=9.8.7" 2>&1)"
  status=$?
  set -e
  unset MOCK_REMOTE_TAG_ERROR

  [[ "$status" -ne 0 ]]
  assert_contains "$output" "无法检查远端 Git tag"
}

# 验证 GitHub Release 查询异常会中止预检。
test_release_markers_reject_github_lookup_error() {
  local output status

  export MOCK_GITHUB_RELEASE_ERROR=1
  set +e
  output="$(bash "$ROOT_DIR/scripts/release/check-release-markers-available.sh" "core=9.8.7" 2>&1)"
  status=$?
  set -e
  unset MOCK_GITHUB_RELEASE_ERROR

  [[ "$status" -ne 0 ]]
  assert_contains "$output" "无法检查 GitHub Release"
}

# 验证 release:test 不会意外运行整个工作区测试集。
test_release_test_runs_only_release_script_tests() {
  local script
  script="$(node -p "require('$ROOT_DIR/package.json').scripts['release:test']")"

  if [[ "$script" != "bash scripts/release/release.test.sh" ]]; then
    printf 'release:test 应只运行 release.test.sh。\n实际脚本：%s\n' "$script" >&2
    exit 1
  fi
}

# 验证 release:check 按发布包依赖拓扑运行质量门禁。
test_release_check_uses_package_dependency_chain() {
  : >"$COMMAND_LOG"

  run_release check >/dev/null

  assert_log_contains "pnpm --filter @schemx/core... --filter @schemx/vue... --filter @schemx/vant... test"
  assert_log_contains "pnpm --filter @schemx/core... --filter @schemx/vue... --filter @schemx/vant... lint"
  assert_log_contains "pnpm --filter @schemx/core... --filter @schemx/vue... --filter @schemx/vant... build"
  assert_log_not_contains "pnpm test"
  assert_log_not_contains "pnpm lint"
  assert_log_not_contains "pnpm build"
}

# 验证 dev 发布使用临时版本和 dev tag，随后恢复工作区版本。
test_dev_publish_uses_dev_tag_and_restores_version() {
  local before after output

  before="$(node -p "require('$ROOT_DIR/packages/core/package.json').version")"
  : >"$COMMAND_LOG"

  export MOCK_BRANCH="feature/demo"
  output="$(run_release publish dev core)"
  unset MOCK_BRANCH

  after="$(node -p "require('$ROOT_DIR/packages/core/package.json').version")"

  if [[ "$before" != "$after" ]]; then
    printf 'dev 发布后应恢复 package.json 版本：%s != %s\n' "$before" "$after" >&2
    exit 1
  fi

  assert_contains "$output" "发布计划"
  assert_contains "$output" "通道    dev - Dev 开发测试发布"
  assert_contains "$output" "目标    core"
  assert_contains "$output" "tag     dev"
  assert_not_contains "$output" "发布模式：dev"
  assert_log_contains "pnpm --dir packages/core publish --access public --registry https://registry.npmjs.org/ --tag dev --no-git-checks"
  assert_log_not_contains "gh auth status"
  assert_log_not_contains "gh release create"
  assert_log_not_contains "git tag"
  assert_log_not_contains "git push"
}

# 验证 latest 发布在非 main 分支被拒绝。
test_latest_publish_is_main_only() {
  local output status

  export MOCK_BRANCH="feature/demo"
  set +e
  output="$(run_release publish latest core current 2>&1)"
  status=$?
  set -e
  unset MOCK_BRANCH

  if [[ "$status" -eq 0 ]]; then
    printf '非 main 分支正式发布应失败。\n' >&2
    exit 1
  fi

  assert_contains "$output" "正式发布只能在 main 分支执行"
}

# 验证 npm 未认证时停止在发布命令之前，并给出处理提示。
test_publish_without_npm_auth_shows_clear_message() {
  local output status

  export MOCK_NPM_AUTH_FAIL=1
  set +e
  output="$(run_release publish latest core current 2>&1)"
  status=$?
  set -e
  unset MOCK_NPM_AUTH_FAIL

  if [[ "$status" -eq 0 ]]; then
    printf '未登录 npm 时，发布应失败。\n' >&2
    exit 1
  fi

  assert_contains "$output" "检查 npm 登录状态"
  assert_contains "$output" "npm 未登录或当前 registry 无权限"
  assert_contains "$output" "设置 NPM_TOKEN 后重新执行发布命令"
  assert_contains "$output" "pnpm login --registry \"https://registry.npmjs.org/\""
  assert_contains "$output" "完成浏览器确认后，请回到终端等待命令继续"
  assert_not_contains "$output" "ELIFECYCLE"
}

# 验证 NPM_TOKEN 可通过临时 npmrc 完成非交互认证。
test_publish_accepts_npm_token_auth() {
  local output status

  export MOCK_NPM_AUTH_FAIL=1
  export NPM_TOKEN=mock-token
  set +e
  output="$(run_release publish alpha core 2>&1)"
  status=$?
  set -e
  unset MOCK_NPM_AUTH_FAIL
  unset NPM_TOKEN

  if [[ "$status" -ne 0 ]]; then
    printf '设置 NPM_TOKEN 后，npm auth 检查应通过。\n%s\n' "$output" >&2
    exit 1
  fi

  assert_contains "$output" "检查 npm 登录状态"
  assert_not_contains "$output" "npm 未登录或当前 registry 无权限"
  assert_log_contains "pnpm --dir packages/core publish --access public --registry https://registry.npmjs.org/ --tag alpha --no-git-checks"
}

# 验证 latest 缺少 GitHub 认证时不会开始 npm 发布。
test_publish_without_github_auth_stops_before_publish() {
  local output status

  : >"$COMMAND_LOG"

  export MOCK_GITHUB_AUTH_FAIL=1
  set +e
  output="$(run_release publish latest core current 2>&1)"
  status=$?
  set -e
  unset MOCK_GITHUB_AUTH_FAIL

  if [[ "$status" -eq 0 ]]; then
    printf 'GitHub CLI 未登录时，正式发布应失败。\n' >&2
    exit 1
  fi

  assert_contains "$output" "检查 GitHub CLI 登录状态"
  assert_contains "$output" "GitHub CLI 未登录或无权限"
  assert_log_contains "gh auth status"
  assert_log_not_contains "pnpm --dir packages/core publish"
}

# 验证检测到重复版本时提供下一步版本升级建议。
test_publish_existing_version_suggests_release_version() {
  local output status

  export MOCK_PNPM_VIEW_EXISTS="@schemx/vue@"
  set +e
  output="$(run_release publish latest vue current 2>&1)"
  status=$?
  set -e
  unset MOCK_PNPM_VIEW_EXISTS

  if [[ "$status" -eq 0 ]]; then
    printf '已存在的正式版本应阻止发布。\n' >&2
    exit 1
  fi

  assert_contains "$output" "@schemx/vue@"
  assert_contains "$output" "已存在"
  assert_contains "$output" "pnpm release:publish latest vue patch"
  assert_log_not_contains "pnpm --dir packages/vue publish"
}

# 验证 alpha 发布使用 alpha tag 且不会遗留临时版本。
test_alpha_publish_uses_alpha_tag_and_restores_version() {
  local before after

  before="$(node -p "require('$ROOT_DIR/packages/core/package.json').version")"
  : >"$COMMAND_LOG"

  export MOCK_BRANCH="feature/demo"
  output="$(run_release publish alpha core)"
  unset MOCK_BRANCH

  after="$(node -p "require('$ROOT_DIR/packages/core/package.json').version")"

  if [[ "$before" != "$after" ]]; then
    printf 'alpha 发布后应恢复 package.json 版本：%s != %s\n' "$before" "$after" >&2
    exit 1
  fi

  assert_contains "$output" "发布计划"
  assert_contains "$output" "通道    alpha - Alpha 预发布"
  assert_contains "$output" "目标    core"
  assert_contains "$output" "tag     alpha"
  assert_not_contains "$output" "发布模式：alpha"
  assert_contains "$output" "registry  https://registry.npmjs.org/"
  assert_contains "$output" "tag       alpha"
  assert_contains "$output" "终端可能会停在认证提示处"
  assert_contains "$output" "完成后回到这里等待发布继续"
  assert_text_order "$output" "运行目标依赖链测试：core" "生成临时 alpha 预发布版本"
  assert_log_contains "pnpm --dir packages/core publish --access public --registry https://registry.npmjs.org/ --tag alpha --no-git-checks"
  assert_log_not_contains "gh auth status"
  assert_log_not_contains "gh release create"
  assert_log_not_contains "git tag"
  assert_log_not_contains "git push"
}

# 验证 pack 子命令支持单个发布目标。
test_pack_accepts_target() {
  : >"$COMMAND_LOG"

  run_release pack vant >/dev/null

  assert_log_contains "pnpm --filter @schemx/vant pack --pack-destination $ROOT_DIR"
  assert_log_not_contains "pnpm --filter @schemx/core pack --pack-destination $ROOT_DIR"
  assert_log_not_contains "pnpm --filter @schemx/vue pack --pack-destination $ROOT_DIR"
}

# 验证逗号分隔的多个发布目标会按稳定顺序分别执行。
test_publish_accepts_multiple_targets() {
  local output

  : >"$COMMAND_LOG"

  export MOCK_BRANCH="feature/demo"
  output="$(run_release publish alpha vue,core)"
  unset MOCK_BRANCH

  assert_contains "$output" "目标    core、vue"
  assert_log_contains "pnpm --dir packages/core publish --access public --registry https://registry.npmjs.org/ --tag alpha --no-git-checks"
  assert_log_contains "pnpm --dir packages/vue publish --access public --registry https://registry.npmjs.org/ --tag alpha --no-git-checks"
  assert_log_not_contains "pnpm --dir packages/vant publish"
}

# 验证单包 patch 发布会升级版本、提交锁文件并发布目标包。
test_latest_publish_patch_bumps_commits_and_publishes_target() {
  local core_version vue_version vant_version

  core_version="$(expected_patch_version core)"
  vue_version="$(expected_patch_version vue)"
  vant_version="$(expected_patch_version vant)"
  : >"$COMMAND_LOG"

  run_release publish latest vue patch >/dev/null

  assert_log_contains "npm --prefix packages/vue version $vue_version --no-git-tag-version"
  assert_log_not_contains "npm --prefix packages/core version $core_version --no-git-tag-version"
  assert_log_not_contains "npm --prefix packages/vant version $vant_version --no-git-tag-version"
  assert_log_contains "pnpm install --lockfile-only"
  assert_log_contains "git add packages/vue/package.json pnpm-lock.yaml"
  assert_log_contains "git commit -m chore(发布): 提升 vue 版本"
  assert_log_contains "pnpm --dir packages/vue publish --access public --registry https://registry.npmjs.org/"
  assert_log_order "pnpm --filter @schemx/vue... test" "npm --prefix packages/vue version"
  assert_log_order "pnpm --filter @schemx/vue pack --dry-run" "npm --prefix packages/vue version"
  assert_log_order "git commit -m chore(发布): 提升 vue 版本" "pnpm --dir packages/vue publish"
}

# 验证正式版 test 失败时不会提升版本或产生提交。
test_latest_quality_failure_stops_before_version_transaction() {
  local output status

  : >"$COMMAND_LOG"
  export MOCK_COMMAND_FAIL_MATCH="pnpm --filter @schemx/core... test"
  set +e
  output="$(run_release publish latest core patch 2>&1)"
  status=$?
  set -e
  unset MOCK_COMMAND_FAIL_MATCH

  if [[ "$status" -eq 0 ]]; then
    printf '质量门禁失败时发布命令应失败。\n%s\n' "$output" >&2
    exit 1
  fi

  assert_log_not_contains "npm --prefix packages/core version"
  assert_log_not_contains "pnpm install --lockfile-only"
  assert_log_not_contains "git commit -m chore(发布)"
  assert_log_not_contains "pnpm --dir packages/core publish"
}

# 验证预发布质量门禁失败时不会写入临时版本。
test_prerelease_quality_failure_stops_before_temporary_version() {
  local before output status

  before="$(cat "$ROOT_DIR/packages/core/package.json")"
  : >"$COMMAND_LOG"
  export MOCK_COMMAND_FAIL_MATCH="pnpm --filter @schemx/core... test"
  set +e
  output="$(run_release publish alpha core 2>&1)"
  status=$?
  set -e
  unset MOCK_COMMAND_FAIL_MATCH

  [[ "$status" -ne 0 ]]
  [[ "$(cat "$ROOT_DIR/packages/core/package.json")" == "$before" ]]
  assert_not_contains "$output" "生成临时 alpha 预发布版本"
  assert_log_not_contains "pnpm --dir packages/core publish"
}

# 验证 lockfile 同步失败时恢复正式版本文件且不提交。
test_latest_lockfile_failure_rolls_back_version_files() {
  local before output status

  before="$(cat "$ROOT_DIR/packages/core/package.json")"
  : >"$COMMAND_LOG"
  export MOCK_NPM_VERSION_MUTATE=1
  export MOCK_COMMAND_FAIL_MATCH="pnpm install --lockfile-only"
  set +e
  output="$(run_release publish latest core patch 2>&1)"
  status=$?
  set -e
  unset MOCK_COMMAND_FAIL_MATCH
  unset MOCK_NPM_VERSION_MUTATE

  [[ "$status" -ne 0 ]]
  if [[ "$(cat "$ROOT_DIR/packages/core/package.json")" != "$before" ]]; then
    printf 'lockfile 同步失败后应恢复 core/package.json。\n%s\n' "$output" >&2
    exit 1
  fi
  assert_log_not_contains "git commit -m chore(发布)"
  assert_log_not_contains "pnpm --dir packages/core publish"
}

# 验证版本 commit 失败时恢复正式版本文件且不发布。
test_latest_commit_failure_rolls_back_version_files() {
  local before output status

  before="$(cat "$ROOT_DIR/packages/core/package.json")"
  : >"$COMMAND_LOG"
  export MOCK_NPM_VERSION_MUTATE=1
  export MOCK_COMMAND_FAIL_MATCH="git commit -m chore(发布): 提升 core 版本"
  set +e
  output="$(run_release publish latest core patch 2>&1)"
  status=$?
  set -e
  unset MOCK_COMMAND_FAIL_MATCH
  unset MOCK_NPM_VERSION_MUTATE

  [[ "$status" -ne 0 ]]
  if [[ "$(cat "$ROOT_DIR/packages/core/package.json")" != "$before" ]]; then
    printf '版本 commit 失败后应恢复 core/package.json。\n%s\n' "$output" >&2
    exit 1
  fi
  assert_log_not_contains "pnpm --dir packages/core publish"
}

# 验证多包发布中途失败时输出部分发布状态，并停止后续 tag/Release。
test_multi_package_publish_failure_reports_partial_result() {
  local output status

  : >"$COMMAND_LOG"
  export MOCK_COMMAND_FAIL_MATCH="pnpm --dir packages/vue publish"
  set +e
  output="$(run_release publish latest all current 2>&1)"
  status=$?
  set -e
  unset MOCK_COMMAND_FAIL_MATCH

  [[ "$status" -ne 0 ]]
  assert_contains "$output" "已发布：core"
  assert_contains "$output" "失败：vue"
  assert_contains "$output" "未执行：vant"
  assert_log_contains "pnpm --dir packages/core publish"
  assert_log_contains "pnpm --dir packages/vue publish"
  assert_log_not_contains "pnpm --dir packages/vant publish"
  assert_log_not_contains "git tag -a"
  assert_log_not_contains "gh release create"
}

# 验证 all 的 patch 发布覆盖全部包并生成统一提交。
test_latest_publish_patch_all_bumps_and_commits_all_packages() {
  local core_version vue_version vant_version

  core_version="$(expected_patch_version core)"
  vue_version="$(expected_patch_version vue)"
  vant_version="$(expected_patch_version vant)"
  : >"$COMMAND_LOG"

  run_release publish latest all patch >/dev/null

  assert_log_contains "npm --prefix packages/core version $core_version --no-git-tag-version"
  assert_log_contains "npm --prefix packages/vue version $vue_version --no-git-tag-version"
  assert_log_contains "npm --prefix packages/vant version $vant_version --no-git-tag-version"
  assert_log_contains "pnpm install --lockfile-only"
  assert_log_contains "git add packages/core/package.json packages/vue/package.json packages/vant/package.json pnpm-lock.yaml"
  assert_log_contains "git commit -m chore(发布): 提升 packages 版本"
}

# 验证精确版本不会被误用于多个包。
test_latest_publish_explicit_version_requires_single_target() {
  local output status

  set +e
  output="$(run_release publish latest all 1.2.3 2>&1)"
  status=$?
  set -e

  if [[ "$status" -eq 0 ]]; then
    printf '指定精确版本发布 all 应失败，避免把不同包强行设成同一版本。\n' >&2
    exit 1
  fi

  assert_contains "$output" "指定版本只能用于单个发布目标"
  assert_log_not_contains "npm --prefix packages/core version 1.2.3 --no-git-tag-version"
}

# 验证单包发布的质量门禁限定在该包及其依赖链。
test_publish_checks_only_target_dependency_chain() {
  local output

  : >"$COMMAND_LOG"

  export MOCK_BRANCH="feature/demo"
  output="$(run_release publish alpha vant)"
  unset MOCK_BRANCH

  assert_contains "$output" "运行目标依赖链测试：vant"
  assert_contains "$output" "运行目标依赖链 lint：vant"
  assert_contains "$output" "构建目标依赖链发布产物：vant"
  assert_log_contains "pnpm --filter @schemx/vant... test"
  assert_log_contains "pnpm --filter @schemx/vant... lint"
  assert_log_contains "pnpm --filter @schemx/vant... build"
  assert_log_not_contains "pnpm test"
  assert_log_not_contains "pnpm lint"
  assert_log_not_contains "pnpm build"
  assert_log_contains "pnpm --dir packages/vant publish --access public --registry https://registry.npmjs.org/ --tag alpha --no-git-checks"
}

# 验证强制颜色环境变量能覆盖非 TTY 输出。
test_release_output_uses_colors_when_forced() {
  local output error_output status
  local cyan green yellow red bold

  cyan=$'\033[36m'
  green=$'\033[32m'
  yellow=$'\033[33m'
  red=$'\033[31m'
  bold=$'\033[1m'

  : >"$COMMAND_LOG"

  export MOCK_BRANCH="feature/demo"
  unset NO_COLOR
  export FORCE_COLOR=1
  output="$(run_release publish alpha core 2>&1)"
  unset FORCE_COLOR
  unset MOCK_BRANCH

  assert_contains "$output" "${cyan}◇"
  assert_contains "$output" "${bold}发布计划"
  assert_contains "$output" "发布 @schemx/core"
  assert_contains "$output" "${green}✓"
  assert_contains "$output" "@schemx/core@"
  assert_contains "$output" "可发布"
  assert_contains "$output" "${yellow}▲"
  assert_contains "$output" "如果 npm 要求网页登录、二维码确认或 OTP"

  export MOCK_BRANCH="feature/demo"
  unset NO_COLOR
  export FORCE_COLOR=1
  set +e
  error_output="$(run_release publish latest core current 2>&1)"
  status=$?
  set -e
  unset FORCE_COLOR
  unset MOCK_BRANCH

  if [[ "$status" -eq 0 ]]; then
    printf '非 main 分支正式发布应失败。\n' >&2
    exit 1
  fi

  assert_contains "$error_output" "${red}✖"
  assert_contains "$error_output" "正式发布只能在 main 分支执行。当前分支：feature/demo"
}

# 验证非 TTY 默认不输出 ANSI 转义字符。
test_release_output_omits_colors_without_tty() {
  local output

  : >"$COMMAND_LOG"

  export MOCK_BRANCH="feature/demo"
  export NO_COLOR=1
  export FORCE_COLOR=1
  output="$(run_release publish alpha core 2>&1)"
  unset NO_COLOR
  unset FORCE_COLOR
  unset MOCK_BRANCH

  assert_not_contains "$output" $'\033['
}

# 验证自动化可通过环境变量完成完整的交互选择链。
test_publish_without_args_uses_channel_target_and_version_env_selection() {
  local output

  : >"$COMMAND_LOG"

  output="$(SCHEMX_RELEASE_CHANNEL=latest SCHEMX_RELEASE_TARGET=core SCHEMX_RELEASE_VERSION_ACTION=current run_release publish)"

  assert_contains "$output" "发布计划"
  assert_contains "$output" "目标    core"
  assert_contains "$output" "通道    latest - 正式版发布"
  assert_contains "$output" "说明    发布到 npm latest，仅允许 main 分支。"
  assert_contains "$output" "版本    current - 使用当前版本"
  assert_occurrences "$output" "发布计划" 1
  assert_not_contains "$output" "==> 已选择"
  assert_not_contains "$output" "==> 本次发布选择"
  assert_not_contains "$output" "发布信息"
  assert_not_contains "$output" "----------------------------------------"
  assert_not_contains "$output" "发布模式：latest"
  assert_not_contains "$output" "输入序号或名称"
  assert_log_contains "pnpm --dir packages/core publish --access public --registry https://registry.npmjs.org/"
  assert_log_not_contains "pnpm --dir packages/vue publish"
}

# 验证选择器 stdout 只输出机器可消费的选项值。
test_selector_does_not_print_confirmation_line_after_enter() {
  local output status

  if ! command -v script >/dev/null 2>&1; then
    return
  fi

  set +e
  output="$(printf '\r' | script -q /dev/null node "$ROOT_DIR/scripts/select-release-option.mjs" --kind target --channel alpha all core 2>&1)"
  status=$?
  set -e

  if [[ "$status" -ne 0 ]]; then
    return
  fi

  assert_contains "$output" "all"
  assert_not_contains "$output" "请选择发布目标：all"
}

# 验证 latest 在 npm 发布后才创建并推送 Git tag。
test_latest_publish_tags_and_pushes_after_publish() {
  local version

  version="$(node -p "require('$ROOT_DIR/packages/core/package.json').version")"
  : >"$COMMAND_LOG"

  run_release publish latest core current

  assert_log_contains "pnpm --dir packages/core publish --access public --registry https://registry.npmjs.org/"
  assert_log_contains "git tag -a @schemx/core@${version} -m release: @schemx/core@${version}"
  assert_log_contains "git push origin main"
  assert_log_contains "git push origin @schemx/core@${version}"
  assert_log_contains "gh auth status"
  assert_log_contains "gh release create @schemx/core@${version} --repo Jiohon/schemx --title @schemx/core@${version} --notes-file"
}

# 验证多包 latest 为每个包创建独立 tag 与 GitHub Release。
test_latest_publish_all_creates_package_scoped_tags_and_releases() {
  local core_version vue_version vant_version

  core_version="$(node -p "require('$ROOT_DIR/packages/core/package.json').version")"
  vue_version="$(node -p "require('$ROOT_DIR/packages/vue/package.json').version")"
  vant_version="$(node -p "require('$ROOT_DIR/packages/vant/package.json').version")"
  : >"$COMMAND_LOG"

  run_release publish latest all current

  assert_log_contains "pnpm --dir packages/core publish --access public --registry https://registry.npmjs.org/"
  assert_log_contains "pnpm --dir packages/vue publish --access public --registry https://registry.npmjs.org/"
  assert_log_contains "pnpm --dir packages/vant publish --access public --registry https://registry.npmjs.org/"
  assert_log_contains "git tag -a @schemx/core@${core_version} -m release: @schemx/core@${core_version}"
  assert_log_contains "git tag -a @schemx/vue@${vue_version} -m release: @schemx/vue@${vue_version}"
  assert_log_contains "git tag -a @schemx/vant@${vant_version} -m release: @schemx/vant@${vant_version}"
  assert_log_contains "git push origin @schemx/core@${core_version}"
  assert_log_contains "git push origin @schemx/vue@${vue_version}"
  assert_log_contains "git push origin @schemx/vant@${vant_version}"
  assert_log_contains "gh release create @schemx/core@${core_version} --repo Jiohon/schemx --title @schemx/core@${core_version} --notes-file"
  assert_log_contains "gh release create @schemx/vue@${vue_version} --repo Jiohon/schemx --title @schemx/vue@${vue_version} --notes-file"
  assert_log_contains "gh release create @schemx/vant@${vant_version} --repo Jiohon/schemx --title @schemx/vant@${vant_version} --notes-file"
}

# 验证显式 Release notes 文件会覆盖默认的提交摘要。
test_latest_publish_uses_custom_release_notes_file() {
  local notes_file

  notes_file="$TMP_DIR/release-notes.md"
  printf '%s\n' '由发布人确认的更新说明。' >"$notes_file"
  : >"$COMMAND_LOG"

  MOCK_EXPECT_RELEASE_NOTE='由发布人确认的更新说明。' \
    SCHEMX_RELEASE_NOTES_FILE="$notes_file" \
    run_release publish latest core current >/dev/null

  assert_log_contains "gh release create @schemx/core@"
}

# 验证多包发布默认从各自包根目录读取 Release notes 文件。
test_latest_publish_uses_package_release_notes_files() {
  local core_notes vue_notes core_backup vue_backup
  local had_core_notes=0 had_vue_notes=0

  core_notes="$ROOT_DIR/packages/core/release-notes.md"
  vue_notes="$ROOT_DIR/packages/vue/release-notes.md"
  core_backup="$TMP_DIR/core-release-notes.backup"
  vue_backup="$TMP_DIR/vue-release-notes.backup"

  if [[ -e "$core_notes" ]]; then
    cp "$core_notes" "$core_backup"
    had_core_notes=1
  fi
  if [[ -e "$vue_notes" ]]; then
    cp "$vue_notes" "$vue_backup"
    had_vue_notes=1
  fi

  printf '%s\n' 'core 包专属发布说明。' >"$core_notes"
  printf '%s\n' 'vue 包专属发布说明。' >"$vue_notes"

  MOCK_EXPECT_RELEASE_NOTE='core 包专属发布说明。' \
    run_release publish latest core current >/dev/null
  MOCK_EXPECT_RELEASE_NOTE='vue 包专属发布说明。' \
    run_release publish latest vue current >/dev/null

  if [[ "$had_core_notes" -eq 1 ]]; then mv "$core_backup" "$core_notes"; else rm -f "$core_notes"; fi
  if [[ "$had_vue_notes" -eq 1 ]]; then mv "$vue_backup" "$vue_notes"; else rm -f "$vue_notes"; fi
}

# 验证外部生成器能接收包级发布上下文并将输出写入 Release notes。
test_latest_publish_uses_release_notes_generator() {
  local generator args_file

  generator="$TMP_DIR/release-notes-generator.sh"
  args_file="$TMP_DIR/release-notes-generator-args.txt"
  cat >"$generator" <<'GENERATOR'
#!/usr/bin/env bash
set -euo pipefail

printf '%s\n' "$*" >"${MOCK_GENERATOR_ARGS_FILE:?}"
printf '%s\n' '由 Agent 生成的包级变更摘要。'
GENERATOR
  chmod +x "$generator"
  : >"$COMMAND_LOG"

  MOCK_EXPECT_RELEASE_NOTE='由 Agent 生成的包级变更摘要。' \
    MOCK_GENERATOR_ARGS_FILE="$args_file" \
    SCHEMX_RELEASE_NOTES_GENERATOR="$generator" \
    run_release publish latest core current >/dev/null

  assert_contains "$(cat "$args_file")" "--package core"
  assert_contains "$(cat "$args_file")" "--previous-tag @schemx/core@0.1.22"
  assert_contains "$(cat "$args_file")" "--commit-range @schemx/core@0.1.22..HEAD"
}

# 验证自动化环境变量不能绕过目标白名单。
test_selector_rejects_unknown_environment_target() {
  local output status

  set +e
  output="$(SCHEMX_RELEASE_TARGET=unknown node "$ROOT_DIR/scripts/select-release-option.mjs" --kind target all core vue 2>&1)"
  status=$?
  set -e

  if [[ "$status" -eq 0 ]]; then
    printf '选择器应拒绝未知发布目标。\n' >&2
    exit 1
  fi

  assert_contains "$output" "未知发布目标"
}

# 验证非交互环境必须显式提供自动化选择值。
test_selector_requires_tty_or_automation_target() {
  local output status

  set +e
  output="$(node "$ROOT_DIR/scripts/select-release-option.mjs" --kind target all core vue 2>&1)"
  status=$?
  set -e

  if [[ "$status" -eq 0 ]]; then
    printf '非 TTY 且未设置自动化目标时，选择器应失败。\n' >&2
    exit 1
  fi

  assert_contains "$output" "不支持交互选择"
}

# 验证未知发布通道在选择器阶段即失败。
test_selector_rejects_unknown_channel() {
  local output status

  set +e
  output="$(SCHEMX_RELEASE_TARGET=core node "$ROOT_DIR/scripts/select-release-option.mjs" --kind target --channel unknown all core vue 2>&1)"
  status=$?
  set -e

  if [[ "$status" -eq 0 ]]; then
    printf '选择器应拒绝未知发布模式。\n' >&2
    exit 1
  fi

  assert_contains "$output" "未知发布模式"
}

# 验证允许 dev 等非 latest 通道通过选择器。
test_selector_accepts_dev_channel() {
  local output

  output="$(SCHEMX_RELEASE_TARGET=core node "$ROOT_DIR/scripts/select-release-option.mjs" --kind target --channel dev all core vue)"

  if [[ "$output" != "core" ]]; then
    printf 'dev 发布模式应允许自动化目标选择。\n实际输出：%s\n' "$output" >&2
    exit 1
  fi
}

# 验证环境变量可提供多个发布目标，并拒绝重复目标。
test_selector_accepts_multiple_environment_targets() {
  local output status

  output="$(SCHEMX_RELEASE_TARGET=vue,core node "$ROOT_DIR/scripts/select-release-option.mjs" --kind target all core vue)"
  if [[ "$output" != "vue,core" ]]; then
    printf '多目标环境变量应按输入返回。实际输出：%s\n' "$output" >&2
    exit 1
  fi

  set +e
  output="$(SCHEMX_RELEASE_TARGET=core,core node "$ROOT_DIR/scripts/select-release-option.mjs" --kind target all core vue 2>&1)"
  status=$?
  set -e
  if [[ "$status" -eq 0 ]]; then
    printf '选择器应拒绝重复发布目标。\n' >&2
    exit 1
  fi

  assert_contains "$output" "发布目标不能重复"
}

# 验证取消选择不会被 pnpm 视作 lifecycle 失败。
test_cancelled_selector_exits_without_lifecycle_failure() {
  local output status

  : >"$COMMAND_LOG"

  export MOCK_RELEASE_CANCEL=1
  set +e
  output="$(run_release publish 2>&1)"
  status=$?
  set -e
  unset MOCK_RELEASE_CANCEL

  if [[ "$status" -ne 0 ]]; then
    printf '取消发布目标选择应以 0 退出，避免 pnpm 输出 ELIFECYCLE。\n实际输出：\n%s\n' "$output" >&2
    exit 1
  fi

  assert_contains "$output" "已取消选择"
  assert_log_not_contains "pnpm --dir packages/core publish"
  assert_log_not_contains "pnpm --dir packages/vue publish"
}

# 从调用栈中获取当前测试函数名，用于统一测试报告。
release_test_name() {
  local name="$1"
  name="${name#test_}"
  printf '%s' "${name//_/ }"
}

# 获取毫秒时间戳，用于统计单个测试耗时。
now_ms() {
  node -e 'process.stdout.write(String(Date.now()))'
}

# 将毫秒耗时格式化为便于阅读的字符串。
format_duration() {
  local ms="$1"
  local centiseconds
  local seconds
  local fraction

  centiseconds=$(((ms + 5) / 10))
  seconds=$((centiseconds / 100))
  fraction=$((centiseconds % 100))

  if [[ "$fraction" -eq 0 ]]; then
    printf '%ss' "$seconds"
  elif [[ $((fraction % 10)) -eq 0 ]]; then
    printf '%s.%ss' "$seconds" "$((fraction / 10))"
  else
    printf '%s.%02ds' "$seconds" "$fraction"
  fi
}

# 执行一个测试函数并输出通过/失败与耗时；失败不阻断后续测试。
run_release_test() {
  local index="$1"
  local total="$2"
  local test_name="$3"
  local label
  local started_at
  local elapsed

  label="$(release_test_name "$test_name")"
  started_at="$(now_ms)"
  node "$ROOT_DIR/scripts/terminal.mjs" section "release:test [$index/$total] $label" >&2
  "$test_name"
  elapsed=$(($(now_ms) - started_at))
  printf '✓ release:test [%02d/%02d] SUCCESS %s (%s)\n' "$index" "$total" "$label" "$(format_duration "$elapsed")" >&2
}

RELEASE_TESTS=(
  test_help_lists_channel_commands_without_package_shortcuts
  test_package_scripts_keep_single_publish_entry
  test_root_scripts_use_bare_commands
  test_pack_local_helper_creates_timestamped_versions
  test_pack_local_creates_install_command_from_tarballs
  test_plugin_pack_reports_generated_tarball_path
  test_pack_local_does_not_keep_manual_tarball_analysis
  test_terminal_section_uses_shared_separator
  test_release_test_uses_shared_separator
  test_run_with_targets_separates_each_target
  test_release_channel_choices_put_latest_last
  test_custom_version_uses_clack_prompt
  test_next_stable_version_calculates_without_mutating_files
  test_version_availability_uses_explicit_candidate
  test_version_availability_rejects_registry_lookup_error
  test_release_markers_accept_available_candidate
  test_release_markers_reject_local_tag
  test_release_markers_reject_remote_tag
  test_release_markers_reject_github_release
  test_release_markers_reject_remote_lookup_error
  test_release_markers_reject_github_lookup_error
  test_release_test_runs_only_release_script_tests
  test_release_check_uses_package_dependency_chain
  test_latest_publish_is_main_only
  test_publish_without_npm_auth_shows_clear_message
  test_publish_accepts_npm_token_auth
  test_publish_without_github_auth_stops_before_publish
  test_publish_existing_version_suggests_release_version
  test_alpha_publish_uses_alpha_tag_and_restores_version
  test_publish_checks_only_target_dependency_chain
  test_release_output_uses_colors_when_forced
  test_release_output_omits_colors_without_tty
  test_pack_accepts_target
  test_publish_accepts_multiple_targets
  test_latest_publish_patch_bumps_commits_and_publishes_target
  test_latest_quality_failure_stops_before_version_transaction
  test_prerelease_quality_failure_stops_before_temporary_version
  test_latest_lockfile_failure_rolls_back_version_files
  test_latest_commit_failure_rolls_back_version_files
  test_multi_package_publish_failure_reports_partial_result
  test_latest_publish_patch_all_bumps_and_commits_all_packages
  test_latest_publish_explicit_version_requires_single_target
  test_publish_without_args_uses_channel_target_and_version_env_selection
  test_selector_does_not_print_confirmation_line_after_enter
  test_latest_publish_tags_and_pushes_after_publish
  test_latest_publish_all_creates_package_scoped_tags_and_releases
  test_latest_publish_uses_custom_release_notes_file
  test_latest_publish_uses_package_release_notes_files
  test_latest_publish_uses_release_notes_generator
  test_selector_rejects_unknown_environment_target
  test_selector_requires_tty_or_automation_target
  test_selector_rejects_unknown_channel
  test_selector_accepts_dev_channel
  test_selector_accepts_multiple_environment_targets
  test_cancelled_selector_exits_without_lifecycle_failure
)

total_release_tests="${#RELEASE_TESTS[@]}"
release_tests_started_at="$(now_ms)"
for i in "${!RELEASE_TESTS[@]}"; do
  run_release_test "$((i + 1))" "$total_release_tests" "${RELEASE_TESTS[$i]}"
done

release_tests_elapsed=$(($(now_ms) - release_tests_started_at))
printf '\n✓ release:test SUCCESS %d/%d passed (%s)\n' "$total_release_tests" "$total_release_tests" "$(format_duration "$release_tests_elapsed")"
