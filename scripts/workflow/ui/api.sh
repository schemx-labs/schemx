#!/usr/bin/env bash

# UI 公共 API。
#
# 公开函数：ui_flow_begin、ui_group_begin、ui_group_end、ui_group_run、ui_flow_end、ui_flow_cleanup、
# ui_note、ui_status、ui_summary、ui_copyable_summary、ui_prompt、ui_task、ui_task_skip、ui_service、
# ui_is_interactive、ui_can_spinner。
# 内部函数：仅由 ui/internal/ 使用的 ui__* 实现细节。

# 保持 source 失败可被调用方观察到。
set -o pipefail

# UI 根目录，用于加载公开 API 的内部实现。
ui__root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$ui__root/internal/terminal/output.sh" || return
source "$ui__root/internal/terminal/theme.sh" || return
source "$ui__root/internal/terminal/layout.sh" || return
source "$ui__root/internal/terminal/events.sh" || return
source "$ui__root/internal/terminal/feedback.sh" || return
source "$ui__root/internal/terminal/copyable-summary.sh" || return
source "$ui__root/internal/interaction/clack.sh" || return
source "$ui__root/internal/interaction/choose.sh" || return
source "$ui__root/internal/task/feedback.sh" || return
source "$ui__root/internal/task/arguments.sh" || return
source "$ui__root/internal/task/execution.sh" || return
source "$ui__root/internal/task/lifecycle.sh" || return

# 判断当前进程是否具备可交互的终端输入输出。
# 返回：具备 TTY 且未处于 CI 时返回 0，否则返回非 0。
ui_is_interactive() {
  ui__is_interactive
}

# 判断当前环境是否可以安全显示 Gum spinner。
# 返回：UI 已解析为 pretty、Gum 可用且终端可交互时返回 0，否则返回非 0。
ui_can_spinner() {
  ui__can_spinner
}

# 在调用方的异常清理中释放当前 flow 持有的 UI 资源。
ui_flow_cleanup() {
  ui__flow_cleanup
}
