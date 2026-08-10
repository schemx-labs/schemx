#!/usr/bin/env bash

# 新发布流程入口。当前提供安全的 plan / dry-run 纵切，不调用旧发布脚本。

set -euo pipefail

workflow_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
cd "$workflow_root"

source "$workflow_root/scripts/workflow/domains/release/targets.sh"
source "$workflow_root/scripts/workflow/domains/release/versions.sh"
source "$workflow_root/scripts/workflow/domains/release/plan.sh"
source "$workflow_root/scripts/workflow/domains/release/preflight.sh"
source "$workflow_root/scripts/workflow/domains/release/quality.sh"
source "$workflow_root/scripts/workflow/domains/release/artifacts.sh"
source "$workflow_root/scripts/workflow/domains/release/publish.sh"
source "$workflow_root/scripts/workflow/domains/release/git.sh"
source "$workflow_root/scripts/workflow/domains/release/github.sh"
source "$workflow_root/scripts/workflow/domains/release/notes.sh"
source "$workflow_root/scripts/workflow/domains/release/tests.sh"
source "$workflow_root/scripts/workflow/ui/api.sh"
source "$workflow_root/scripts/workflow/domains/release/feedback.sh"
source "$workflow_root/scripts/workflow/domains/release/inputs.sh"
source "$workflow_root/scripts/workflow/commands/release/planning.sh"
source "$workflow_root/scripts/workflow/commands/release/operations.sh"
source "$workflow_root/scripts/workflow/commands/release/check.sh"
source "$workflow_root/scripts/workflow/commands/release/pack.sh"
source "$workflow_root/scripts/workflow/commands/release/publish.sh"
source "$workflow_root/scripts/workflow/commands/release/execute.sh"
source "$workflow_root/scripts/workflow/commands/release/test.sh"

# 输出新流程的安全入口帮助。
release_usage() {
  cat <<'USAGE'
用法：
  bash scripts/workflow.sh release plan <channel> <target> <version-action> [--output <file>]
  bash scripts/workflow.sh release dry-run <channel> <target> <version-action>
  bash scripts/workflow.sh release publish [channel] [target] [version-action]
  bash scripts/workflow.sh release check [channel] [target] [version-action] [--keep-going]
  bash scripts/workflow.sh release pack [target] [--keep-going]
  bash scripts/workflow.sh release test
  bash scripts/workflow.sh release verify <plan-file> [--keep-going]
  bash scripts/workflow.sh release execute <plan-file>

channel：dev、alpha、beta、rc、next、latest
target：all、core、vue、vant，或以英文逗号分隔的多个包
version-action：patch、minor、major、current（仅 latest）或精确 x.y.z
USAGE
}

# 解析 check / pack 命令的可选发布目标，并始终返回固定的包顺序。
release_resolve_target() {
  local target="${1:-all}"

  targets_resolve "$target" || {
    ui_status error "无效发布目标：${target}"
    return 2
  }
}

# 解析有限 release 命令共用的 --keep-going，并保留原位置参数顺序。
# 参数：待解析的 release 子命令参数。
# 返回：成功时写入 RELEASE_POSITIONAL 和 RELEASE_KEEP_GOING；未知选项返回 2。
release_parse_keep_going() {
  RELEASE_POSITIONAL=()
  RELEASE_KEEP_GOING=false
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --keep-going) RELEASE_KEEP_GOING=true ;;
      -*) ui_status error "未知 release 选项：$1"; return 2 ;;
      *) RELEASE_POSITIONAL+=("$1") ;;
    esac
    shift
  done
}


# 解析 CLI 并执行发布计划或按冻结计划推进工作流。
release_main() {
  # 子命令。
  local command="${1:-help}"
  # 计划输出路径。
  local plan_file=''
  # 用于校验不支持 keep-going 的子命令参数。
  local argument
  shift || true

  case "$command" in
    plan | dry-run)
      [[ $# -ge 3 ]] || { release_usage; return 2; }
      local channel="$1"
      local target="$2"
      local version_action="$3"
      shift 3
      if [[ "${1:-}" == '--output' ]]; then
        plan_file="${2:-}"
        [[ -n "$plan_file" ]] || return 2
      fi
      ui_flow_begin --domain release --title '生成发布计划' --description '生成并冻结版本计划；不会执行发布写操作。' || return
      if [[ -z "$plan_file" ]]; then
        plan_file="$(mktemp "${TMPDIR:-/tmp}/schemx-release-plan.XXXXXX")" || {
          ui_flow_end failed '无法创建发布计划文件。'
          return 1
        }
      fi
      release_create_plan "$channel" "$target" "$version_action" "$plan_file" || {
        local exit_code=$?
        [[ "$exit_code" -eq 130 ]] && ui_flow_end cancelled '发布计划创建已取消。' || ui_flow_end failed '发布计划创建失败。'
        return "$exit_code"
      }
      release_render_plan "$plan_file" || {
        local exit_code=$?
        ui_flow_end failed '发布计划展示失败。'
        return "$exit_code"
      }
      if [[ "$command" == 'dry-run' ]]; then
        ui_status success 'dry-run 已完成：未执行质量检查、npm 发布、Git Tag 或 GitHub Release。'
      fi
      ui_flow_end success "${command} 完成。"
      printf '%s\n' "$plan_file"
      ;;
    publish)
      for argument in "$@"; do
        [[ "$argument" != --keep-going ]] || { release_usage; return 2; }
      done
      release_publish "$@"
      ;;
    check)
      release_parse_keep_going "$@" || return
      [[ "${#RELEASE_POSITIONAL[@]}" -le 3 ]] || { release_usage; return 2; }
      release_check "${RELEASE_POSITIONAL[0]:-}" "${RELEASE_POSITIONAL[1]:-}" "${RELEASE_POSITIONAL[2]:-}" "$RELEASE_KEEP_GOING"
      ;;
    pack)
      release_parse_keep_going "$@" || return
      [[ "${#RELEASE_POSITIONAL[@]}" -le 1 ]] || { release_usage; return 2; }
      release_pack "${RELEASE_POSITIONAL[0]:-all}" "$RELEASE_KEEP_GOING"
      ;;
    test)
      [[ $# -eq 0 ]] || { release_usage; return 2; }
      release_test
      ;;
    verify)
      release_parse_keep_going "$@" || return
      [[ "${#RELEASE_POSITIONAL[@]}" -eq 1 ]] || { release_usage; return 2; }
      ui_flow_begin --domain release --title '验证发布计划' --description '读取冻结计划并执行发布前检查。' || return
      release_verify_plan "${RELEASE_POSITIONAL[0]}" "$RELEASE_KEEP_GOING" || {
        local exit_code=$?
        [[ "$exit_code" -eq 130 ]] && ui_flow_end cancelled '发布计划验证已取消。' || ui_flow_end failed '发布计划验证失败。'
        return "$exit_code"
      }
      ui_flow_end success '发布计划验证完成。'
      ;;
    execute)
      [[ $# -eq 1 && "$1" != --keep-going ]] || { release_usage; return 2; }
      ui_flow_begin --domain release --title '执行发布' --description '消费冻结计划并执行发布步骤。' || return
      release_execute_plan "$1" || {
        local exit_code=$?
        [[ "$exit_code" -eq 130 ]] && ui_flow_end cancelled '发布流程已取消。' || ui_flow_end failed '发布流程失败。'
        return "$exit_code"
      }
      ;;
    help | -h | --help)
      release_usage
      ;;
    *)
      release_usage
      return 2
      ;;
  esac
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  release_main "$@"
fi
