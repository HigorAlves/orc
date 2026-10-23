#!/usr/bin/env bash
# Fixture tests for lib/retro.sh — the mechanical half of `/orc:retro --propose`
# (calibration bias, incidents, patterns). Run from the repo root.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
retro="$repo_root/orc/lib/retro.sh"

status=0
pass_count=0
fail() { echo "verify-retro: FAIL — $1"; status=1; }
ok() { pass_count=$((pass_count + 1)); }
expect() { # $1 = case, $2 = jq predicate, $3 = JSON
  if printf '%s' "$3" | jq -e "$2" >/dev/null 2>&1; then ok; else fail "$1 (got: $3)"; fi
}

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
files="$tmp/files"
mkdir -p "$files/retro"

cat > "$files/slices.json" <<'JSON'
{ "schema": 1, "slices": [
  { "id": 1, "title": "a", "status": "committed", "estLoc": 100, "actualLoc": 130, "note": null },
  { "id": 2, "title": "b", "status": "committed", "estLoc": 80, "actualLoc": 80, "note": null },
  { "id": 3, "title": "c", "status": "committed", "estLoc": 50, "actualLoc": 90, "retries": 1, "note": null },
  { "id": 4, "title": "d", "status": "escalated", "estLoc": 40, "actualLoc": 400, "note": "Needs a new dependency: zod v4 for parsing" },
  { "id": 5, "title": "e", "status": "pending", "estLoc": 10, "actualLoc": null, "note": "Spec ambiguous about retry window semantics" }
] }
JSON
cat > "$files/qa-verdict.json" <<'JSON'
{ "schema": 1, "verdict": "fail", "checks": [
  { "id": "tests", "kind": "suite", "result": "pass" },
  { "id": "slice-2-ac-1", "kind": "acceptance", "result": "fail", "criterion": "Export returns 202" } ] }
JSON
cat > "$files/review-findings.json" <<'JSON'
{ "findings": [
  { "severity": "bug", "title": "Missing null check on export id" },
  { "severity": "nit", "title": "Rename helper" } ] }
JSON
printf '{"verdict":"red","classification":"lint","summary":"eslint failed"}' > "$files/ci-1.json"
printf '{"verdict":"green","classification":"green","summary":"ok"}' > "$files/ci-2.json"

# Calibration: median of 1.3, 1.0, 1.8 (committed slices only) is 1.3
cal="$(bash "$retro" calibration "$files/slices.json")"
expect "bias is the median ratio" '.estLocBias == 1.3' "$cal"
expect "sample size counts committed slices with both numbers" '.sampleSize == 3' "$cal"
expect "calibration carries schema 1" '.schema == 1' "$cal"

# Even count averages the two middle ratios; no sample gives bias 1
echo '{"slices":[{"status":"committed","estLoc":10,"actualLoc":10},{"status":"committed","estLoc":10,"actualLoc":20}]}' > "$tmp/even.json"
expect "even sample averages the middle pair" '.estLocBias == 1.5' "$(bash "$retro" calibration "$tmp/even.json")"
echo '{"slices":[]}' > "$tmp/none.json"
expect "no sample gives bias 1" '.estLocBias == 1 and .sampleSize == 0' "$(bash "$retro" calibration "$tmp/none.json")"

# Incidents
inc="$(bash "$retro" incidents "$files" feat/x)"
expect "escalated slice is an incident" 'any(.[]; .kind == "escalation" and (.evidence | test("zod")))' "$inc"
expect "red-to-green retry is an incident" 'any(.[]; .kind == "retry")' "$inc"
expect "qa fail is an incident" 'any(.[]; .kind == "qa-fail" and (.evidence | test("202")))' "$inc"
expect "bug finding is an incident" 'any(.[]; .kind == "review-bug")' "$inc"
expect "nit finding is not an incident" 'all(.[]; (.evidence | test("Rename") | not))' "$inc"
expect "non-green CI is an incident" 'any(.[]; .kind == "ci" and (.evidence | test("lint")))' "$inc"
expect "green CI is not an incident" 'all(.[]; (.evidence | test("ok$") | not))' "$inc"
expect "every incident names its session branch" 'all(.[]; .sessionBranch == "feat/x")' "$inc"
expect "a pending slice note is not an incident" 'all(.[]; (.evidence | test("ambiguous") | not))' "$inc"

# Patterns: one prior occurrence of the escalation note makes a pattern
cat > "$tmp/prior.json" <<'JSON'
[ { "kind": "escalation", "evidence": "Needs a new dependency: zod v4 in forms", "sessionBranch": "feat/old" } ]
JSON
printf '%s' "$inc" > "$tmp/current.json"
pat="$(bash "$retro" patterns "$tmp/current.json" "$tmp/prior.json")"
expect "repeated escalation across sessions is a pattern" 'any(.[]; .kind == "escalation" and .count == 2)' "$pat"
expect "single occurrences are not patterns" 'length == 1' "$pat"
expect "pattern lists both sessions" '.[0].sessions | sort == ["feat/old","feat/x"]' "$pat"
expect "no prior sessions: no pattern" 'length == 0' "$(bash "$retro" patterns "$tmp/current.json")"

# Missing sources are skipped and listed
rm "$files/qa-verdict.json"
miss="$(bash "$retro" missing "$files")"
expect "missing files are listed" 'index("qa-verdict.json") != null and index("usage.jsonl") != null' "$miss"
expect "present files are not listed" 'index("slices.json") == null' "$miss"

if [ "$status" -eq 0 ]; then echo "verify-retro: ok ($pass_count checks)"; fi
exit "$status"
