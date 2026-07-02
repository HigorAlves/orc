#!/usr/bin/env bash
# SessionStart hook: pre-flight check for CLI dependencies orc relies on.
# If anything's missing, surfaces a warning to the user via the top-level
# `systemMessage` field — Claude Code renders this DIRECTLY (once per
# session), so the callout's coloring no longer depends on the model
# faithfully re-emitting the markdown. A short, neutral note still goes to
# the model's context so it can offer install help if the user asks.
# Silent (exit 0 with no output fields) when everything's present.
#
# Suppress the check entirely with: ORC_SKIP_TOOL_CHECK=1

set -euo pipefail

# Honor the suppression env var.
if [ "${ORC_SKIP_TOOL_CHECK:-}" = "1" ]; then
  exit 0
fi

# Required (orc's core hooks/commands break without these).
REQUIRED=("git" "jq")
# Strongly recommended (specific commands fail without them, but the rest of
# the plugin still works).
RECOMMENDED=("gh" "agent-browser" "acli")

missing_required=()
missing_recommended=()

for cmd in "${REQUIRED[@]}"; do
  command -v "$cmd" >/dev/null 2>&1 || missing_required+=("$cmd")
done
for cmd in "${RECOMMENDED[@]}"; do
  command -v "$cmd" >/dev/null 2>&1 || missing_recommended+=("$cmd")
done

# Everything present — silent exit, no context to inject.
if [ ${#missing_required[@]} -eq 0 ] && [ ${#missing_recommended[@]} -eq 0 ]; then
  exit 0
fi

# Detect platform for install-hint accuracy.
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

# Build per-tool install hints.
hint_for() {
  case "$1" in
    git)
      case "$platform" in
        macos) echo "xcode-select --install  (or: brew install git)" ;;
        debian) echo "sudo apt-get install -y git" ;;
        fedora) echo "sudo dnf install -y git" ;;
        arch) echo "sudo pacman -S git" ;;
        *) echo "see https://git-scm.com/downloads" ;;
      esac
      ;;
    jq)
      case "$platform" in
        macos) echo "brew install jq" ;;
        debian) echo "sudo apt-get install -y jq" ;;
        fedora) echo "sudo dnf install -y jq" ;;
        arch) echo "sudo pacman -S jq" ;;
        *) echo "see https://jqlang.github.io/jq/download/" ;;
      esac
      ;;
    gh)
      case "$platform" in
        macos) echo "brew install gh && gh auth login" ;;
        debian) echo "see https://github.com/cli/cli/blob/trunk/docs/install_linux.md (apt) — then: gh auth login" ;;
        fedora) echo "sudo dnf install -y gh && gh auth login" ;;
        arch) echo "sudo pacman -S github-cli && gh auth login" ;;
        *) echo "see https://cli.github.com/  — then: gh auth login" ;;
      esac
      ;;
    agent-browser)
      echo "npm install -g agent-browser && agent-browser install"
      ;;
    acli)
      case "$platform" in
        macos) echo "brew install --cask atlassian-acli  — then: acli jira auth login --web" ;;
        debian|fedora|arch|linux) echo "see https://developer.atlassian.com/cloud/acli/guides/how-to-get-started/  — then: acli jira auth login --web" ;;
        *) echo "see https://developer.atlassian.com/cloud/acli/guides/how-to-get-started/" ;;
      esac
      ;;
    *)
      echo "see your distro's package manager"
      ;;
  esac
}

# Build the human-readable warning body. Wrapped in a GitHub-flavored
# WARNING callout so Claude Code renders it with a colored left bar
# (typically yellow/amber) instead of plain white text. Emitted via
# `systemMessage` (see below) so the harness renders it directly rather
# than relying on the model to reproduce the callout. Degrades gracefully
# to a labeled blockquote if the renderer doesn't theme callouts.
build_block() {
  if [ ${#missing_required[@]} -gt 0 ]; then
    printf "> [!CAUTION]\n"
    printf "> **🛑 orc tool check**\n"
  else
    printf "> [!WARNING]\n"
    printf "> **⚠️ orc tool check**\n"
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
      case "$cmd" in
        gh) printf ">     - Used by: \`/orc:code-review\`, \`/orc:address\`, \`/orc:ship\`, \`/orc:postmortem\`\n" ;;
        agent-browser) printf ">     - Used by: \`/orc:qa\` (web mode — required for browser-driven QA evidence)\n" ;;
        acli) printf ">     - Used by: \`/orc:jira\`, \`/orc:plan|start|debug|flow\` (Jira ticket linking), \`/orc:prd|trd\` (\`--from-jira\` seeding)\n" ;;
      esac
    done
    printf ">\n"
  fi
  printf "> _Set \`ORC_SKIP_TOOL_CHECK=1\` to suppress this notice._\n"
}

warning_block=$(build_block)

# The user-facing warning goes in the top-level `systemMessage` field —
# Claude Code displays it directly to the user (once, at session start),
# independent of the model. This is what restores deterministic callout
# coloring: the harness renders the markdown itself instead of the model
# re-emitting it.
#
# A short, neutral note still goes to the model's context so it can offer
# install help if the user asks — but it is NOT a "surface this verbatim"
# directive, so the model won't also re-print the warning.
req_list="none"
[ ${#missing_required[@]} -gt 0 ] && req_list="${missing_required[*]}"
rec_list="none"
[ ${#missing_recommended[@]} -gt 0 ] && rec_list="${missing_recommended[*]}"
model_note="orc tool check (SessionStart): some CLI dependencies are missing — required: ${req_list}; recommended: ${rec_list}. The user has already been shown install hints directly. Do not re-print the warning; offer install help only if asked."

# jq owns the JSON encoding — with one exception: when jq ITSELF is the
# missing dependency this script exists to report, fall back to minimal
# hand escaping so the warning still reaches the user.
if command -v jq >/dev/null 2>&1; then
  jq -n --arg warn "$warning_block" --arg note "$model_note" '{
    systemMessage: $warn,
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      additionalContext: $note
    }
  }'
else
  esc() {
    local s="$1"
    s="${s//\\/\\\\}"
    s="${s//\"/\\\"}"
    s="${s//$'\n'/\\n}"
    s="${s//$'\r'/\\r}"
    s="${s//$'\t'/\\t}"
    printf '%s' "$s"
  }
  cat <<EOF
{
  "systemMessage": "$(esc "$warning_block")",
  "hookSpecificOutput": {
    "hookEventName": "SessionStart",
    "additionalContext": "$(esc "$model_note")"
  }
}
EOF
fi

exit 0
