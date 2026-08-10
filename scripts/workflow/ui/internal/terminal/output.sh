#!/usr/bin/env bash

# UI 输出目标、格式和终端能力；仅供 scripts/workflow/ui/api.sh 内部使用。

set -o pipefail

# 将一行或空行写入 stderr，作为所有 UI 反馈的基础输出通道。
# 参数：无参数时写入空行，否则将全部参数按一个字符串写入 stderr。
# 返回：printf 的退出码。
ui__write_stderr() {
  if [[ $# -eq 0 ]]; then
    printf '\n' >&2
  else
    printf '%s\n' "$*" >&2
  fi
}

# 将一行或空行写入 stdout，供交互结果和机器消费调用方读取。
# 参数：无参数时写入空行，否则将全部参数按一个字符串写入 stdout。
# 返回：printf 的退出码。
ui__write_stdout() {
  if [[ $# -eq 0 ]]; then
    printf '\n'
  else
    printf '%s\n' "$*"
  fi
}

# 返回当前 UI 元素所在的 group 内容深度；子进程使用父 Shell 导出的深度。
ui__group_depth() {
  local depth="${SCHEMX_UI_GROUP_DEPTH:-0}"
  [[ "$depth" =~ ^[0-9]+$ ]] || depth=0
  printf '%s' "$depth"
}

# 确保当前 Shell 与其子进程共享一个 workflow run ID。
ui__ensure_run_id() {
  if [[ -z "${SCHEMX_UI_RUN_ID:-}" ]]; then
    SCHEMX_UI_RUN_ID="run-$$-$(perl -MTime::HiRes=time -e 'printf "%.6f", time' | tr . -)-$RANDOM"
    export SCHEMX_UI_RUN_ID
  fi
}

# UI 块之间的布局状态。流程内使用共享临时文件，让 `ui_prompt` 这类
# 通过命令替换执行的 API 也能把“已有输出”状态传回父 Shell。
# 读取当前流程是否已经产生过 UI 输出的共享状态。
# 返回：状态为 true 时返回 0，否则返回非 0。
ui__layout_state() {
  local state
  if [[ -n "${SCHEMX_UI_LAYOUT_STATE_FILE:-}" && -r "$SCHEMX_UI_LAYOUT_STATE_FILE" ]]; then
    IFS= read -r state < "$SCHEMX_UI_LAYOUT_STATE_FILE" || state=''
    [[ "$state" == true ]]
  else
    [[ "${_UI_LAYOUT_HAS_OUTPUT:-false}" == true ]]
  fi
}

# 在即将输出新的 UI 块时，按既有状态补一条标准间隔行。
# 返回：始终返回 0；布局间隔本身的失败由底层输出函数体现。
ui__layout_before() {
  if ui__layout_state; then
    ui__layout_gap
  fi
  return 0
}

# 在即将输出任务块时，按既有状态补两条标准间隔行。
# 相邻目录任务的标题需要与上一任务的完成状态保持更明显的视觉边界。
# 返回：始终返回 0；布局间隔本身的失败由底层输出函数体现。
ui__layout_before_task() {
  if ui__layout_state; then
    ui__layout_gap
    ui__layout_gap
  fi
  return 0
}

# 输出一条主题化的导轨间隔行，plain 模式使用稳定的 Unicode 导轨。
# 返回：输出成功时返回 0，否则返回底层 Gum 或 printf 错误码。
ui__layout_gap() {
  local depth
  local indent=''
  depth="$(ui__group_depth)" || return
  printf -v indent '%*s' "$((depth * 2))" ''
  if ui__can_style; then
    local rail="$(ui__symbol rail rail)" || return
    printf '%s%s\n' "$indent" "$rail" >&2
  else
    printf '%s│\n' "$indent" >&2
  fi
}

# 标记当前流程已经产生输出，并同步给命令替换或子进程共享的状态文件。
# 返回：状态写入完成后返回 0；状态文件不可写时仍保持兼容并返回 0。
ui__layout_mark() {
  _UI_LAYOUT_HAS_OUTPUT=true
  if [[ -n "${SCHEMX_UI_LAYOUT_STATE_FILE:-}" ]]; then
    printf 'true\n' > "$SCHEMX_UI_LAYOUT_STATE_FILE" 2>/dev/null || true
  fi
}

# 初始化一个流程的布局状态文件，并清理上一个流程遗留的状态文件。
# 返回：成功时返回 0；临时文件创建或初始化失败时返回 1。
ui__layout_begin_flow() {
  if [[ "${_UI_FLOW_ACTIVE:-false}" == true || -n "${SCHEMX_UI_LAYOUT_STATE_FILE:-}" ]]; then
    ui__write_stderr '已有活动 UI 流程，不能开始嵌套流程。'
    return 2
  fi
  local state_file
  state_file="$(mktemp "${TMPDIR:-/tmp}/schemx-ui-layout.XXXXXX")" || return 1
  printf 'false\n' > "$state_file" || { rm -f "$state_file"; return 1; }
  export SCHEMX_UI_LAYOUT_STATE_FILE="$state_file"
  _UI_LAYOUT_OWNED_STATE_FILE="$state_file"
  _UI_LAYOUT_HAS_OUTPUT=false
  return 0
}

# 删除流程布局状态文件并清理子进程继承的解析格式变量。
# 返回：始终返回 0。
ui__layout_end_flow() {
  local state_file="${SCHEMX_UI_LAYOUT_STATE_FILE:-}"
  if [[ -n "$state_file" && "$state_file" == "${_UI_LAYOUT_OWNED_STATE_FILE:-}" ]]; then
    rm -f "$state_file"
  fi
  unset _UI_LAYOUT_OWNED_STATE_FILE
  unset SCHEMX_UI_LAYOUT_STATE_FILE
  unset SCHEMX_UI_RESOLVED_FORMAT
}

# 清理当前 Shell 创建的流程布局文件；允许在 EXIT trap 中重复调用。
ui__flow_cleanup() {
  if [[ -n "${_UI_TASK_OUTPUT_FILE:-}" ]]; then
    rm -f "$_UI_TASK_OUTPUT_FILE"
    unset _UI_TASK_OUTPUT_FILE
  fi
  if declare -F ui__group_reset >/dev/null 2>&1; then
    ui__group_reset
  fi
  ui__layout_end_flow
  unset SCHEMX_UI_FLOW_ID
  _UI_FLOW_ACTIVE=false
}

# 在不覆盖调用方既有 trap 的前提下注册流程清理。
ui__flow_install_cleanup_traps() {
  _UI_PREVIOUS_EXIT_TRAP="$(trap -p EXIT)"
  _UI_PREVIOUS_INT_TRAP="$(trap -p INT)"
  _UI_PREVIOUS_TERM_TRAP="$(trap -p TERM)"
  trap 'ui__flow_exit_handler $?' EXIT
  trap 'ui__flow_signal_handler INT' INT
  trap 'ui__flow_signal_handler TERM' TERM
}

# 正常结束流程时恢复调用方原有的 trap。
ui__flow_restore_cleanup_traps() {
  trap - EXIT INT TERM
  if [[ -n "${_UI_PREVIOUS_EXIT_TRAP:-}" ]]; then
    eval "$_UI_PREVIOUS_EXIT_TRAP"
  fi
  if [[ -n "${_UI_PREVIOUS_INT_TRAP:-}" ]]; then
    eval "$_UI_PREVIOUS_INT_TRAP"
  fi
  if [[ -n "${_UI_PREVIOUS_TERM_TRAP:-}" ]]; then
    eval "$_UI_PREVIOUS_TERM_TRAP"
  fi
  unset _UI_PREVIOUS_EXIT_TRAP _UI_PREVIOUS_INT_TRAP _UI_PREVIOUS_TERM_TRAP
}

# 执行 trap -p 保存的原始 handler。该内容来自 Bash 自身，不接受外部输入。
ui__flow_run_previous_trap() {
  local signal="$1"
  local previous_trap=''
  case "$signal" in
    EXIT) previous_trap="${_UI_PREVIOUS_EXIT_TRAP:-}" ;;
    INT) previous_trap="${_UI_PREVIOUS_INT_TRAP:-}" ;;
    TERM) previous_trap="${_UI_PREVIOUS_TERM_TRAP:-}" ;;
    *) return 2 ;;
  esac
  [[ -n "$previous_trap" ]] || return 0
  local handler
  eval "set -- ${previous_trap#trap -- }"
  handler="$1"
  eval "$handler"
}

