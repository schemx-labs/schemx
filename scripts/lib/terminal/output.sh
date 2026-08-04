#!/usr/bin/env bash

# UI 输出目标、格式和终端能力；仅供 scripts/lib/ui.sh 内部使用。

set -o pipefail

_ui_write_stderr() {
  if [[ $# -eq 0 ]]; then
    printf '\n' >&2
  else
    printf '%s\n' "$*" >&2
  fi
}

_ui_write_stdout() {
  if [[ $# -eq 0 ]]; then
    printf '\n'
  else
    printf '%s\n' "$*"
  fi
}

# UI 块之间的布局状态。流程内使用共享临时文件，让 `ui_prompt` 这类
# 通过命令替换执行的 API 也能把“已有输出”状态传回父 Shell。
_ui_layout_state() {
  local state
  if [[ -n "${SCHEMX_UI_LAYOUT_STATE_FILE:-}" && -r "$SCHEMX_UI_LAYOUT_STATE_FILE" ]]; then
    IFS= read -r state < "$SCHEMX_UI_LAYOUT_STATE_FILE" || state=''
    [[ "$state" == true ]]
  else
    [[ "${_UI_LAYOUT_HAS_OUTPUT:-false}" == true ]]
  fi
}

_ui_layout_before() {
  if _ui_layout_state; then
    _ui_layout_gap
  fi
  return 0
}

_ui_layout_gap() {
  if _ui_can_style; then
    local rail="$(_ui_symbol rail rail)" || return
    printf '%s\n' "$rail" >&2
  else
    printf '│\n' >&2
  fi
}

_ui_layout_mark() {
  _UI_LAYOUT_HAS_OUTPUT=true
  if [[ -n "${SCHEMX_UI_LAYOUT_STATE_FILE:-}" ]]; then
    printf 'true\n' > "$SCHEMX_UI_LAYOUT_STATE_FILE" 2>/dev/null || true
  fi
}

_ui_layout_begin_flow() {
  local previous_state=false
  _ui_layout_state && previous_state=true
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
    _ui_layout_gap
  fi
  return 0
}

_ui_layout_end_flow() {
  local state_file="${SCHEMX_UI_LAYOUT_STATE_FILE:-}"
  if [[ -n "$state_file" ]]; then
    rm -f "$state_file"
    unset SCHEMX_UI_LAYOUT_STATE_FILE
  fi
}

# 原生命令的 stdout/stderr 与 UI 分属不同流；任务完成状态前固定补两条导轨间隔行，
# 无输出时也保持稳定的任务块边界。
_ui_layout_native_boundary() {
  _ui_layout_gap
  _ui_layout_gap
}

_ui_format() {
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
      _ui_write_stderr "未知 SCHEMX_UI_FORMAT：${SCHEMX_UI_FORMAT}（可选 auto、pretty、plain）"
      return 2
      ;;
  esac
}

_ui_can_style() {
  [[ "$(_ui_format)" == 'pretty' ]] && command -v gum >/dev/null 2>&1
}

_ui_is_interactive() {
  [[ "${CI:-}" != 'true' && -t 2 && ( -t 0 || ( -r /dev/tty && -w /dev/tty ) ) ]]
}

_ui_can_spinner() {
  _ui_can_style && _ui_is_interactive
}
