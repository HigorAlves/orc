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

# Thumbnails: jpg (+ rgb when ffmpeg exists) under qa/thumbs/, JSON list, idempotent
png1='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
printf '%s' "$png1" | base64 -d > "$files/qa/ac-1-1-export.png" 2>/dev/null || printf '%s' "$png1" | base64 -D > "$files/qa/ac-1-1-export.png"
cat > "$files/qa/qa-manifest.json" <<'EOF'
{ "schema": 1, "driver": "agent-browser", "verdict": "pass", "artifacts": [],
  "acceptance": [
    { "id": "a1", "sliceId": 1, "criterion": "Export returns 202", "result": "pass", "evidence": ["ac-1-1-export.png#frame", "ac-1-1-export.png", "gone.png", "../escape.png"] } ] }
EOF
thumbs="$(bash "$orc_report" thumbs --branch feat/x)"
tcheck() { if printf '%s' "$thumbs" | jq -e "$2" >/dev/null 2>&1; then ok; else fail "thumbs: $1"; fi; }
tcheck "one entry per existing image, de-duplicated, traversal skipped" 'length == 1 and .[0].name == "ac-1-1-export" and .[0].criterion == "Export returns 202"'
if command -v sips >/dev/null 2>&1 || command -v ffmpeg >/dev/null 2>&1; then
  tcheck "jpg path inside qa/thumbs" '.[0].jpg | endswith("/qa/thumbs/ac-1-1-export.jpg")'
  tcheck "png path inside qa/thumbs" '.[0].png | endswith("/qa/thumbs/ac-1-1-export.png")'
  if [ -s "$files/qa/thumbs/ac-1-1-export.jpg" ] && [ -s "$files/qa/thumbs/ac-1-1-export.png" ]; then ok; else fail "thumbs: jpg or png not written"; fi
fi
if command -v ffmpeg >/dev/null 2>&1; then
  if [ "$(wc -c < "$files/qa/thumbs/ac-1-1-export.rgb" | tr -d ' ')" = "1536" ]; then ok; else fail "thumbs: rgb must be 32x16x3 bytes"; fi
fi
again="$(bash "$orc_report" thumbs --branch feat/x)"
if [ "$again" = "$thumbs" ]; then ok; else fail "thumbs: second run must print the same list"; fi

# Nested evidence paths keep distinct thumbnail names, and missing files do not use up the three slots
mkdir -p "$files/qa/test-results/a" "$files/qa/test-results/b"
for f in test-results/a/x.png test-results/b/x.png test-results/b/y.png; do cp "$files/qa/ac-1-1-export.png" "$files/qa/$f"; done
cat > "$files/qa/qa-manifest.json" <<'EOF'
{ "schema": 1, "driver": "playwright", "verdict": "pass", "artifacts": [],
  "acceptance": [
    { "id": "a1", "sliceId": 1, "criterion": "Nested", "result": "pass", "evidence": ["m1.png", "m2.png", "m3.png", "test-results/a/x.png", "test-results/b/x.png", "test-results/b/y.png", "ac-1-1-export.png"] } ] }
EOF
nested="$(bash "$orc_report" thumbs --branch feat/x)"
if printf '%s' "$nested" | jq -e '[.[].name] == ["test-results__a__x", "test-results__b__x", "test-results__b__y"]' >/dev/null 2>&1; then ok; else fail "thumbs: nested names must be unique and missing files must not use the slots, got: $nested"; fi

# A tall screenshot is cropped to 240x150 so it fits the embed cap
if command -v ffmpeg >/dev/null 2>&1 && command -v sips >/dev/null 2>&1; then
  ffmpeg -loglevel error -y -f lavfi -i color=c=red:s=300x900 -frames:v 1 "$files/qa/tall.png" >/dev/null 2>&1
  cat > "$files/qa/qa-manifest.json" <<'EOF'
{ "schema": 1, "driver": "playwright", "verdict": "pass", "artifacts": [],
  "acceptance": [ { "id": "a1", "sliceId": 1, "criterion": "Tall", "result": "pass", "evidence": ["tall.png"] } ] }
EOF
  bash "$orc_report" thumbs --branch feat/x >/dev/null
  h="$(sips -g pixelHeight "$files/qa/thumbs/tall.png" | awk '/pixelHeight/ { print $2 }')"
  if [ "${h:-9999}" -le 150 ]; then ok; else fail "thumbs: tall screenshot must be cropped to <=150px, got ${h}px"; fi
