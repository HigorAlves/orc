#!/usr/bin/env bash
# SessionStart hook: pre-flight check for CLI dependencies orc relies on.
# If anything's missing, surfaces a warning to the user via the top-level
# `systemMessage` field — Claude Code renders this DIRECTLY (once per
# session), so the callout's coloring no longer depends on the model
# faithfully re-emitting the markdown. A short, neutral note still goes to
# the model's context so it can offer install help if the user asks.
# Silent (exit 0 with no output fields) when everything's present.
#
# The tool set (names, tiers), install hints, and "used by" notes are read
# from the canonical registry lib/tools.json — the SAME file the orc installer
# CLI embeds (cli/internal/deps/tools.json, kept identical by CI). This keeps
# the two consumers from drifting. jq is required to read it; in the one case
# where jq itself is missing we fall back to a minimal hardcoded notice, since
# we cannot parse JSON without it.
#
# Suppress the check entirely with: ORC_SKIP_TOOL_CHECK=1, or the plugin
# userConfig `skip_tool_check` (exported as CLAUDE_PLUGIN_OPTION_SKIP_TOOL_CHECK).
#
# Testing seam: ORC_TOOLCHECK_PRESENT="git jq" forces exactly those tools to be
# considered present (bypassing command -v). Used by the hook's tests.

set -euo pipefail

# Honor the suppression env var and the userConfig option.
if [ "${ORC_SKIP_TOOL_CHECK:-}" = "1" ]; then
  exit 0
fi
case "${CLAUDE_PLUGIN_OPTION_SKIP_TOOL_CHECK:-}" in
  1|true|True) exit 0 ;;
esac

# Locate the canonical tool registry.
if [ -n "${CLAUDE_PLUGIN_ROOT:-}" ]; then
  TOOLS_JSON="${CLAUDE_PLUGIN_ROOT}/lib/tools.json"
else
  TOOLS_JSON="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)/lib/tools.json"
fi

# is_present respects the ORC_TOOLCHECK_PRESENT testing seam when set.
is_present() {
  if [ -n "${ORC_TOOLCHECK_PRESENT+x}" ]; then
    case " $ORC_TOOLCHECK_PRESENT " in
      *" $1 "*) return 0 ;;
      *) return 1 ;;
    esac
  fi
  command -v "$1" >/dev/null 2>&1
}

# ---------------------------------------------------------------------------
# jq-missing fallback: we cannot read tools.json without jq. Emit a minimal,
# correct notice built only from `command -v`, keyed on the known tool set.
# ---------------------------------------------------------------------------
if ! command -v jq >/dev/null 2>&1; then
  # jq is a REQUIRED tool, so its absence is itself the headline.
  esc() {
    local s="$1"
    s="${s//\\/\\\\}"; s="${s//\"/\\\"}"; s="${s//$'\n'/\\n}"
    s="${s//$'\r'/\\r}"; s="${s//$'\t'/\\t}"
    printf '%s' "$s"
  }
  warn=$'> **🛑 orc tool check**\n>\n> **Missing required**:\n> - `jq` — install jq, then restart the session for the full tool check.\n>\n> _Set `ORC_SKIP_TOOL_CHECK=1` to suppress this notice._'
  note="orc tool check (SessionStart): jq is missing, which orc needs to run its full dependency check. The user has been shown a notice. Offer install help only if asked."
  cat <<EOF
{
  "systemMessage": "$(esc "$warn")",
  "hookSpecificOutput": {
    "hookEventName": "SessionStart",
    "additionalContext": "$(esc "$note")"
  }
}
EOF
  exit 0
fi

# ---------------------------------------------------------------------------
# Normal path: jq is available. Read the tool set + hints from tools.json.
# ---------------------------------------------------------------------------
if [ ! -f "$TOOLS_JSON" ]; then
  # Registry missing (shouldn't happen in a valid install) — stay silent
  # rather than emit a broken warning.
  exit 0
fi

