#!/usr/bin/env bash
# Fixture tests for bin/orc-report — the QA packet -> report JSON / HTML
# renderer. Pins the normalized shape the template and Artifact publish read.
# Run from the repo root.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
orc_state="$repo_root/orc/bin/orc-state"
orc_report="$repo_root/orc/bin/orc-report"

status=0
pass_count=0
fail() { echo "verify-report: FAIL — $1"; status=1; }
ok() { pass_count=$((pass_count + 1)); }

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
export ORC_STATE_DIR="$tmp/.orc"
bash "$orc_state" init --command qa --total-phases 6 --branch feat/x >/dev/null
files="$ORC_STATE_DIR/feat-x/files"

# No packet yet: a clear error, non-zero exit
if out="$(bash "$orc_report" json --branch feat/x 2>&1)"; then
  fail "json: must fail without a QA packet"
elif printf '%s' "$out" | grep -q 'no QA packet'; then ok; else fail "json: error must say 'no QA packet', got: $out"; fi

mkdir -p "$files/qa"
printf 'png' > "$files/qa/ac-1-1-export.png"
cat > "$files/qa/qa-manifest.json" <<'EOF'
{ "schema": 1, "driver": "agent-browser", "generatedAt": "2026-10-05T00:00:00Z", "verdict": "fail",
  "artifacts": [{ "file": "ac-1-1-export.png", "role": "criterion 1" }, { "file": "qa-feat-x.webm", "role": "recording" }],
  "curated": ["ac-1-1-export.png"],
  "acceptance": [
    { "id": "slice-1-ac-1", "sliceId": 1, "criterion": "Export returns 202", "result": "pass", "evidence": ["ac-1-1-export.png"] },
    { "id": "slice-1-ac-2", "sliceId": 1, "criterion": "Shows </script><b>done</b>", "result": "fail", "evidence": ["ac-1-2-missing.png"], "note": "toast never rendered" }
  ],
  "summary": "One criterion fails." }
EOF
cat > "$files/qa-verdict.json" <<'EOF'
{ "schema": 1, "verdict": "fail", "checks": [
  { "id": "tests", "kind": "suite", "result": "pass", "evidence": "58/58" },
  { "id": "slice-1-ac-1", "kind": "acceptance", "result": "pass" } ] }
EOF

json="$(bash "$orc_report" json --branch feat/x)"
check() { # $1 = case, $2 = jq predicate over the report JSON
  if printf '%s' "$json" | jq -e "$2" >/dev/null 2>&1; then ok; else fail "json: $1"; fi
}
check "verdict comes from qa-verdict.json" '.verdict == "fail"'
check "branch from the session" '.branch == "feat/x"'
check "acceptance rows carried over" '(.acceptance | length) == 2 and .acceptance[1].note == "toast never rendered"'
check "non-acceptance checks only" '[.checks[].kind] == ["suite"]'
check "artifact kinds" '[.artifacts[].kind] == ["image", "video"]'
check "missing evidence listed" '.missing == ["qa-feat-x.webm", "ac-1-2-missing.png"]'

# HTML: written beside the evidence, data injected, script-breakout escaped
path="$(bash "$orc_report" html --branch feat/x)"
html="$files/qa/report.html"
if [ "$path" = "$html" ] && [ -f "$html" ]; then ok; else fail "html: must print and write $html, got '$path'"; fi
if grep -q 'id="orc-report-data"' "$html" && grep -q 'Export returns 202' "$html"; then ok; else fail "html: report data not injected"; fi
if grep -qF '</script><b>' "$html"; then fail "html: '</script>' in data must be escaped"; else ok; fi
if grep -q '__ORC_REPORT_DATA__' "$html"; then fail "html: placeholder left in output"; else ok; fi

# Playwright-driver packet: video chapters + target pass through
cat > "$files/qa/qa-manifest.json" <<'EOF'
{ "schema": 1, "driver": "playwright", "generatedAt": "2026-10-06T00:00:00Z", "verdict": "pass",
  "target": { "name": "staging", "baseUrl": "https://staging.example.com", "guard": true },
  "artifacts": [{ "file": "qa-feat-x.webm", "role": "stitched recording" }],
  "video": { "file": "qa-feat-x.webm", "chapters": [ { "id": "golden", "title": "Export golden path @golden", "outcome": "passed", "start": 2.0, "end": 9.5 } ] },
  "curated": ["qa-feat-x.webm"], "specs": ["e2e/specs/export.md"], "tests": ["e2e/tests/export/golden.spec.ts"],
  "acceptance": [ { "id": "slice-1-ac-1", "sliceId": 1, "criterion": "Export returns 202", "result": "pass", "evidence": ["qa-feat-x.webm#t=2.0"] } ],
  "summary": "ok" }
EOF
printf 'webm' > "$files/qa/qa-feat-x.webm"
json="$(bash "$orc_report" json --branch feat/x)"
check "playwright driver passes through" '.driver == "playwright" and .target.name == "staging"'
check "video chapters pass through" '(.video.chapters | length) == 1 and .video.chapters[0].start == 2.0'
check "evidence with #t anchor resolves to the file" '.missing == []'
path="$(bash "$orc_report" html --branch feat/x)"
if grep -q 'Export golden path' "$html" && grep -q 'chapters' "$html"; then ok; else fail "html: chapters must render"; fi

if [ "$status" -eq 0 ]; then
  echo "verify-report: OK ($pass_count cases)"
fi
exit "$status"
