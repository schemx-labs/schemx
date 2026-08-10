#!/usr/bin/env bash

# npm 发布适配器。只消费已冻结的包名、目录、版本与 dist-tag，不计算版本或渲染 UI。

# 发布一个已写入目标版本的包。
# 环境：可选 NPM_OTP 会透传给 pnpm，供启用 npm 2FA 的非交互发布使用。
publish_package() {
  local package_directory="$1"
  local dist_tag="$2"
  local registry="${NPM_REGISTRY:-https://registry.npmjs.org/}"
  local -a publish_command=(
    pnpm --dir "$package_directory" publish
    --access public
    --registry "$registry"
    --tag "$dist_tag"
    --no-git-checks
  )

  [[ -n "${NPM_OTP:-}" ]] && publish_command+=(--otp "$NPM_OTP")

  preflight_with_npm_token "${publish_command[@]}"
}
