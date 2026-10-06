#!/usr/bin/env bash
# PreCompact: write a mechanical auto-checkpoint (phase, slices, HEAD, dirty
# files) for the live orc session before the transcript is summarized, so
# /orc:resume always has fresh state. Subagent compactions are skipped. Never
# blocks compaction: every failure path exits 0 silently.
set -uo pipefail

input=$(cat)
[ -z "$(printf '%s' "$input" | jq -r '.agent_id // empty' 2>/dev/null)" ] || exit 0
trigger=$(printf '%s' "$input" | jq -r '.trigger // "auto"' 2>/dev/null || echo auto)
cwd=$(printf '%s' "$input" | jq -r '.cwd // empty' 2>/dev/null || true)
if [ -n "$cwd" ]; then cd "$cwd" 2>/dev/null || exit 0; fi

orc_state="${CLAUDE_PLUGIN_ROOT:-$(cd "$(dirname "$0")/../.." && pwd)}/bin/orc-state"
"$orc_state" current >/dev/null 2>&1 || exit 0
"$orc_state" checkpoint --auto --trigger "$trigger" >/dev/null 2>&1 || true
exit 0
