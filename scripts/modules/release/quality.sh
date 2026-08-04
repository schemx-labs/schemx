#!/usr/bin/env bash

# Turborepo 质量任务编排。发布相关命令不在 Turbo 缓存图中执行。

# 对一个计划包及其依赖闭包执行可缓存质量任务。
quality_run_package() {
  local package_name="$1"
  pnpm exec turbo run lint type-check test build --filter="...${package_name}"
}

# 校验锁文件与依赖安装状态。
quality_assert_installation() {
  pnpm install --frozen-lockfile
}

# 校验所有 workspace 包的发布配置边界。
quality_assert_package_configuration() {
  bash scripts/modules/packages/check-config.sh
}