# Detect platform for install-hint accuracy (mirrors cli/internal/platform).
platform="unknown"
case "$(uname -s)" in
  Darwin) platform="macos" ;;
  Linux)
    if command -v apt-get >/dev/null 2>&1; then platform="debian"
    elif command -v dnf >/dev/null 2>&1; then platform="fedora"
    elif command -v pacman >/dev/null 2>&1; then platform="arch"
    else platform="linux"
    fi
    ;;
esac

# Pull the tool names per tier from the registry. A while-read loop (rather
# than mapfile) keeps this compatible with the bash 3.2 that ships on macOS.
required=()
while IFS= read -r line; do [ -n "$line" ] && required+=("$line"); done \
  < <(jq -r '.tools[] | select(.tier=="required") | .name' "$TOOLS_JSON")
recommended=()
while IFS= read -r line; do [ -n "$line" ] && recommended+=("$line"); done \
  < <(jq -r '.tools[] | select(.tier=="recommended") | .name' "$TOOLS_JSON")

hint_for() {
  jq -r --arg n "$1" --arg p "$platform" \
    '(.tools[] | select(.name==$n) | .hints) as $h | ($h[$p] // $h.default)' "$TOOLS_JSON"
}
usedby_for() {
  jq -r --arg n "$1" '(.tools[] | select(.name==$n) | .usedBy) // ""' "$TOOLS_JSON"
}

missing_required=()
missing_recommended=()
for cmd in "${required[@]}"; do
  is_present "$cmd" || missing_required+=("$cmd")
done
for cmd in "${recommended[@]}"; do
  is_present "$cmd" || missing_recommended+=("$cmd")
done

# Everything present — silent exit, no context to inject.
if [ ${#missing_required[@]} -eq 0 ] && [ ${#missing_recommended[@]} -eq 0 ]; then
  exit 0
fi

# Build the human-readable warning body. Terminal form of the orc:insights
# palette: emoji-header blockquote, no [!TYPE] tag — the TUI doesn't parse
# GitHub alert types and would print the tag as junk text.
build_block() {
  if [ ${#missing_required[@]} -gt 0 ]; then
    printf "> **🛑 orc tool check**\n"
  else
    printf "> **⚠️ Caution — orc tool check**\n"
  fi
  printf ">\n"
  if [ ${#missing_required[@]} -gt 0 ]; then
    printf "> **Missing required** (orc hooks/commands break without these):\n"
    for cmd in "${missing_required[@]}"; do
      printf "> - \`%s\` — %s\n" "$cmd" "$(hint_for "$cmd")"
    done
    printf ">\n"
  fi
  if [ ${#missing_recommended[@]} -gt 0 ]; then
    printf "> **Missing recommended** (some commands won't work):\n"
    for cmd in "${missing_recommended[@]}"; do
      printf "> - \`%s\` — %s\n" "$cmd" "$(hint_for "$cmd")"
      usedby=$(usedby_for "$cmd")
      [ -n "$usedby" ] && printf ">     - Used by: %s\n" "$usedby"
    done
    printf ">\n"
  fi
  printf "> _Set \`ORC_SKIP_TOOL_CHECK=1\` to suppress this notice._\n"
}

warning_block=$(build_block)

# The user-facing warning goes in the top-level `systemMessage` field —
# Claude Code displays it directly to the user (once, at session start),
# independent of the model. A short, neutral note goes to the model's
# context so it can offer install help if the user asks.
req_list="none"
[ ${#missing_required[@]} -gt 0 ] && req_list="${missing_required[*]}"
rec_list="none"
[ ${#missing_recommended[@]} -gt 0 ] && rec_list="${missing_recommended[*]}"
model_note="orc tool check (SessionStart): some CLI dependencies are missing — required: ${req_list}; recommended: ${rec_list}. The user has already been shown install hints directly. Do not re-print the warning; offer install help only if asked."

jq -n --arg warn "$warning_block" --arg note "$model_note" '{
  systemMessage: $warn,
  hookSpecificOutput: {
    hookEventName: "SessionStart",
    additionalContext: $note
  }
}'

exit 0
