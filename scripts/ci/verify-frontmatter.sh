#!/usr/bin/env bash
# Lint plugin frontmatter against orc's house conventions (orc:write-a-skill):
#   skills:   name == dir name, kebab-case, <=64 chars; description present, <=1024 chars.
#   agents:   name present and orc- prefixed; description present.
#   commands: description present.
# Run from the repo root.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"

status=0

# Print the value of a frontmatter scalar key from the first --- block.
fm_value() {
  local file="$1" key="$2"
  awk -v k="$key" '
    NR==1 && $0!="---" { exit }
    NR==1 { infm=1; next }
    infm && $0=="---" { exit }
    infm {
      if (match($0, "^" k ":[[:space:]]*")) { print substr($0, RLENGTH+1); exit }
    }
  ' "$file"
}

# Skills
for skill_md in orc/skills/*/SKILL.md; do
  dir="$(basename "$(dirname "$skill_md")")"
  name="$(fm_value "$skill_md" name)"
  desc="$(fm_value "$skill_md" description)"
  if [ -z "$name" ]; then
    echo "verify-frontmatter: $skill_md missing 'name:'"; status=1; continue
  fi
  if [ "$name" != "$dir" ]; then
    echo "verify-frontmatter: $skill_md name '$name' != directory '$dir'"; status=1
  fi
  if ! printf '%s' "$name" | grep -qE '^[a-z0-9]+(-[a-z0-9]+)*$'; then
    echo "verify-frontmatter: skill name '$name' is not kebab-case"; status=1
  fi
  if [ "${#name}" -gt 64 ]; then
    echo "verify-frontmatter: skill name '$name' exceeds 64 chars"; status=1
  fi
  if [ -z "$desc" ]; then
    echo "verify-frontmatter: $skill_md missing 'description:'"; status=1
  elif [ "${#desc}" -gt 1024 ]; then
    echo "verify-frontmatter: $skill_md description is ${#desc} chars (>1024)"; status=1
  elif [ "${#desc}" -gt 300 ]; then
    # Soft warning only — the description catalog is always-resident context;
    # keep entries to trigger + boundary (see orc:writing-for-agents).
    echo "verify-frontmatter: note — $skill_md description is ${#desc} chars (>300; trigger+boundary target)"
  fi
done

# Agents
for agent in orc/agents/*.md; do
  name="$(fm_value "$agent" name)"
  desc="$(fm_value "$agent" description)"
  if [ -z "$name" ]; then
    echo "verify-frontmatter: $agent missing 'name:'"; status=1
  elif [ "${name#orc-}" = "$name" ]; then
    echo "verify-frontmatter: agent name '$name' is not 'orc-' prefixed"; status=1
  fi
  if [ -z "$desc" ]; then
    echo "verify-frontmatter: $agent missing 'description:'"; status=1
  fi
done

# Commands
for cmd in orc/commands/*.md; do
  desc="$(fm_value "$cmd" description)"
  if [ -z "$desc" ]; then
    echo "verify-frontmatter: $cmd missing 'description:'"; status=1
  fi
done

if [ "$status" -eq 0 ]; then
  echo "verify-frontmatter: OK (skill names, agent prefixes, descriptions all conform)"
fi
exit "$status"
