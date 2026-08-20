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
destructive_check="$repo_root/orc/hooks/scripts/pre-destructive-git-check.sh"

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
if printf '%s' "$out" | jq -e '.hookSpecificOutput.permissionDecision == "ask"' >/dev/null 2>&1; then ok; else fail "branch-check: commit on main should ask"; fi

# MATCH: compound command and git -C forms still intercepted on main
out="$(run_branch_check "$main_repo" 'npm test && git commit -m "x"')"
if printf '%s' "$out" | jq -e '.hookSpecificOutput.permissionDecision == "ask"' >/dev/null 2>&1; then ok; else fail "branch-check: compound 'npm test && git commit' on main should ask"; fi
out="$(run_branch_check "$main_repo" 'git -C sub push origin main')"
if printf '%s' "$out" | jq -e '.hookSpecificOutput.permissionDecision == "ask"' >/dev/null 2>&1; then ok; else fail "branch-check: 'git -C <path> push' on main should ask"; fi

# NON-MATCH: same commands on a feature branch -> silent pass-through
out="$(run_branch_check "$feat_repo" 'git commit -m "x"')"
if [ -z "$out" ]; then ok; else fail "branch-check: commit on feature branch must be silent, got: $out"; fi

# NON-MATCH: innocent git commands on main -> silent (over-match guard)
for cmd in 'git log --oneline' 'git status' 'echo "git commitment"' 'ls -la'; do
  out="$(run_branch_check "$main_repo" "$cmd")"
  if [ -z "$out" ]; then ok; else fail "branch-check: '$cmd' on main must be silent, got: $out"; fi
done

# CONFIG: custom protected set replaces the default
out="$(cd "$main_repo" && payload 'git commit -m x' | ORC_PROTECTED_BRANCHES="release" bash "$branch_check")"
if [ -z "$out" ]; then ok; else fail "branch-check: main not in custom protected set must be silent"; fi

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
  if printf '%s' "$out" | jq -e '.hookSpecificOutput.permissionDecision == "deny"' >/dev/null 2>&1; then ok; else fail "attribution: should deny: $cmd"; fi
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
  if [ -z "$out" ]; then ok; else fail "attribution: must be silent for: $cmd — got: $out"; fi
done

# OVERRIDE: explicit opt-in disables the guard
out="$(payload 'git commit -m "x" -m "Co-Authored-By: Claude <noreply@anthropic.com>"' | ORC_ALLOW_AI_ATTRIBUTION=1 bash "$attribution_check")"
if [ -z "$out" ]; then ok; else fail "attribution: ORC_ALLOW_AI_ATTRIBUTION=1 must be silent"; fi

# --- pre-destructive-git-check.sh -----------------------------------------
run_destructive() { # $1 = command
  payload "$1" | env -u ORC_ALLOW_DESTRUCTIVE_GIT bash "$destructive_check"
}

# MATCH: destructive shapes -> permissionDecision "ask" (gate, not hard deny)
ask_cases=(
  'git reset --hard HEAD~1'
  'git clean -fd'
  'git clean -f'
  'git branch -D feature-x'
  'git push --force origin main'
  'git push -f'
  'npm test && git reset --hard'
  'git -C sub clean -fdx'
)
for cmd in "${ask_cases[@]}"; do
  out="$(run_destructive "$cmd")"
  if printf '%s' "$out" | jq -e '.hookSpecificOutput.permissionDecision == "ask"' >/dev/null 2>&1; then ok; else fail "destructive: should ask: $cmd"; fi
done

# NON-MATCH: safe variants and prose mentions -> silent
destructive_silent=(
  'git reset --soft HEAD~1'
  'git reset HEAD -- file.txt'
  'git clean -n'
  'git branch -d merged-branch'
  'git push --force-with-lease origin feat/stack-1'
  'git push origin feat/x'
  'echo "git reset --hard is dangerous"'
  'git log --oneline'
)
for cmd in "${destructive_silent[@]}"; do
  out="$(run_destructive "$cmd")"
  if [ -z "$out" ]; then ok; else fail "destructive: must be silent for: $cmd — got: $out"; fi
done

# OVERRIDE: explicit opt-in disables the gate
out="$(payload 'git reset --hard HEAD~1' | ORC_ALLOW_DESTRUCTIVE_GIT=1 bash "$destructive_check")"
if [ -z "$out" ]; then ok; else fail "destructive: ORC_ALLOW_DESTRUCTIVE_GIT=1 must be silent"; fi

