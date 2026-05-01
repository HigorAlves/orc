#!/usr/bin/env bash
# SessionStart hook for orc plugin.
# Injects the using-orc skill content as additional session context, so
# the model sees the iron rules + skill catalog before its first response.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
PLUGIN_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

using_orc_content=$(cat "${PLUGIN_ROOT}/skills/using-orc/SKILL.md" 2>&1 || echo "Error reading using-orc skill")

# JSON-escape the skill body using bash parameter substitution.
escape_for_json() {
    local s="$1"
    s="${s//\\/\\\\}"
    s="${s//\"/\\\"}"
    s="${s//$'\n'/\\n}"
    s="${s//$'\r'/\\r}"
    s="${s//$'\t'/\\t}"
    printf '%s' "$s"
}

using_orc_escaped=$(escape_for_json "$using_orc_content")
session_context="<EXTREMELY_IMPORTANT>\nYou have orc.\n\n**Below is the full content of your 'orc:using-orc' skill — your introduction to using orc skills. For all other skills, use the 'Skill' tool:**\n\n${using_orc_escaped}\n</EXTREMELY_IMPORTANT>"

# Claude Code hooks expect hookSpecificOutput.additionalContext;
# other platforms expect additional_context.
if [ -n "${CLAUDE_PLUGIN_ROOT:-}" ]; then
  cat <<EOF
{
  "hookSpecificOutput": {
    "hookEventName": "SessionStart",
    "additionalContext": "${session_context}"
  }
}
EOF
else
  cat <<EOF
{
  "additional_context": "${session_context}"
}
EOF
fi

exit 0
