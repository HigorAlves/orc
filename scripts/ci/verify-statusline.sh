#!/usr/bin/env bash
# Smoke tests for bin/orc-statusline — the two-line session status renderer.
# Fixtures pipe mock stdin payloads (the documented statusLine JSON contract)
# into the real binary with controlled COLUMNS/NO_COLOR/TMPDIR and assert on
# ANSI-stripped output. Every fixture asserts exit 0: a statusline must never
# die mid-render. Run from the repo root.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
sl="$repo_root/orc/bin/orc-statusline"
orc_state="$repo_root/orc/bin/orc-state"

status=0
fail() { echo "verify-statusline: FAIL — $1"; status=1; }
pass_count=0
ok() { pass_count=$((pass_count + 1)); }

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
export TMPDIR="$tmp/t"
mkdir -p "$TMPDIR"
unset NO_COLOR ORC_STATE_DIR ORC_CONTEXT_CACHED 2>/dev/null || true
export LANG="en_US.UTF-8"
export COLUMNS=100

strip_ansi() { sed $'s/\x1b\\[[0-9;]*m//g'; }

# --- fixtures: repos -------------------------------------------------------
mk_repo() { # $1 = dir, $2 = branch
  git init -q -b "$2" "$1"
  git -C "$1" -c user.email=t@t -c user.name=t commit -q --allow-empty -m init
}
repo_a="$tmp/repo-a"; mk_repo "$repo_a" feat/checkout-retry
echo dirty > "$repo_a/f.txt"   # untracked -> dirty
repo_b="$tmp/repo-b"; mk_repo "$repo_b" fix/login-null-guard
repo_c="$tmp/repo-c"; mk_repo "$repo_c" old/x
repo_d="$tmp/repo-d"; mk_repo "$repo_d" fix/guard
loose="$tmp/loose"; mkdir -p "$loose"

# orc session in repo-a: flow 6/9 implement, jira, 3-of-7 slices done
export ORC_STATE_DIR="$repo_a/.orc"
"$orc_state" init --command flow --total-phases 9 --branch feat/checkout-retry --description t >/dev/null
"$orc_state" phase set 6 --label implement --branch feat/checkout-retry >/dev/null
"$orc_state" jira bind PROJ-142 --branch feat/checkout-retry >/dev/null
cat > "$tmp/slices.json" <<'EOF'
{"schema":1,"planPath":"plan.md","planSha256":"x","slices":[
 {"id":1,"title":"a","status":"committed"},{"id":2,"title":"b","status":"committed"},
 {"id":3,"title":"c","status":"skipped"},{"id":4,"title":"d","status":"pending"},
 {"id":5,"title":"e","status":"red"},{"id":6,"title":"f","status":"pending"},
 {"id":7,"title":"g","status":"pending"}]}
EOF
"$orc_state" slice init "$tmp/slices.json" --branch feat/checkout-retry >/dev/null
unset ORC_STATE_DIR

# legacy hand-written registry in repo-c (pre-schema-1 vocabulary)
mkdir -p "$repo_c/.orc"
cat > "$repo_c/.orc/orc.json" <<'EOF'
{"sessions":[{"branch":"old-x","gitBranch":"old/x","status":"in_progress","phase":"done","startedAt":"2026-01-01T00:00:00Z"}]}
EOF

payload() { # $1 = current_dir, $2 = session_id, rest = extra jq object text
  local dir="$1" sid="$2" extra="${3:-{\}}"
  jq -n --arg dir "$dir" --arg sid "$sid" --argjson extra "$extra" '
    {
      session_id: $sid,
      cwd: $dir,
      workspace: {current_dir: $dir, project_dir: $dir},
      model: {id: "claude-opus-5", display_name: "Opus 4.5"},
      version: "2.1.227"
    } * $extra'
}

FULL_EXTRA='{
  "effort":{"level":"high"},"thinking":{"enabled":true},
  "context_window":{"used_percentage":68,"remaining_percentage":32,"context_window_size":200000,"current_usage":null},
  "cost":{"total_cost_usd":4.83,"total_lines_added":412,"total_lines_removed":88},
  "rate_limits":{"five_hour":{"used_percentage":71,"resets_at":1774980000}},
  "pr":{"number":128,"url":"https://github.com/o/r/pull/128","review_state":"approved"}
}'

# --- 1: full orc session render -------------------------------------------
out="$(payload "$repo_a" sl-fix-1 "$FULL_EXTRA" | "$sl")" ; rc=$?
plain="$(printf '%s' "$out" | strip_ansi)"
if [ "$rc" -eq 0 ]; then ok; else fail "1: rc=$rc"; fi
for needle in "flow 6/9 implement" "PROJ-142" "3/7" "feat/checkout-retry*" "#128" "approved" "Opus 4.5" "high" "68%" "\$4.83" "71%"; do
  if printf '%s' "$plain" | grep -qF "$needle"; then ok; else fail "1: missing '$needle' in: $plain"; fi
done
if [ "$(printf '%s\n' "$plain" | wc -l | tr -d ' ')" = "2" ]; then ok; else fail "1: expected two lines"; fi

# --- 2: plain repo, no session, PR changes-requested -----------------------
out="$(payload "$repo_b" sl-fix-2 '{"pr":{"number":77,"review_state":"changes_requested"},"context_window":{"used_percentage":31},"cost":{"total_cost_usd":0.92,"total_lines_added":58,"total_lines_removed":12}}' | "$sl")"
plain="$(printf '%s' "$out" | strip_ansi)"
if printf '%s' "$plain" | grep -qF "#77"; then ok; else fail "2: missing #77"; fi
if printf '%s' "$plain" | grep -qF "changes"; then ok; else fail "2: missing changes marker"; fi
if printf '%s' "$plain" | grep -qF "fix/login-null-guard"; then ok; else fail "2: missing branch"; fi
if printf '%s' "$plain" | grep -qF "flow"; then fail "2: phantom orc session"; else ok; fi

