#!/usr/bin/env bash
# Verify version/release consistency without coupling to the release cadence:
#   1. plugin.json version is valid semver;
#   2. every marketplace install pin (`"ref": "<tag>"`) in README.md and
#      docs/install.md names a git tag that actually exists — a typo'd/stale
#      pin means broken install instructions.
# Deliberately does NOT require the pin to equal plugin.json's version: the
# manifest is bumped a PR ahead of the release tag, so the pin trails by design.
# CI must fetch tags for step 2 (checkout with fetch-depth: 0).
# Run from the repo root.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"

status=0
plugin_json="orc/.claude-plugin/plugin.json"

version="$(jq -r '.version' "$plugin_json")"
if ! printf '%s' "$version" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+$'; then
  echo "verify-version: plugin.json version '$version' is not valid semver"
  status=1
fi

# Marketplace install pins, e.g.  "ref": "v0.10.0"  or  "orc--v0.11.0".
# The jsonc pin lives in docs/install.md; README carries the flag-form pin
# (`orc install --ref <tag>`). Both must name existing tags.
pins=0
last_pin=""
for pin_file in README.md docs/install.md; do
  [ -f "$pin_file" ] || continue
  while IFS= read -r pin; do
    [ -n "$pin" ] || continue
    pins=$((pins + 1))
    last_pin="$pin"
    if ! git rev-parse -q --verify "refs/tags/${pin}" >/dev/null 2>&1; then
      if [ -z "$(git tag)" ]; then
        echo "verify-version: no tags in checkout (fetch-depth: 0 needed) — skipping ref-exists check"
      else
        echo "verify-version: ${pin_file} pins install ref '${pin}' but no such git tag exists"
        status=1
      fi
    fi
  done < <(
    # || true per line: a file legitimately carries only one pin form, and the
    # inherited errexit would otherwise kill the subshell after the first miss.
    { grep -oE '"ref":[[:space:]]*"[^"]+"' "$pin_file" | sed -E 's/.*"([^"]+)"$/\1/' || true
      grep -oE -- '--ref[[:space:]]+[A-Za-z0-9._-]+' "$pin_file" | awk '{print $2}' || true
    } | sort -u
  )
done

if [ "$status" -eq 0 ]; then
  echo "verify-version: OK (semver valid; ${pins} install pin(s) resolve, latest '${last_pin:-none}')"
fi
exit "$status"
