#!/usr/bin/env bash
# Smoke tests for the two PreToolUse guard hooks — the highest-blast-radius
# scripts in the plugin (an over-matching regex here blocks EVERY commit for
# every orc user; an under-matching one silently drops an iron rule).
#
# Context: hooks.json scopes these via the documented `if:` field
# (permission-rule syntax, e.g. `Bash(git commit*)`). That filter is
# best-effort and FAILS OPEN when the command can't be parsed
# (code.claude.com/docs/en/hooks-guide), so the in-script command matching
# these tests exercise is load-bearing, not belt-and-suspenders.
#
# Each case feeds the PreToolUse stdin contract ({"tool_input":{"command":…}})
# and asserts on the hook's JSON (or empty) output.
# Run from the repo root.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
branch_check="$repo_root/orc/hooks/scripts/pre-commit-branch-check.sh"
attribution_check="$repo_root/orc/hooks/scripts/pre-commit-no-ai-attribution.sh"

status=0
fail() { echo "verify-guard-hooks: FAIL — $1"; status=1; }
pass_count=0
ok() { pass_count=$((pass_count + 1)); }

payload() { jq -n --arg c "$1" '{tool_input: {command: $c}}'; }

# --- pre-commit-branch-check.sh -------------------------------------------
# Needs a real git repo to read HEAD from; build throwaway repos per branch.
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

make_repo() { # $1 = branch name
  local d="$tmp/repo-$1"
  git init -q -b "$1" "$d"
  git -C "$d" -c user.email=t@t -c user.name=t commit -q --allow-empty -m init
  echo "$d"
}
main_repo="$(make_repo main)"
feat_repo="$(make_repo feat-x)"

run_branch_check() { # $1 = repo dir, $2 = command
  (cd "$1" && payload "$2" | ORC_PROTECTED_BRANCHES="" CLAUDE_PLUGIN_OPTION_PROTECTED_BRANCHES="" bash "$branch_check")
}

# MATCH: commit on a protected branch -> permissionDecision "ask"
out="$(run_branch_check "$main_repo" 'git commit -m "x"')"
printf '%s' "$out" | jq -e '.hookSpecificOutput.permissionDecision == "ask"' >/dev/null 2>&1 \
  && ok || fail "branch-check: commit on main should ask"

# MATCH: compound command and git -C forms still intercepted on main
out="$(run_branch_check "$main_repo" 'npm test && git commit -m "x"')"
printf '%s' "$out" | jq -e '.hookSpecificOutput.permissionDecision == "ask"' >/dev/null 2>&1 \
  && ok || fail "branch-check: compound 'npm test && git commit' on main should ask"
out="$(run_branch_check "$main_repo" 'git -C sub push origin main')"
printf '%s' "$out" | jq -e '.hookSpecificOutput.permissionDecision == "ask"' >/dev/null 2>&1 \
  && ok || fail "branch-check: 'git -C <path> push' on main should ask"

# NON-MATCH: same commands on a feature branch -> silent pass-through
out="$(run_branch_check "$feat_repo" 'git commit -m "x"')"
[ -z "$out" ] && ok || fail "branch-check: commit on feature branch must be silent, got: $out"

# NON-MATCH: innocent git commands on main -> silent (over-match guard)
for cmd in 'git log --oneline' 'git status' 'echo "git commitment"' 'ls -la'; do
  out="$(run_branch_check "$main_repo" "$cmd")"
  [ -z "$out" ] && ok || fail "branch-check: '$cmd' on main must be silent, got: $out"
done

# CONFIG: custom protected set replaces the default
out="$(cd "$main_repo" && payload 'git commit -m x' | ORC_PROTECTED_BRANCHES="release" bash "$branch_check")"
[ -z "$out" ] && ok || fail "branch-check: main not in custom protected set must be silent"

# --- pre-commit-no-ai-attribution.sh --------------------------------------
run_attribution() { # $1 = command
  payload "$1" | env -u ORC_ALLOW_AI_ATTRIBUTION bash "$attribution_check"
}

# MATCH: the four attribution shapes -> deny
deny_cases=(
  'git commit -m "feat: x" -m "Co-Authored-By: Claude <noreply@anthropic.com>"'
  'gh pr create --title x --body "🤖 Generated with [Claude Code](https://claude.com/claude-code)"'
  'gh issue edit 1 --body "Generated with Claude Code"'
  'git -C sub commit -m "fix: y

Co-Authored-By: Claude Fable <noreply@anthropic.com>"'
)
for cmd in "${deny_cases[@]}"; do
  out="$(run_attribution "$cmd")"
  printf '%s' "$out" | jq -e '.hookSpecificOutput.permissionDecision == "deny"' >/dev/null 2>&1 \
    && ok || fail "attribution: should deny: $cmd"
done

# NON-MATCH: innocent mentions must NOT be blocked (tight-pattern guarantee)
silent_cases=(
  'git commit -m "chore(claude-plugin): bump manifest"'
  'git commit -m "docs: describe the AI-attribution guard hook"'
  'gh pr create --title "feat: claude-in-chrome skill" --body "Adds the skill."'
  'git log --grep "Co-Authored-By"'
  'ls -la'
)
for cmd in "${silent_cases[@]}"; do
  out="$(run_attribution "$cmd")"
  [ -z "$out" ] && ok || fail "attribution: must be silent for: $cmd — got: $out"
done

# OVERRIDE: explicit opt-in disables the guard
out="$(payload 'git commit -m "x" -m "Co-Authored-By: Claude <noreply@anthropic.com>"' | ORC_ALLOW_AI_ATTRIBUTION=1 bash "$attribution_check")"
[ -z "$out" ] && ok || fail "attribution: ORC_ALLOW_AI_ATTRIBUTION=1 must be silent"

if [ "$status" -eq 0 ]; then
  echo "verify-guard-hooks: OK ($pass_count cases)"
fi
exit "$status"
