#!/usr/bin/env bash
# Verify the changelog keeps up with the manifest:
#   1. CHANGELOG.md has a non-empty "## [<plugin.json version>]" section, so the
#      plugin-release workflow has notes to publish when the tag lands;
#   2. every "## [X.Y.Z]" heading is valid semver and descends from the top
#      (newest first), so changelog-section.sh cuts the right block.
# "## [Unreleased]" is allowed at the top while a train is in flight.
# Run from the repo root.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"

status=0
version="$(jq -r '.version' orc/.claude-plugin/plugin.json)"

if ! bash scripts/ci/changelog-section.sh "$version" >/dev/null 2>&1; then
  echo "verify-changelog: CHANGELOG.md has no non-empty '## [$version]' section (plugin.json is $version)"
  status=1
fi

prev=""
while IFS= read -r ver; do
  if ! printf '%s' "$ver" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+$'; then
    echo "verify-changelog: heading '## [$ver]' is not semver"; status=1; continue
  fi
  if [ -n "$prev" ] && [ "$(printf '%s\n%s\n' "$prev" "$ver" | sort -V | head -1)" != "$ver" ]; then
    echo "verify-changelog: '## [$ver]' appears below '## [$prev]' — newest first"; status=1
  fi
  prev="$ver"
done < <(grep -oE '^## \[[^]]+\]' CHANGELOG.md | sed -E 's/^## \[(.*)\]$/\1/' | grep -v '^Unreleased$' || true)

if [ "$status" -eq 0 ]; then
  echo "verify-changelog: OK ('## [$version]' present; headings are semver, newest first)"
fi
exit "$status"
