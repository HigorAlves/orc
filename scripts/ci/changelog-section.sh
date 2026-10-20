#!/usr/bin/env bash
# Print the CHANGELOG.md section for one version (the body under "## [X.Y.Z]",
# up to the next "## [" heading), without the heading itself. Exit 1 when the
# section is missing or empty. Used by plugin-release.yml and verify-changelog.sh.
#   usage: changelog-section.sh <version> [changelog-path]
set -euo pipefail

version="${1:?version required}"
changelog="${2:-CHANGELOG.md}"

[ -f "$changelog" ] || { echo "changelog-section: $changelog not found" >&2; exit 1; }

section="$(awk -v v="$version" '
  /^## \[/ { if (found) exit; if (index($0, "## [" v "]") == 1) { found=1; next } }
  found { print }
' "$changelog")"

if [ -z "$(printf '%s' "$section" | tr -d '[:space:]')" ]; then
  echo "changelog-section: no '## [$version]' section with content in $changelog" >&2
  exit 1
fi
printf '%s\n' "$section"