# 异常退出时先补齐活动 flow 的失败事件并清理 UI，再重新触发调用方原有 EXIT trap。
ui__flow_exit_handler() {
  local exit_code="$1"
  if [[ "${_UI_FLOW_ACTIVE:-false}" == true ]] && declare -F ui__flow_finish_implicit >/dev/null 2>&1; then
    ui__flow_finish_implicit failed '流程未显式结束。' "$exit_code" || true
  fi
  ui__flow_cleanup
  trap - EXIT INT TERM
  ui__flow_run_previous_trap EXIT
  exit "$exit_code"
}

# 信号到达时先补齐取消事件并释放 UI 资源，再执行调用方 handler 并返回约定退出码。
ui__flow_signal_handler() {
  local signal="$1"
  local exit_code=130
  [[ "$signal" != TERM ]] || exit_code=143
  if [[ "${_UI_FLOW_ACTIVE:-false}" == true ]] && declare -F ui__flow_finish_implicit >/dev/null 2>&1; then
    ui__flow_finish_implicit cancelled "流程收到 ${signal} 信号。" "$exit_code" || true
  fi
  ui__flow_cleanup
  trap - "$signal"
  ui__flow_run_previous_trap "$signal"
  trap - EXIT
  if [[ -n "${_UI_PREVIOUS_EXIT_TRAP:-}" ]]; then
    eval "$_UI_PREVIOUS_EXIT_TRAP"
  fi
  exit "$exit_code"
}

