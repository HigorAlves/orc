#!/usr/bin/env bash
# Fixture tests for verify-frontmatter.sh's model/effort checks. Each case
# builds a throwaway plugin tree and lints it via the script's optional root
# argument, asserting on exit status and the offending value in the output.
# Run from the repo root.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
lint="$repo_root/scripts/ci/verify-frontmatter.sh"

status=0
pass_count=0
fail() { echo "verify-frontmatter-fixtures: FAIL — $1"; status=1; }
ok() { pass_count=$((pass_count + 1)); }

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

# make_tree <dir> <agent-extra-frontmatter> <command-extra> <skill-extra>
make_tree() {
  local d="$1"
  mkdir -p "$d/orc/agents" "$d/orc/commands" "$d/orc/skills/demo"
  printf -- '---\nname: orc-demo\ndescription: Demo agent.\n%s---\n' "$2" > "$d/orc/agents/orc-demo.md"
  printf -- '---\ndescription: Demo command.\n%s---\n' "$3" > "$d/orc/commands/demo.md"
  printf -- '---\nname: demo\ndescription: Demo skill.\n%s---\n' "$4" > "$d/orc/skills/demo/SKILL.md"
}

# expect_pass <case> <dir>
expect_pass() {
  if out="$(bash "$lint" "$2" 2>&1)"; then ok; else fail "$1: expected pass, got: $out"; fi
}

# expect_fail <case> <dir> <value that must be named in the output>
expect_fail() {
  if out="$(bash "$lint" "$2" 2>&1)"; then
    fail "$1: expected failure, got pass"
  elif ! printf '%s' "$out" | grep -qF "$3"; then
    fail "$1: output does not name '$3': $out"
  else
    ok
  fi
}

make_tree "$tmp/valid" $'model: best\neffort: xhigh\n' $'model: claude-opus-5-5\neffort: max\n' $'model: inherit\neffort: low\n'
expect_pass "valid aliases, full ids, and Claude 5 effort levels" "$tmp/valid"

make_tree "$tmp/fable" $'model: fable\neffort: medium\n' $'model: haiku\n' $'effort: high\n'
expect_pass "fable alias and partial frontmatter" "$tmp/fable"

make_tree "$tmp/bad-agent-model" $'model: gpt-5\n' '' ''
expect_fail "unknown agent model" "$tmp/bad-agent-model" "gpt-5"

make_tree "$tmp/bad-command-effort" '' $'effort: extreme\n' ''
expect_fail "unknown command effort" "$tmp/bad-command-effort" "extreme"

make_tree "$tmp/ultracode-effort" '' '' $'effort: ultracode\n'
expect_fail "ultracode is a setting, not an effort level" "$tmp/ultracode-effort" "ultracode"

if [ "$status" -eq 0 ]; then
  echo "verify-frontmatter-fixtures: OK ($pass_count cases)"
fi
exit "$status"
