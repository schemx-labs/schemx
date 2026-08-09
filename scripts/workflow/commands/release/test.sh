#!/usr/bin/env bash

# release:test 命令编排：通过统一工作流 UI 运行发布脚本自身的测试套件。

release_test() {
  local label
  local test_file

  [[ $# -eq 0 ]] || return 2

  ui_flow_begin --domain release --title '发布脚本测试' --description '运行发布流程、交互控件、工作区目标与 UI 渲染测试，不执行实际发布。' || return
  ui_flow_group --title '测试任务' --description '测试套件保持无副作用；任一测试失败都会立即停止后续任务。' || return
  while IFS=$'\t' read -r label test_file; do
    [[ -n "$label" && -n "$test_file" ]] || continue
    ui_task --title "测试 ${label}" --log live -- bash "$workflow_root/$test_file" || { local exit_code=$?; ui_flow_end failed "发布脚本测试失败：${label}。"; return "$exit_code"; }
  done < <(release_test_case_records)
  ui_flow_end success '发布脚本测试完成。'
}
