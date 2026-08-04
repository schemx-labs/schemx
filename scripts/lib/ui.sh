#!/usr/bin/env bash

# Shell 工作流 UI 唯一入口。

set -o pipefail
_ui_root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$_ui_root/terminal/output.sh"
source "$_ui_root/terminal/theme.sh"
source "$_ui_root/terminal/layout.sh"
source "$_ui_root/terminal/events.sh"
source "$_ui_root/terminal/feedback.sh"
source "$_ui_root/interaction/clack.sh"
source "$_ui_root/interaction/choose.sh"
source "$_ui_root/task/feedback.sh"
source "$_ui_root/task/lifecycle.sh"