fi

# --- factory: aggregate metrics over every session in a state dir ---
fstate="$tmp/fstate"
mkdir -p "$fstate/done-a/files" "$fstate/run-b/files" "$fstate/pause-c/files"
cat > "$fstate/orc.json" <<'EOF'
{ "schema": 1, "sessions": [
  { "sessionId": "done-a", "status": "completed", "startedAt": "2026-10-20T10:00:00Z", "updatedAt": "2026-10-20T11:00:00Z" },
  { "sessionId": "run-b", "status": "in_progress", "startedAt": "2026-10-21T10:00:00Z", "updatedAt": "2026-10-21T10:30:00Z" },
  { "sessionId": "pause-c", "status": "paused", "startedAt": "2026-10-22T10:00:00Z", "updatedAt": "2026-10-22T10:10:00Z" } ] }
EOF
cat > "$fstate/done-a/files/usage.jsonl" <<'EOF'
{"at":"2026-10-20T10:10:00Z","agent":"orc-implementer","model":"m","in":100,"out":50,"ms":1000,"costUsd":0.5}
{"at":"2026-10-20T10:20:00Z","agent":"orc-implementer","model":"m","in":100,"out":50,"ms":1000,"costUsd":0.25}
EOF
cat > "$fstate/done-a/files/slices.json" <<'EOF'
{ "slices": [ { "id": 1, "status": "committed" }, { "id": 2, "status": "escalated", "note": "needs new dependency" } ] }
EOF
printf '{"schema":1,"verdict":"pass","checks":[]}\n' > "$fstate/done-a/files/qa-verdict.json"
fjson="$(bash "$orc_report" factory --since 2026-10-01 --state-dir "$fstate")"
fcheck() { if printf '%s' "$fjson" | jq -e "$2" >/dev/null 2>&1; then ok; else fail "factory: $1"; fi; }
fcheck "all contract keys present" 'has("since") and has("until") and has("tasks") and has("cycleTimeMs") and has("firstPassRate") and has("escalations") and has("retries") and has("cost") and has("queue")'
fcheck "task counts" '.tasks == {created: 3, closed: 1, open: 2, waitingOnYou: 1, running: 1, queued: 0}'
fcheck "escalation rate is 1 of 1 sessions with a ledger" '.escalations.rate == 1'
fcheck "top reasons carry the note" '.escalations.topReasons == [{reason: "needs new dependency", count: 1}]'
fcheck "task cycle time is a number" '.cycleTimeMs.task.median == 3600000 and (.cycleTimeMs.perStage == {})'
fcheck "verifying first-pass from qa-verdict" '.firstPassRate == {verifying: 1, ci_watch: null, implementing: null}'
fcheck "retries per task" '.retries.perTask.median == 1 and .retries.byLoop == {verify: 0, e2e: 0, ci: 0}'
fcheck "cost by agent" '.cost.totalUsd == 0.75 and .cost.byStage["orc-implementer"] == 0.75 and .cost.perTaskUsd.median == 0.75'
fcheck "queue" '.queue == {depth: 0, slots: {max: 1, active: 1}, utilisation: 1}'
empty="$tmp/empty-state"; mkdir -p "$empty"; printf '{"schema":1,"sessions":[]}\n' > "$empty/orc.json"
ejson="$(bash "$orc_report" factory --state-dir "$empty")"
if printf '%s' "$ejson" | jq -e '.escalations.rate == null and .cycleTimeMs.task.median == null and .cost.totalUsd == null and .queue.utilisation == 0 and (.tasks.created == 0)' >/dev/null 2>&1; then ok; else fail "factory: empty state must yield nulls, got: $ejson"; fi
if out="$(bash "$orc_report" factory --since bogus --state-dir "$fstate" 2>&1)"; then rc=0; else rc=$?; fi
if [ "$rc" = 2 ] && printf '%s' "$out" | grep -q 'bogus'; then ok; else fail "factory: --since bogus must exit 2 naming the value (rc=$rc: $out)"; fi

if [ "$status" -eq 0 ]; then
  echo "verify-report: OK ($pass_count cases)"
fi
exit "$status"
