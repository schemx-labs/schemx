#!/usr/bin/env bash

# SemVer 基线与预发布版本计算。该模块为纯逻辑，不读取 npm registry。

# 判断版本是否是无 prerelease/build metadata 的正式 SemVer。
versions_is_stable() {
  [[ "$1" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]
}
# 判断发布通道是否属于支持集合。
versions_is_channel() {
  case "$1" in
    dev | alpha | beta | rc | next | latest) return 0 ;;
    *) return 1 ;;
  esac
}

# 判断版本动作是否合法。
versions_is_action() {
  case "$1" in
    current | patch | minor | major) return 0 ;;
    *) versions_is_stable "$1" ;;
  esac
}

# 根据当前稳定版本与版本动作计算目标正式版本基线。
versions_baseline() {
  # 当前 package.json 版本。
  local current_version="$1"
  # 用户选择的版本动作或精确版本。
  local action="$2"
  # 从当前版本拆出的主、次、修订号。
  local major minor patch

  if [[ "$action" == 'current' ]]; then
    versions_is_stable "$current_version" || return 2
    printf '%s' "$current_version"
    return
  fi
  if versions_is_stable "$action"; then
    printf '%s' "$action"
    return
  fi
  versions_is_stable "$current_version" || return 2

  IFS='.' read -r major minor patch <<< "$current_version"
  case "$action" in
    patch) patch=$((patch + 1)) ;;
    minor) minor=$((minor + 1)); patch=0 ;;
    major) major=$((major + 1)); minor=0; patch=0 ;;
    *) return 2 ;;
  esac
  printf '%s.%s.%s' "$major" "$minor" "$patch"
}

# 根据通道、正式版本基线和已确认序号生成实际 npm 版本。
versions_release_version() {
  # 发布通道。
  local channel="$1"
  # 无 prerelease 的正式版本基线。
  local baseline="$2"
  # npm registry 查询得到的下一个序号；dev 忽略该值。
  local sequence="${3:-0}"
  # 可复现测试可注入的时间戳。
  local timestamp="${SCHEMX_RELEASE_TIMESTAMP:-$(date +%Y%m%d%H%M%S)}"
  # 可复现测试可注入的源码短 SHA。
  local sha="${SCHEMX_RELEASE_SHA:-$(git rev-parse --short HEAD 2>/dev/null || printf 'local')}"

  versions_is_stable "$baseline" || return 2
  case "$channel" in
    latest) printf '%s' "$baseline" ;;
    dev) printf '%s-dev.%s.%s' "$baseline" "$timestamp" "$sha" ;;
    alpha | beta | rc | next)
      [[ "$sequence" =~ ^[0-9]+$ ]] || return 2
      printf '%s-%s.%s' "$baseline" "$channel" "$sequence"
      ;;
    *) return 2 ;;
  esac
}

# 返回发布所使用的 npm dist-tag。
versions_dist_tag() {
  # 发布通道。
  local channel="$1"
  versions_is_channel "$channel" || return 2
  printf '%s' "$channel"
}
