#!/usr/bin/env bash

# 发布产物检查。该模块仅运行 npm/pnpm 的 dry-run，不生成或发布实际 tarball。

# 使用 pnpm 的实际发布文件规则检查一个包。
artifacts_assert_package() {
  local package_name="$1"
  pnpm --filter "$package_name" pack --dry-run
}
# 为本地安装验证生成一个包的 tarball。
artifacts_pack_package() {
  local package_name="$1"
  local destination="$2"

  mkdir -p "$destination"
  pnpm --filter "$package_name" pack --pack-destination "$destination"
}
