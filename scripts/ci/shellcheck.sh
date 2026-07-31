#!/usr/bin/env bash
# Shellcheck orc's own shell scripts — the hooks, shared libs, PATH wrappers, and
# these CI scripts. Deliberately scoped to first-party scripts; vendored skill
# scripts under orc/skills/**/scripts are out of scope. Run from the repo root.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"

shellcheck \
  orc/hooks/scripts/*.sh \
  orc/lib/*.sh \
  orc/bin/* \
  scripts/ci/*.sh

echo "shellcheck: OK (hooks, libs, bin, scripts/ci all clean)"
