#!/usr/bin/env bash
# PostToolUse hook: advisory context warnings for the AGENT, fed by the
# statusline bridge file — statusLine is the only surface that receives
# context_window, so the renderer writes it where this hook can read it
# (${TMPDIR}/orc-ctx-<session_id>.json, one shared tier scale by
# construction: the tier is computed once, by lib/statusline.sh).
#
# Discipline: common path is one existence check (~1ms). Warnings fire at
# red/critical only, once per tier per session (critical escalates past a
# red warning), never on a stale file, and the wording stays ADVISORY —
# it informs; it never overrides what the user asked the agent to do.
set -euo pipefail

input=$(cat 2>/dev/null || true)
sid=$(printf '%s' "$input" | jq -r '.session_id // empty' 2>/dev/null || true)
[ -n "$sid" ] || exit 0

f="${TMPDIR:-/tmp}/orc-ctx-${sid}.json"
[ -f "$f" ] || exit 0

ts=""; tier=""; eff=""; warned=""
eval "$(jq -r '
  def s(v): (v // "") | tostring | @sh;
  "ts=" + s(.ts), "tier=" + s(.tier), "eff=" + s(.effective_pct), "warned=" + s(.warned_tier)
' "$f" 2>/dev/null || true)"
[ -n "$ts" ] || exit 0
[ $(( $(date +%s) - ts )) -le 120 ] || exit 0   # stale bridge → no opinion

rank() { case "$1" in critical) echo 3 ;; red) echo 2 ;; yellow) echo 1 ;; *) echo 0 ;; esac; }
t="$(rank "$tier")"
w="$(rank "$warned")"
[ "$t" -ge 2 ] || exit 0    # only red/critical warrant the agent's attention
[ "$t" -gt "$w" ] || exit 0 # once per tier; escalation jumps the queue

msg="Context is at ${eff}% (orc statusline). Consider checkpointing (orc-state digest write -), committing completed work, or bringing the current phase to a clean stopping point — avoid starting large new reads. Inform the user; do not autonomously write handoff files unless they ask."
jq -n --arg ctx "$msg" '{
  hookSpecificOutput: {
    hookEventName: "PostToolUse",
    additionalContext: $ctx
  }
}'

# Debounce: record the tier we just warned at (atomic, best-effort).
if jq --arg w "$tier" '.warned_tier = $w' "$f" > "$f.tmp" 2>/dev/null; then
  mv "$f.tmp" "$f" 2>/dev/null || true
fi
exit 0
