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

# 输出一条主题化的导轨间隔行，plain 模式使用稳定的 Unicode 导轨。
# 返回：输出成功时返回 0，否则返回底层 Gum 或 printf 错误码。
ui__layout_gap() {
  if ui__can_style; then
    local rail="$(ui__symbol rail rail)" || return
    printf '%s\n' "$rail" >&2
  else
    printf '│\n' >&2
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
  local previous_state=false
  ui__layout_state && previous_state=true
  if [[ -n "${SCHEMX_UI_LAYOUT_STATE_FILE:-}" ]]; then
    rm -f "$SCHEMX_UI_LAYOUT_STATE_FILE"
    unset SCHEMX_UI_LAYOUT_STATE_FILE
  fi
  local state_file
  state_file="$(mktemp "${TMPDIR:-/tmp}/schemx-ui-layout.XXXXXX")" || return 1
  printf 'false\n' > "$state_file" || { rm -f "$state_file"; return 1; }
  export SCHEMX_UI_LAYOUT_STATE_FILE="$state_file"
  _UI_LAYOUT_HAS_OUTPUT=false
  if [[ "$previous_state" == true ]]; then
    ui__layout_gap
  fi
  return 0
}

# 删除流程布局状态文件并清理子进程继承的解析格式变量。
# 返回：始终返回 0。
ui__layout_end_flow() {
  local state_file="${SCHEMX_UI_LAYOUT_STATE_FILE:-}"
  if [[ -n "$state_file" ]]; then
    rm -f "$state_file"
    unset SCHEMX_UI_LAYOUT_STATE_FILE
  fi
  unset SCHEMX_UI_RESOLVED_FORMAT
}

# 原生命令的 stdout/stderr 与 UI 分属不同流；任务完成状态前固定补两条导轨间隔行，
# 无输出时也保持稳定的任务块边界。
# 在原生命令日志和任务结束状态之间输出固定的两条间隔行。
# 返回：两条间隔行均尝试输出后的最后一个退出码。
ui__layout_native_boundary() {
  ui__layout_gap
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
