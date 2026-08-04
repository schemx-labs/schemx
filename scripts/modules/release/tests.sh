#!/usr/bin/env bash

# 发布工作流测试清单与执行适配器；成功时静默，失败时保留原始诊断输出。

release_test_case_records() {
  cat <<'CASES'
发布核心模块	scripts/tests/release/unit/release-core.test.sh
发布输入解析	scripts/tests/release/unit/inputs.test.sh
Release notes	scripts/tests/release/unit/notes.test.sh
终端 UI 原语	scripts/tests/release/unit/ui.test.sh
发布计划集成	scripts/tests/release/integration/release-plan.test.sh
UI 渲染集成	scripts/tests/release/integration/ui-render.test.sh
工作区目标解析	tests/workflow/workspace-targets.test.sh
开发服务流程	tests/workflow/dev.test.sh
构建流程	tests/workflow/build.test.sh
Clack 交互控件	tests/workflow/clack.test.sh
CASES
}

# 执行一个测试命令。通过时不输出脚本自身的“通过”文本，失败时完整回放诊断。
release_test_run() {
  if [[ $# -eq 0 ]]; then
    printf 'release_test_run 用法错误：需要提供测试命令。\n' >&2
    return 2
  fi

  local output
  local exit_code
  if output="$("$@" 2>&1)"; then
    return 0
  else
    exit_code=$?
  fi

  [[ -n "$output" ]] && printf '%s\n' "$output" >&2
  return "$exit_code"
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  case "${1:-}" in
    run)
      shift
      release_test_run "$@"
      ;;
    *)
      printf '用法：bash scripts/modules/release/tests.sh run <test-command> [arguments...]\n' >&2
      exit 2
      ;;
  esac
fi
