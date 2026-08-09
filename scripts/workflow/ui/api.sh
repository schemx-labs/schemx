#!/usr/bin/env bash

# UI 公共 API。
#
# 公开函数：ui_flow_begin、ui_flow_group、ui_flow_end、ui_note、ui_status、ui_summary、
# ui_copyable_summary、ui_prompt、ui_task、ui_service、ui_is_interactive、ui_can_spinner。
# 内部函数：仅由 ui/internal/ 使用的 ui__* 实现细节。

# 保持 source 失败可被调用方观察到。
set -o pipefail

# UI 根目录，用于加载公开 API 的内部实现。
ui__root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$ui__root/internal/terminal/output.sh"
source "$ui__root/internal/terminal/theme.sh"
source "$ui__root/internal/terminal/layout.sh"
source "$ui__root/internal/terminal/events.sh"
source "$ui__root/internal/terminal/feedback.sh"
source "$ui__root/internal/terminal/copyable-summary.sh"
source "$ui__root/internal/interaction/clack.sh"
source "$ui__root/internal/interaction/choose.sh"
source "$ui__root/internal/task/feedback.sh"
source "$ui__root/internal/task/arguments.sh"
source "$ui__root/internal/task/execution.sh"
source "$ui__root/internal/task/lifecycle.sh"

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
