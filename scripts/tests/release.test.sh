#!/usr/bin/env bash

# 新发布流程的本地测试入口；只运行无副作用的单元与集成测试。

set -euo pipefail

workflow_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
source "$workflow_root/scripts/workflow/domains/release/tests.sh"

while IFS=$'\t' read -r label test_file; do
  [[ -n "$label" && -n "$test_file" ]] || continue
  bash "$workflow_root/$test_file"
done < <(release_test_case_records)