# 原生命令的 stdout/stderr 与 UI 分属不同流；任务完成状态前补一条导轨间隔行，
# 使任务日志与其结果保持同一内容模块内的稳定边界。
# 在原生命令日志和任务结束状态之间输出一条间隔行。
# 返回：间隔行输出的退出码。
ui__layout_native_boundary() {
  ui__layout_gap
}

# 解析当前 UI 输出格式，并优先使用顶层流程传递的 resolved format。
# 返回：输出 pretty 或 plain；配置非法时返回 2。
ui__format() {
  case "${SCHEMX_UI_RESOLVED_FORMAT:-}" in
    pretty | plain)
      printf '%s' "$SCHEMX_UI_RESOLVED_FORMAT"
      return
      ;;
    '')
      ;;
    *)
      ui__write_stderr "未知 SCHEMX_UI_RESOLVED_FORMAT：${SCHEMX_UI_RESOLVED_FORMAT}"
      return 2
      ;;
  esac
  case "${SCHEMX_UI_FORMAT:-auto}" in
    auto)
      if [[ "${CI:-}" != 'true' && -t 2 ]]; then
        printf 'pretty'
      else
        printf 'plain'
      fi
      ;;
    pretty | plain)
      printf '%s' "${SCHEMX_UI_FORMAT}"
      ;;
    *)
      ui__write_stderr "未知 SCHEMX_UI_FORMAT：${SCHEMX_UI_FORMAT}（可选 auto、pretty、plain）"
      return 2
      ;;
  esac
}

# 判断当前格式为 pretty 且 Gum 命令可用。
# 返回：可以使用 Gum 样式时返回 0，否则返回非 0。
ui__can_style() {
  [[ "$(ui__format)" == 'pretty' ]] && command -v gum >/dev/null 2>&1
}

# 判断当前环境是否允许 Clack 读取交互输入。
# 返回：非 CI 且 stdin/stderr 或 /dev/tty 可用时返回 0，否则返回非 0。
ui__is_interactive() {
  [[ "${CI:-}" != 'true' && -t 2 && ( -t 0 || ( -r /dev/tty && -w /dev/tty ) ) ]]
}

# 判断当前环境是否同时满足样式和交互要求，可以启动 spinner。
# 返回：可以启动时返回 0，否则返回非 0。
ui__can_spinner() {
  ui__can_style && ui__is_interactive
}
