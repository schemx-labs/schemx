#!/usr/bin/env bash

# 可复制摘要公共 API；摘要保持视觉层次，复制内容保持单行原始文本。

set -o pipefail

# 渲染结构化摘要后输出可直接复制的单行内容。
# Arguments: 支持 --title、--tone neutral|success|warning|error、--content 和 --copy。
# Returns: 参数合法且摘要、间隔、原始内容和事件均写入成功时返回 0，否则返回非 0。
# Side effects: 写入 stderr、布局状态和可选 JSONL 事件；--copy 不会写入系统剪贴板。
# 备注：复制内容前固定输出两条标准导轨间隔；内容本身不附加边框、前缀、颜色或硬换行。
ui_copyable_summary() {
  local title=''
  local tone=neutral
  local content=''
  local copy_value=''

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --title) title="${2:-}"; shift 2 ;;
      --tone) tone="${2:-}"; shift 2 ;;
      --content) content="${2:-}"; shift 2 ;;
      --copy) copy_value="${2:-}"; shift 2 ;;
      *) ui__write_stderr 'ui_copyable_summary 用法错误：支持 --title、--tone、--content、--copy。'; return 2 ;;
    esac
  done

  [[ -n "$title" && -n "$content" && -n "$copy_value" ]] || {
    ui__write_stderr 'ui_copyable_summary 用法错误：必须提供 --title、--content、--copy。'
    return 2
  }
  case "$tone" in neutral|success|warning|error) ;; *) ui__write_stderr "未知摘要色调：${tone}"; return 2 ;; esac
  [[ "$copy_value" != *$'\n'* ]] || {
    ui__write_stderr 'ui_copyable_summary 用法错误：--copy 必须是单行内容。'
    return 2
  }

  ui__layout_before
  ui__render_summary "$title" "$tone" "$content" || return
  ui__layout_mark
  ui__layout_gap || return
  ui__layout_gap || return
  ui__write_stderr "$copy_value" || return
  ui__layout_mark
  ui__event summary "$(jq -cn \
    --arg title "$title" \
    --arg tone "$tone" \
    --arg content "$content" \
    --arg copy "$copy_value" \
    '{title:$title,tone:$tone,content:$content,copyable:true,copy:$copy}')"
}
