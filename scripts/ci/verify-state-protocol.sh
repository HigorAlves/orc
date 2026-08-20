#!/usr/bin/env bash
# Smoke tests for bin/orc-state — the deterministic .orc/ state writer.
# The CLI is the single writer for .orc/orc.json + checkpoint.md; these
# cases pin the schema (orc:state-protocol) so command prose can't drift.
# Run from the repo root.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
orc_state="$repo_root/orc/bin/orc-state"

status=0
fail() { echo "verify-state-protocol: FAIL — $1"; status=1; }
pass_count=0
ok() { pass_count=$((pass_count + 1)); }

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
export ORC_STATE_DIR="$tmp/.orc"

reg="$ORC_STATE_DIR/orc.json"
ckpt="$ORC_STATE_DIR/feat-x/files/checkpoint.md"

run() { bash "$orc_state" "$@"; }

# --- init ------------------------------------------------------------------
run init --command flow --total-phases 9 --branch feat/x --description "smoke session" >/dev/null

if jq -e '.schema == 1' "$reg" >/dev/null 2>&1; then ok; else fail "init: registry missing schema: 1"; fi
if jq -e '.sessions[0].sessionId == "feat-x"' "$reg" >/dev/null; then ok; else fail "init: sessionId must be sanitized branch (feat-x)"; fi
if jq -e '.sessions[0].gitBranch == "feat/x"' "$reg" >/dev/null; then ok; else fail "init: gitBranch must keep the raw name"; fi
if jq -e '.sessions[0].phase == 1 and .sessions[0].totalPhases == 9' "$reg" >/dev/null; then ok; else fail "init: phase must be int 1, totalPhases 9"; fi
if jq -e '.sessions[0].status == "in_progress"' "$reg" >/dev/null; then ok; else fail "init: status must be in_progress"; fi
if jq -e '.sessions[0].startedAt | test("^\\d{4}-\\d{2}-\\d{2}T")' "$reg" >/dev/null; then ok; else fail "init: startedAt must be ISO-8601 UTC"; fi
if [ -f "$ckpt" ]; then ok; else fail "init: checkpoint.md not created at feat-x/files/"; fi
if grep -q '^schema: 1$' "$ckpt" && grep -q '^command: flow$' "$ckpt" && grep -q '^phase: 1$' "$ckpt"; then ok; else fail "init: checkpoint frontmatter must mirror the registry"; fi
if grep -q '^## Resume digest$' "$ckpt"; then ok; else fail "init: checkpoint must carry a Resume digest section"; fi

# init on the same branch updates, never duplicates
run init --command flow --total-phases 9 --branch feat/x --description "re-init" >/dev/null
n="$(jq '.sessions | length' "$reg")"
if [ "$n" = "1" ]; then ok; else fail "init: re-init on same branch must update, not append (got $n sessions)"; fi

# --- get / phase / status / link-pr ---------------------------------------
if [ "$(run get feat-x --field command)" = "flow" ]; then ok; else fail "get --field command"; fi
run phase set 5 --label implement --branch feat/x >/dev/null
if jq -e '.sessions[0].phase == 5 and .sessions[0].phaseLabel == "implement"' "$reg" >/dev/null; then ok; else fail "phase set: registry phase/phaseLabel"; fi
if grep -q '^phase: 5$' "$ckpt" && grep -q '^phaseLabel: implement$' "$ckpt"; then ok; else fail "phase set: checkpoint mirror"; fi
run phase set 'done' --branch feat/x >/dev/null
if jq -e '.sessions[0].phase == "done"' "$reg" >/dev/null; then ok; else fail "phase set done: literal 'done' allowed"; fi
run status set paused --branch feat/x >/dev/null
if jq -e '.sessions[0].status == "paused"' "$reg" >/dev/null; then ok; else fail "status set paused"; fi
if run status set bogus --branch feat/x >/dev/null 2>&1; then fail "status set: must reject values outside the enum"; else ok; fi
run link-pr --repo orc --url "https://github.com/o/r/pull/45" --number 45 --branch feat/x >/dev/null
if jq -e '.sessions[0].linkedPRs[0].number == 45' "$reg" >/dev/null; then ok; else fail "link-pr: entry not recorded"; fi

# --- sessions (route-from-state surface) ----------------------------------
if run sessions --status paused | grep -q "feat-x"; then ok; else fail "sessions --status paused must list feat-x"; fi
if run sessions --status in_progress | grep -q "feat-x"; then fail "sessions --status in_progress must NOT list a paused session"; else ok; fi

