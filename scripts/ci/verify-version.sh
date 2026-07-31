#!/usr/bin/env bash
# Verify version/release consistency without coupling to the release cadence:
#   1. plugin.json version is valid semver;
#   2. the README marketplace install pin (`"ref": "<tag>"`) names a git tag that
#      actually exists — a typo'd/stale pin means broken install instructions.
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

# README marketplace install pin, e.g.  "ref": "v0.10.0"  or  "orc--v0.11.0".
ref="$(grep -oE '"ref":[[:space:]]*"[^"]+"' README.md | head -1 | sed -E 's/.*"ref":[[:space:]]*"([^"]+)".*/\1/' || true)"
if [ -n "$ref" ]; then
  if ! git rev-parse -q --verify "refs/tags/${ref}" >/dev/null 2>&1; then
    if [ -z "$(git tag)" ]; then
      echo "verify-version: no tags in checkout (fetch-depth: 0 needed) — skipping ref-exists check"
    else
      echo "verify-version: README pins install ref '${ref}' but no such git tag exists"
      status=1
    fi
  fi
fi

if [ "$status" -eq 0 ]; then
  echo "verify-version: OK (semver valid; README ref '${ref:-none}' resolves)"
fi
exit "$status"
