#!/usr/bin/env bash

set -euo pipefail

# 验证新入口可生成冻结计划，且不会调用旧发布流程。

test_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root_dir="$(cd "$test_dir/../../../../" && pwd)"
plan_file="$(mktemp)"
trap 'rm -f "$plan_file"' EXIT

CI=true SCHEMX_RELEASE_SHA=abc1234 SCHEMX_RELEASE_PRERELEASE_SEQUENCE=0 bash "$root_dir/scripts/commands/release.sh" plan beta core 1.0.0 --output "$plan_file" >/dev/null

node - "$plan_file" <<'NODE'
const fs = require('node:fs')
const plan = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))
if (plan.channel !== 'beta' || plan.distTag !== 'beta' || plan.packages.length !== 1) process.exit(1)
if (plan.packages[0].name !== '@schemx/core' || plan.packages[0].version !== '1.0.0-beta.0') process.exit(1)
NODE

if CI=true bash "$root_dir/scripts/commands/release.sh" plan beta core current --output "$plan_file" >/dev/null 2>&1; then
  printf '断言失败：预发布不应接受 current。\n' >&2
  exit 1
fi

printf 'release-plan.test.sh: 通过\n'
