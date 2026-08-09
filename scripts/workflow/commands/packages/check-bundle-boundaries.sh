#!/usr/bin/env bash
set -euo pipefail

packages_command_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
source "$packages_command_root/scripts/workflow/domains/packages/check-bundle-boundaries.sh"
packages_check_bundle_boundaries "$@"
