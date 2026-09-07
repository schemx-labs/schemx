#!/usr/bin/env bash

# 本地包打包命令入口；实现位于 domains/packages/local-pack.sh。

set -o pipefail

packages_command_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
source "$packages_command_root/scripts/workflow/domains/packages/local-pack.sh"

packages_pack_local_main "$@"
