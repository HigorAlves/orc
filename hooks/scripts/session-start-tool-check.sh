#!/usr/bin/env bash
# SessionStart hook: pre-flight check for CLI dependencies orc relies on.
# If anything's missing, injects a warning into session context. The model
# surfaces it to the user using the ⚠ Tool check format defined below.
# Silent (exit 0 with no additionalContext) when everything's present.
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

# Build the human-readable warning body.
build_block() {
  printf "⚠ Tool check ─────────────────────────────────\n"
  if [ ${#missing_required[@]} -gt 0 ]; then
    printf "Missing **required** (orc hooks/commands break without these):\n"
    for cmd in "${missing_required[@]}"; do
      printf "  • %s — %s\n" "$cmd" "$(hint_for "$cmd")"
    done
  fi
  if [ ${#missing_recommended[@]} -gt 0 ]; then
    printf "Missing recommended (some commands won't work):\n"
    for cmd in "${missing_recommended[@]}"; do
      printf "  • %s — %s\n" "$cmd" "$(hint_for "$cmd")"
      case "$cmd" in
        gh) printf "      Used by: /orc:code-review, /orc:address, /orc:ship, /orc:postmortem\n" ;;
        agent-browser) printf "      Used by: /orc:qa (web mode — required for browser-driven QA evidence)\n" ;;
        acli) printf "      Used by: /orc:jira, /orc:plan|start|debug|flow (Jira ticket linking), /orc:prd|trd (--from <jira-key>)\n" ;;
      esac
    done
  fi
  printf "\nSet ORC_SKIP_TOOL_CHECK=1 to suppress this notice.\n"
  printf "─────────────────────────────────────────────\n"
}

warning_block=$(build_block)

# JSON-escape the block (same approach as session-start-using-orc.sh).
escape_for_json() {
  local s="$1"
  s="${s//\\/\\\\}"
  s="${s//\"/\\\"}"
  s="${s//$'\n'/\\n}"
  s="${s//$'\r'/\\r}"
  s="${s//$'\t'/\\t}"
  printf '%s' "$s"
}

warning_escaped=$(escape_for_json "$warning_block")

# Wrap as a directive the model reads at session start. The model surfaces
# the ⚠ block VERBATIM as its first response, then proceeds with whatever
# the user asked. The block is shown ONCE per session.
session_context="<EXTREMELY_IMPORTANT>\norc tool-availability check (SessionStart). Some CLI dependencies are missing.\n\nSurface the following block to the user as your first response, exactly as shown (preserve formatting). Show it ONCE per session — do not repeat in later turns. Then proceed with whatever the user asked.\n\n${warning_escaped}\n</EXTREMELY_IMPORTANT>"

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
