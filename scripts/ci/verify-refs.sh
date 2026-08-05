#!/usr/bin/env bash
# Verify orc's internal cross-references resolve — locks a currently-green
# invariant so a rename can't silently dangle:
#   a) every agent `skills:` frontmatter entry resolves to a real skill dir;
#   b) every `orc:<name>` mention in agents/commands/SKILL.md resolves to a
#      real command OR skill (the namespace is shared);
#   c) every concrete `references/<file>.md` a SKILL.md points at exists;
#   d) every bare hyphenated `/slash-command` prose mention resolves to an
#      orc command/skill or a known bundled Claude Code command;
#   e) every relative `../<skill>/<file>.md` link in a SKILL.md exists.
# Run from the repo root.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"

status=0

# Canonical name set: command basenames ∪ skill dir names.
is_known() {
  local name="$1"
  [ -f "orc/commands/${name}.md" ] || [ -d "orc/skills/${name}" ]
}

# a) Agent `skills:` frontmatter → must be a real skill dir.
for agent in orc/agents/*.md; do
  # Extract the YAML `skills:` block: lines "  - orc:<name>" until the next
  # top-level key or frontmatter terminator.
  while IFS= read -r skill; do
    [ -n "$skill" ] || continue
    if [ ! -d "orc/skills/${skill}" ]; then
      echo "verify-refs: $agent lists skills: entry 'orc:${skill}' but orc/skills/${skill}/ does not exist"
      status=1
    fi
  done < <(
    awk '
      /^skills:[[:space:]]*$/ { inblock=1; next }
      inblock && /^[[:space:]]*-[[:space:]]/ { print; next }
      inblock && /^[^[:space:]-]/ { inblock=0 }
      inblock && /^---[[:space:]]*$/ { inblock=0 }
    ' "$agent" | sed -E 's/^[[:space:]]*-[[:space:]]*//; s/^orc://; s/[[:space:]]+$//'
  )
done

# b) Every orc:<name> mention resolves to a command or skill.
while IFS= read -r name; do
  [ -n "$name" ] || continue
  if ! is_known "$name"; then
    echo "verify-refs: dangling reference 'orc:${name}' (no orc/commands/${name}.md and no orc/skills/${name}/)"
    status=1
  fi
done < <(
  grep -rhoE '\borc:[a-z][a-z0-9-]*' orc/agents orc/commands orc/skills/*/SKILL.md 2>/dev/null \
    | sed -E 's/^orc://' | sort -u
)

# c) Concrete references/<file>.md links in each SKILL.md must exist. A link may
#    be bare (`references/foo.md`, relative to this skill) or cross-skill
#    (`other-skill/references/foo.md`, relative to orc/skills/).
for skill_md in orc/skills/*/SKILL.md; do
  dir="$(dirname "$skill_md")"
  while IFS= read -r ref; do
    [ -n "$ref" ] || continue
    case "$ref" in
      references/*) target="${dir}/${ref}" ;;             # bare: this skill
      */references/*) target="orc/skills/${ref}" ;;       # cross-skill prefix
      *) continue ;;
    esac
    if [ ! -f "$target" ]; then
      echo "verify-refs: ${skill_md} points at ${ref} but ${target} is missing"
      status=1
    fi
  done < <(grep -oE '([a-z0-9][a-z0-9-]*/)?references/[A-Za-z0-9._/-]+\.md' "$skill_md" 2>/dev/null | sort -u || true)
done

# d) Bare hyphenated /slash-command mentions (e.g. `/grill-me`, `/setup-foo`)
#    must resolve to an orc command/skill or a bundled Claude Code command.
#    Scope: prose only — fenced code blocks are stripped (route/code examples
#    like redirect('/new-path') live there). Leading boundary is start-of-line,
#    whitespace, or backtick (inline-code skill mentions); paren/quote-led
#    matches (markdown link targets, string literals) are ignored. The hyphen
#    requirement keeps URLs and single-word paths out.
bundled_known() {
  case "$1" in
    code-review|security-review|install-slack-app|find-skills) return 0 ;;
    *) return 1 ;;
  esac
}
strip_fences() {
  awk '/^[[:space:]]*```/ { infence = !infence; next } !infence' "$1"
}
while IFS= read -r md; do
  while IFS= read -r name; do
    [ -n "$name" ] || continue
    if ! is_known "$name" && ! bundled_known "$name"; then
      echo "verify-refs: ${md} mentions '/${name}' but it is not an orc command/skill or known bundled command"
      status=1
    fi
  done < <(
    strip_fences "$md" \
      | grep -oE "(^|[[:space:]\`])/[a-z][a-z0-9]*(-[a-z0-9]+)+" \
      | grep -oE '[a-z][a-z0-9]*(-[a-z0-9]+)+$' | sort -u
  )
done < <(find orc/agents orc/commands orc/skills -name '*.md' -type f | sort)

# e) Relative ../<skill>/<file>.md links inside a SKILL.md must exist
#    (resolved against the linking skill's directory).
for skill_md in orc/skills/*/SKILL.md; do
  dir="$(dirname "$skill_md")"
  while IFS= read -r rel; do
    [ -n "$rel" ] || continue
    if [ ! -f "${dir}/${rel}" ]; then
      echo "verify-refs: ${skill_md} links ${rel} but ${dir}/${rel} is missing"
      status=1
    fi
  done < <(grep -oE '\.\./[a-z0-9][a-z0-9-]*/[A-Za-z0-9._/-]+\.md' "$skill_md" 2>/dev/null | sort -u || true)
done

if [ "$status" -eq 0 ]; then
  echo "verify-refs: OK (agent skills, orc:<name> mentions, references/*.md, /slash mentions, ../ links all resolve)"
fi
exit "$status"