# --- pre-git-guard.sh (dispatcher) ----------------------------------------
# One Bash command must produce AT MOST ONE permission prompt, even when it
# trips several checks (e.g. `git push --force` on main matches both the
# protected-branch and destructive-git guards). deny > ask; reasons merge.
guard="$repo_root/orc/hooks/scripts/pre-git-guard.sh"

run_guard() { # $1 = repo dir, $2 = command
  (cd "$1" && payload "$2" | ORC_PROTECTED_BRANCHES="" CLAUDE_PLUGIN_OPTION_PROTECTED_BRANCHES="" \
     env -u ORC_ALLOW_DESTRUCTIVE_GIT -u ORC_ALLOW_AI_ATTRIBUTION bash "$guard")
}

# Helper: assert output is exactly one JSON doc with the given decision, and
# the reason contains ($3) / does not contain ($4, optional) given substrings.
guard_expect() { # $1=repo $2=cmd $3=decision $4=must-contain(| separated) $5=must-not-contain
  local out n d r want_d="$3" needle
  out="$(run_guard "$1" "$2")"
  n="$(printf '%s' "$out" | jq -s 'length' 2>/dev/null || echo 0)"
  if [ "$n" != "1" ]; then fail "guard: '$2' must emit exactly one JSON doc, got $n"; return; fi
  d="$(printf '%s' "$out" | jq -r '.hookSpecificOutput.permissionDecision')"
  r="$(printf '%s' "$out" | jq -r '.hookSpecificOutput.permissionDecisionReason')"
  if [ "$d" != "$want_d" ]; then fail "guard: '$2' decision must be $want_d, got $d"; return; fi
  if [ -n "${4:-}" ]; then
    while IFS= read -r needle; do
      [ -n "$needle" ] || continue
      if ! printf '%s' "$r" | grep -qF "$needle"; then fail "guard: '$2' reason must mention '$needle'"; return; fi
    done < <(printf '%s' "$4" | tr '|' '\n')
  fi
  if [ -n "${5:-}" ] && printf '%s' "$r" | grep -qF "$5"; then
    fail "guard: '$2' reason must NOT mention '$5'"; return
  fi
  ok
}

# THE dedup case: force-push on protected branch trips two checks -> ONE ask
guard_expect "$main_repo" 'git push --force origin main' ask 'iron rule #1|Destructive git command'

# Single-check cases across the {protected,feature} x {push,push --force,commit} matrix
guard_expect "$main_repo" 'git push origin main' ask 'iron rule #1' 'Destructive git command'
guard_expect "$main_repo" 'git commit -m "x"' ask 'iron rule #1'
guard_expect "$feat_repo" 'git push --force origin feat-x' ask 'Destructive git command' 'iron rule #1'
guard_expect "$feat_repo" 'git reset --hard HEAD~1' ask 'Destructive git command'

# deny beats ask: attribution (deny) + protected branch (ask) -> ONE deny, both reasons
guard_expect "$main_repo" 'git commit -m "x" -m "Co-Authored-By: Claude <noreply@anthropic.com>"' deny 'AI attribution|iron rule #1'

# Silent cases: no matching check -> no output at all
for case_cmd in 'git push origin feat-x' 'git commit -m "x"' 'git log --oneline'; do
  out="$(run_guard "$feat_repo" "$case_cmd")"
  if [ -z "$out" ]; then ok; else fail "guard: '$case_cmd' on feature branch must be silent, got: $out"; fi
done
out="$(run_guard "$main_repo" 'git log --oneline')"
if [ -z "$out" ]; then ok; else fail "guard: innocent command on main must be silent"; fi

# Overrides pass through the dispatcher unchanged
out="$(cd "$feat_repo" && payload 'git reset --hard HEAD~1' | ORC_ALLOW_DESTRUCTIVE_GIT=1 bash "$guard")"
if [ -z "$out" ]; then ok; else fail "guard: ORC_ALLOW_DESTRUCTIVE_GIT=1 must be silent through dispatcher"; fi

if [ "$status" -eq 0 ]; then
  echo "verify-guard-hooks: OK ($pass_count cases)"
fi
exit "$status"
