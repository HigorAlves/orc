#!/usr/bin/env bash
# SessionStart hook for ORC Gemini CLI.
# Injects the orc-core skill content as additional session context.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
GEMINI_SKILLS_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Read orc-core content
orc_core_content=$(cat "${GEMINI_SKILLS_ROOT}/orc-core/SKILL.md" 2>&1 || echo "Error reading orc-core skill")

# Detect context (reusing workspace-detect.sh if possible)
# Note: For now we'll just provide the skill content. 
# We can add full workspace detection later if the user requests it.

# JSON-escape function
escape_for_json() {
    local s="$1"
    s="${s//\\/\\\\}"
    s="${s//\"/\\\"}"
    s="${s//$'\n'/\\n}"
    s="${s//$'\r'/\\r}"
    s="${s//$'\t'/\\t}"
    printf '%s' "$s"
}

orc_core_escaped=$(escape_for_json "$orc_core_content")

# Gemini CLI expects additional_context key
cat <<EOF
{
  "additional_context": "<EXTREMELY_IMPORTANT>\nYou have ORC (Gemini CLI version).\n\n**Below are the core iron rules of ORC:**\n\n${orc_core_escaped}\n</EXTREMELY_IMPORTANT>"
}
EOF

exit 0