# --- digest write: replaces section, enforces 30-line/2KB cap -------------
printf -- '- Done: phases 1-4\n- Next: phase 5 — dispatch implementer (plan.md)\n- Open decisions: none\n- Artifacts: plan.md\n- Suite: green @ abc1234\n' | run digest write - --branch feat/x >/dev/null
if grep -q 'green @ abc1234' "$ckpt"; then ok; else fail "digest write: content not written"; fi
if [ "$(grep -c '^## Resume digest$' "$ckpt")" = "1" ]; then ok; else fail "digest write: section must be replaced, not appended"; fi
seq 1 60 | sed 's/^/- line /' | run digest write - --branch feat/x >/dev/null 2>&1
dlines="$(awk '/^## Resume digest$/{f=1; next} /^## /{f=0} f' "$ckpt" | grep -c '^- ' || true)"
if [ "$dlines" -le 30 ]; then ok; else fail "digest write: cap not enforced ($dlines lines kept)"; fi

# --- slice ledger ----------------------------------------------------------
cat > "$tmp/slices-in.json" <<'EOF'
{"schema":1,"planPath":"plan.md","planSha256":"deadbeef","slices":[
 {"id":1,"title":"endpoint","repo":null,"estLoc":100,"parallelGroup":1,"dependsOn":[],"touchpoints":["a.ts"],"acceptance":["POST returns 202"],"status":"pending","commit":null},
 {"id":2,"title":"ui","repo":null,"estLoc":80,"parallelGroup":2,"dependsOn":[1],"touchpoints":["b.tsx"],"acceptance":["button renders"],"status":"pending","commit":null}]}
EOF
run slice init "$tmp/slices-in.json" --branch feat/x >/dev/null
if [ -f "$ORC_STATE_DIR/feat-x/files/slices.json" ]; then ok; else fail "slice init: slices.json not installed"; fi
run slice set 1 --status committed --commit abc1234 --branch feat/x >/dev/null
if jq -e '.slices[0].status == "committed" and .slices[0].commit == "abc1234"' "$ORC_STATE_DIR/feat-x/files/slices.json" >/dev/null; then ok; else fail "slice set: status/commit not recorded"; fi
if run slice set 1 --status flying --branch feat/x >/dev/null 2>&1; then fail "slice set: must reject status outside the machine"; else ok; fi
# completion query: exit 1 while matches remain, 0 when none match
if run slice list --status pending,red,escalated --branch feat/x >/dev/null; then fail "slice list: must exit 1 while slice 2 is pending"; else ok; fi
run slice set 2 --status committed --commit def5678 --branch feat/x >/dev/null
if run slice list --status pending,red,escalated --branch feat/x >/dev/null; then ok; else fail "slice list: must exit 0 when the filter matches nothing"; fi

# --- verify ----------------------------------------------------------------
if run verify feat-x >/dev/null 2>&1; then ok; else fail "verify: healthy session must pass"; fi
jq '(.sessions[0].phase) = 99' "$reg" > "$reg.tmp" && mv "$reg.tmp" "$reg"
if run verify feat-x >/dev/null 2>&1; then fail "verify: must flag registry/checkpoint mismatch"; else ok; fi
jq '(.sessions[0].phase) = "done"' "$reg" > "$reg.tmp" && mv "$reg.tmp" "$reg"

# --- migrate: legacy vocabulary -> schema 1 --------------------------------
cat > "$reg" <<'EOF'
{"sessions":[{"branch":"old-x","gitBranch":"old/x","command":"debug","description":"legacy",
 "session_id":"ulid123","current_phase":3,"total_phases":6,"status":"in_progress",
 "created_at":"2026-01-01T00:00:00Z","phase":"released-thing"}]}
EOF
run migrate >/dev/null
if jq -e '.schema == 1' "$reg" >/dev/null; then ok; else fail "migrate: must stamp schema: 1"; fi
if jq -e '.sessions[0].sessionId == "old-x"' "$reg" >/dev/null; then ok; else fail "migrate: sessionId must come from sanitized branch, not legacy session_id"; fi
if jq -e '.sessions[0].phase == 3 and .sessions[0].phaseLabel == "released-thing"' "$reg" >/dev/null; then ok; else fail "migrate: current_phase -> phase int; string phase -> phaseLabel"; fi
if jq -e '.sessions[0] | has("session_id") or has("current_phase") or has("created_at") or has("total_phases")' "$reg" >/dev/null; then fail "migrate: banned legacy keys must be removed"; else ok; fi
if jq -e '.sessions[0].totalPhases == 6' "$reg" >/dev/null; then ok; else fail "migrate: total_phases -> totalPhases"; fi
if jq -e '.sessions[0].startedAt == "2026-01-01T00:00:00Z"' "$reg" >/dev/null; then ok; else fail "migrate: created_at -> startedAt"; fi

if [ "$status" -eq 0 ]; then
  echo "verify-state-protocol: OK ($pass_count cases)"
fi
exit "$status"
