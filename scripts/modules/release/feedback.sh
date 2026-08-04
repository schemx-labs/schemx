#!/usr/bin/env bash

# Release 专属计划与结果反馈；通用终端组件由 scripts/lib/ui.sh 提供。

release_feedback_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
source "$release_feedback_root/scripts/lib/ui.sh"

release_plan_text() {
  local file="$1"

  jq -er '
    def value: if . == null or . == "" then "-" else . end;
    . as $plan |
    [
      "通道：\($plan.channel | value)",
      "目标：\($plan.target | value)",
      "版本动作：\($plan.versionAction | value)",
      "版本基线：\($plan.baselineVersion | value)",
      "npm tag：\($plan.distTag | value)"
    ] | join("\n")
    + if ($plan.packages | length) > 0 then
        "\n\n发布包\n" + ([$plan.packages[] | "\(.name | value)\n  \(if .currentVersion then .currentVersion + " → " else "" end)\(.version | value)"] | join("\n"))
      else "" end
  ' "$file"
}

release_render_plan() {
  local file="$1"
  local content

  if ! content="$(release_plan_text "$file")"; then
    ui_status error "无法读取发布计划：${file}"
    return 1
  fi
  ui_summary --title '发布计划' --tone neutral --content "$content"
}

release_summary_text() {
  local file="$1"
  jq -er '
    "发布完成\n" + ([.packages[] | "\(.name // "-")  ✓ \(.version // "-")"] | join("\n"))
  ' "$file"
}

release_render_outcome() {
  local file="$1"
  local content

  if ! content="$(release_summary_text "$file")"; then
    ui_status error "无法读取发布结果：${file}"
    return 1
  fi
  ui_summary --title '发布结果' --tone success --content "$content"
}
