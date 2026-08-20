#!/usr/bin/env bash
# Structural integrity of the tool registry (orc/lib/tools.json):
#   - schema:   required keys, closed tier enum, hints.default fallback present;
#   - managers: install keys limited to what cli/internal/pkgmgr can resolve;
#   - setup:    a hint whose recipe chains a second command (`&&`) must carry a
#               matching postInstall, or `orc doctor --fix` leaves the tool
#               half-installed (this is the drift that shipped agent-browser
#               without its `agent-browser install` step). Interactive auth
#               steps (`gh auth login`, `sentry-cli login`) are exempt — those
#               are deliberately left to the human, never run unattended;
#   - docs:     the Requirements table in docs/install.md names every tool, and
#               names no tool the registry dropped.
# Recipe correctness against live registries (does this formula exist?) is NOT
# checked here — that needs network and would make CI flaky. Verify by hand when
# adding or editing a recipe.
# Run from the repo root.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"

reg=orc/lib/tools.json
docs=docs/install.md
status=0

fail() { echo "verify-tools: $1"; status=1; }

jq empty "$reg" 2>/dev/null || { fail "$reg is not valid JSON"; exit 1; }

known_managers='["brew","apt","dnf","pacman","npm","uv","pipx"]'

while IFS=$'\t' read -r name tier has_default has_usedby bad_mgrs chained has_post; do
  [ -n "$name" ] || { fail "a tool entry has no name"; continue; }

  case "$tier" in
    required | recommended) ;;
    *) fail "$name: tier '$tier' is not required|recommended" ;;
  esac

  [ "$has_default" = "true" ] || fail "$name: hints.default is missing (the fallback for unknown platforms)"

  if [ "$tier" = recommended ] && [ "$has_usedby" != "true" ]; then
    fail "$name: recommended tools need a usedBy note (the tool-check prints it)"
  fi

  [ "$bad_mgrs" = "-" ] || fail "$name: unsupported install manager(s): $bad_mgrs (pkgmgr resolves $known_managers)"

  if [ "$chained" = "true" ] && [ "$has_post" != "true" ]; then
    fail "$name: a hint chains a second command with && but no postInstall exists — the unattended path would skip it"
  fi
# NB: the "-" sentinel above is load-bearing — tab is an IFS whitespace class, so
# `read` collapses runs of tabs and an empty field would shift every column after it.
done < <(jq -r --argjson known "$known_managers" '
  .tools[] | [
    .name,
    .tier,
    (.hints.default != null),
    (.usedBy != null),
    ([(.install // {} | keys[]) | select(. as $m | $known | index($m) | not)] | join(",") | if . == "" then "-" else . end),
    ([.hints[] | select(test("&&")) | select(test("login") | not)] | length > 0),
    (.postInstall != null)
  ] | @tsv' "$reg")

# docs/install.md Requirements table must stay in step with the registry.
for name in $(jq -r '.tools[].name' "$reg"); do
  grep -qF "| \`$name\` |" "$docs" || fail "$docs Requirements table is missing a row for \`$name\`"
done
# awk, not sed: BSD sed has no \| alternation, so a sed-based extraction here
# would silently match nothing and this check would never fire.
while read -r row; do
  jq -e --arg n "$row" '[.tools[].name] | index($n)' "$reg" >/dev/null \
    || fail "$docs lists \`$row\` but it is not in $reg"
done < <(awk -F'|' '$3 ~ /^ *(required|recommended) *$/ {
    gsub(/[ `]/, "", $2); if ($2 != "") print $2
  }' "$docs")

[ "$status" -eq 0 ] && echo "verify-tools: OK ($(jq '.tools | length' "$reg") tools — schema, managers, postInstall, docs table)"
exit "$status"
