#!/usr/bin/env bash

# release:test 命令编排：通过统一工作流 UI 运行发布脚本自身的测试套件。

# 运行全部发布脚本测试；失败时停止后续用例并将失败包名交给调用方处理。
release_run_tests() {
  local label
  local test_file

  while IFS=$'\t' read -r label test_file; do
    [[ -n "$label" && -n "$test_file" ]] || continue
    ui_task --title "测试 ${label}" --log live -- bash "$workflow_root/$test_file" || return
  done < <(release_test_case_records)
}

# 执行独立的发布脚本测试流程，不执行实际发布。
release_test() {
  [[ $# -eq 0 ]] || return 2

  ui_flow_begin --domain release --title '发布脚本测试' --description '运行发布流程、交互控件、工作区目标与 UI 渲染测试，不执行实际发布。' || return
  ui_flow_group --title '测试任务' --description '测试套件保持无副作用；任一测试失败都会立即停止后续任务。' || return
  if release_run_tests; then
    ui_flow_end success '发布脚本测试完成。'
  else
    local exit_code=$?
    ui_flow_end failed '发布脚本测试失败。'
    return "$exit_code"
  fi
}
