#!/usr/bin/env bash

# 校验锁文件与依赖安装状态。
quality_assert_installation() {
  pnpm install --frozen-lockfile
}

# 校验所有 workspace 包的发布配置边界。
quality_assert_package_configuration() {
  bash scripts/workflow/commands/packages/check-config.sh
}
