#!/usr/bin/env bash
# SessionStart hook for orc plugin.
# Injects the using-orc skill content as additional session context, so
# the model sees the iron rules + skill catalog before its first response.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
PLUGIN_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

using_orc_content=$(cat "${PLUGIN_ROOT}/skills/using-orc/SKILL.md" 2>&1 || echo "Error reading using-orc skill")

# Read cwd from the SessionStart payload (Claude Code passes one-line JSON on
# stdin; jq is required by the orc tool-check hook so it's safe to depend on).
session_payload=""
if [ ! -t 0 ]; then
  session_payload="$(cat 2>/dev/null || true)"
fi
session_cwd=""
if [ -n "$session_payload" ] && command -v jq >/dev/null 2>&1; then
  session_cwd="$(printf '%s' "$session_payload" | jq -r '.cwd // empty' 2>/dev/null || true)"
fi
[ -z "$session_cwd" ] && session_cwd="$PWD"

# Detect workspace vs repo vs loose. The helper emits KEY=VALUE lines; we
# evaluate them in a subshell so the hook stays free of side effects.
context_banner=""
if [ -f "${PLUGIN_ROOT}/lib/workspace-detect.sh" ]; then
  context_banner=$(
    cd "$session_cwd" 2>/dev/null || cd "$PWD"
    # shellcheck disable=SC1091
    . "${PLUGIN_ROOT}/lib/workspace-detect.sh"
    eval "$(orc_detect_context)"
    case "${ORC_CONTEXT:-loose}" in
      workspace)
        printf 'orc context: workspace[%s] — repos: %s — state: %s\n' \
          "${ORC_WORKSPACE_NAME}" "${ORC_WORKSPACE_REPOS}" "${ORC_STATE_DIR}"
        printf 'In workspace mode, repo-scoped commands prompt for --repos/--repo before broadcasting; pass --this-repo to scope to cwd, --all-repos to fan out.\n'
        ;;
      repo)
        printf 'orc context: repo — root: %s — state: %s\n' \
          "${ORC_REPO_ROOT}" "${ORC_STATE_DIR}"
        ;;
      loose)
        printf 'orc context: loose — cwd is neither a git repo nor a workspace parent (no .orc state will be written here).\n'
        ;;
    esac
  )
fi

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
context_banner_escaped=""
if [ -n "$context_banner" ]; then
  context_banner_escaped=$(escape_for_json "$context_banner")
  context_banner_escaped="**orc context (auto-detected at session start):**\n${context_banner_escaped}\n\n"
fi
session_context="<EXTREMELY_IMPORTANT>\nYou have orc.\n\n${context_banner_escaped}**Below are the core rules of orc (your 'orc:using-orc' skill) — your introduction to using orc skills. For all other skills, use the 'Skill' tool:**\n\n${using_orc_escaped}\n</EXTREMELY_IMPORTANT>"

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
