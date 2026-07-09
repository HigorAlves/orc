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

# Detect workspace vs repo vs loose. The hook is its own short-lived process,
# so detection runs in the main shell — the vars feed the banner, the env-file
# persistence, and the session title below.
context_banner=""
session_title=""
if [ -f "${PLUGIN_ROOT}/lib/workspace-detect.sh" ]; then
  # shellcheck disable=SC1091
  . "${PLUGIN_ROOT}/lib/workspace-detect.sh"
  cd "$session_cwd" 2>/dev/null || true
  eval "$(orc_detect_context)"
  context_banner="$(orc_context_banner)"

  # Persist detection into every subsequent Bash call — the memoization in
  # workspace-detect.sh finally works session-wide instead of dying with
  # each fresh subshell. Re-appends on resume/clear/compact are idempotent
  # (last export wins).
  if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
    {
      printf 'export ORC_CONTEXT=%q\n'         "${ORC_CONTEXT:-loose}"
      printf 'export ORC_REPO_ROOT=%q\n'       "${ORC_REPO_ROOT:-}"
      printf 'export ORC_WORKSPACE_ROOT=%q\n'  "${ORC_WORKSPACE_ROOT:-}"
      printf 'export ORC_WORKSPACE_NAME=%q\n'  "${ORC_WORKSPACE_NAME:-}"
      printf 'export ORC_WORKSPACE_REPOS=%q\n' "${ORC_WORKSPACE_REPOS:-}"
      printf 'export ORC_STATE_DIR=%q\n'       "${ORC_STATE_DIR:-}"
      printf 'export ORC_CONTEXT_CACHED=1\n'
      printf 'export ORC_CONTEXT_CACHED_PWD=%q\n' "$(pwd -P 2>/dev/null || pwd)"
    } >> "$CLAUDE_ENV_FILE"
  fi

  # Session title from the active orc session, when one exists for this
  # context (prefer the current branch's session, else the freshest live
  # one). Only honored by Claude Code on startup|resume sources; harmless
  # elsewhere.
  if [ -n "${ORC_STATE_DIR:-}" ] && [ -f "${ORC_STATE_DIR}/orc.json" ] && command -v jq >/dev/null 2>&1; then
    current_branch="$(git -C "$session_cwd" branch --show-current 2>/dev/null || true)"
    session_title="$(jq -r --arg b "$current_branch" '
      ([.sessions[]? | select(.status == "in_progress")]) as $live
      | (($live | map(select(.gitBranch == $b or .branch == $b)) | sort_by(.updated_at // .startedAt // "") | last)
         // ($live | sort_by(.updated_at // .startedAt // "") | last))
      | if . then "orc: \(.command // "session") \(.gitBranch // .branch) [\(.phase // "?")]" else empty end
    ' "${ORC_STATE_DIR}/orc.json" 2>/dev/null || true)"
  fi
fi

banner_section=""
if [ -n "$context_banner" ]; then
  banner_section="**orc context (auto-detected at session start):**
${context_banner}

"
fi

session_context="<EXTREMELY_IMPORTANT>
You have orc.

${banner_section}**Below are the core rules of orc (your 'orc:using-orc' skill) — your introduction to using orc skills. For all other skills, use the 'Skill' tool:**

${using_orc_content}
</EXTREMELY_IMPORTANT>"

# jq owns the JSON encoding — it's a hard required dependency; if it's
# absent, degrade silently (the tool-check hook reports the missing dep).
command -v jq >/dev/null 2>&1 || exit 0
jq -n --arg ctx "$session_context" --arg title "${session_title:-}" '{
  hookSpecificOutput: ({
    hookEventName: "SessionStart",
    additionalContext: $ctx
  } + (if $title != "" then {sessionTitle: $title} else {} end))
}'

exit 0