# --- 3: absent fields (repo-d: branch name must not contain 'null') --------
out="$(payload "$repo_d" sl-fix-3 '{}' | "$sl")"; rc=$?
plain="$(printf '%s' "$out" | strip_ansi)"
if [ "$rc" -eq 0 ]; then ok; else fail "3: rc=$rc"; fi
if [ -n "$plain" ]; then ok; else fail "3: empty output"; fi
if printf '%s' "$plain" | grep -qw "null"; then fail "3: literal null leaked: $plain"; else ok; fi

# --- 4: used_percentage present w/ null current_usage; then absent ctx -----
out="$(payload "$repo_b" sl-fix-4 '{"context_window":{"used_percentage":42,"current_usage":null}}' | "$sl" | strip_ansi)"
if printf '%s' "$out" | grep -qF "42%"; then ok; else fail "4: pct not rendered"; fi
out="$(payload "$repo_b" sl-fix-4b '{}' | "$sl" | strip_ansi)"
if printf '%s' "$out" | grep -qF "ctx"; then fail "4b: ctx segment must drop when context_window absent"; else ok; fi

# --- 5: NO_COLOR -----------------------------------------------------------
out="$(payload "$repo_a" sl-fix-5 "$FULL_EXTRA" | NO_COLOR=1 "$sl")"
if printf '%s' "$out" | grep -q $'\x1b'; then fail "5: ANSI bytes under NO_COLOR"; else ok; fi
if printf '%s' "$out" | grep -qF "["; then ok; else fail "5: ASCII bar missing"; fi

# --- 6: narrow terminal ----------------------------------------------------
out="$(payload "$repo_a" sl-fix-6 "$FULL_EXTRA" | COLUMNS=60 "$sl" | strip_ansi)"
if [ "$(printf '%s\n' "$out" | wc -l | tr -d ' ')" = "1" ]; then ok; else fail "6: expected single line at COLUMNS=60, got: $out"; fi
w="$(printf '%s' "$out" | wc -m | tr -d ' ')"
if [ "$w" -le 60 ]; then ok; else fail "6: line width $w > 60"; fi

# --- 7: loose dir ----------------------------------------------------------
out="$(payload "$loose" sl-fix-7 '{"context_window":{"used_percentage":9},"cost":{"total_cost_usd":0.04}}' | "$sl")"; rc=$?
if [ "$rc" -eq 0 ]; then ok; else fail "7: rc=$rc"; fi
if printf '%s' "$out" | strip_ansi | grep -qF "Opus 4.5"; then ok; else fail "7: machine line missing in loose dir"; fi

# --- 8: garbage + empty stdin ---------------------------------------------
out="$(printf 'not json at all' | "$sl" 2>"$tmp/err8")"; rc=$?
if [ "$rc" -eq 0 ]; then ok; else fail "8: garbage stdin rc=$rc"; fi
if [ -s "$tmp/err8" ]; then fail "8: stderr noise on garbage: $(cat "$tmp/err8")"; else ok; fi
out="$(printf '' | "$sl" 2>"$tmp/err8b")"; rc=$?
if [ "$rc" -eq 0 ]; then ok; else fail "8b: empty stdin rc=$rc"; fi
if [ -s "$tmp/err8b" ]; then fail "8b: stderr noise on empty"; else ok; fi

# --- 9: legacy session entry ----------------------------------------------
out="$(payload "$repo_c" sl-fix-9 '{}' | "$sl")"; rc=$?
plain="$(printf '%s' "$out" | strip_ansi)"
if [ "$rc" -eq 0 ]; then ok; else fail "9: rc=$rc"; fi
if printf '%s' "$plain" | grep -qw "null"; then fail "9: legacy null leaked: $plain"; else ok; fi
if printf '%s' "$plain" | grep -qF "session done"; then ok; else fail "9: legacy session not rendered: $plain"; fi

# --- 10: bridge file -------------------------------------------------------
payload "$repo_a" sl-fix-10 "$FULL_EXTRA" | "$sl" >/dev/null
bridge="$TMPDIR/orc-ctx-sl-fix-10.json"
if [ -f "$bridge" ]; then ok; else fail "10: bridge file missing at $bridge"; fi
if [ "$(wc -l < "$bridge" | tr -d ' ')" -le 1 ]; then ok; else fail "10: bridge must be one line"; fi
perms="$(stat -f %Lp "$bridge" 2>/dev/null || stat -c %a "$bridge" 2>/dev/null)"
if [ "$perms" = "600" ]; then ok; else fail "10: bridge perms $perms != 600"; fi
if jq -e '.schema == 1 and .raw_pct == 68 and .tier == "yellow"' "$bridge" >/dev/null 2>&1; then ok; else fail "10: bridge content wrong: $(cat "$bridge")"; fi

# --- 13: perf guard (5 renders well under budget) --------------------------
start="$(date +%s)"
for _ in 1 2 3 4 5; do payload "$repo_a" sl-fix-13 "$FULL_EXTRA" | "$sl" >/dev/null; done
elapsed=$(( $(date +%s) - start ))
if [ "$elapsed" -le 2 ]; then ok; else fail "13: 5 renders took ${elapsed}s (>2s) — subprocess regression"; fi

if [ "$status" -eq 0 ]; then
  echo "verify-statusline: OK ($pass_count cases)"
fi
exit "$status"
