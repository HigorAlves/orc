#!/usr/bin/env bash
# Count/consistency drift check (extends the old inline count-drift step):
#   - README + docs/commands.md prose counts (skills/commands/agents/hooks);
#   - marketplace.json description counts (all four, not just skills) plus
#     plugins[].name == plugin.json name and source == "./orc";
#   - docs/architecture.md tree counts + the prose command count.
# Counts are computed from disk, so the checks self-adjust as content changes;
# only the human-authored prose has to keep up. Reports ALL drift, then exits.
# Run from the repo root.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"

skills=$(find orc/skills -mindepth 1 -maxdepth 1 -type d | wc -l | xargs)
commands=$(find orc/commands -maxdepth 1 -name '*.md' | wc -l | xargs)
agents=$(find orc/agents -maxdepth 1 -name '*.md' | wc -l | xargs)
hooks=$(find orc/hooks/scripts -maxdepth 1 -name '*.sh' | wc -l | xargs)

status=0
need() { # need <literal-string> <file>
  grep -qF "$1" "$2" || { echo "verify-counts: expected \"$1\" in $2"; status=1; }
}

# README.md — intro paragraph carries all four counts.
need "${skills} curated skills" README.md
need "${commands} composite slash commands" README.md
need "${agents} specialist subagents" README.md
need "${hooks} hook scripts" README.md

# docs/commands.md — the full catalog page (section headings + skills prose).
need "Commands (${commands})" docs/commands.md
need "agents (${agents})" docs/commands.md
need "Skills (${skills})" docs/commands.md
need "Total: ${skills} skills" docs/commands.md

# marketplace.json — all four counts embedded in the plugin description.
need "${skills} curated skills" .claude-plugin/marketplace.json
need "${commands} composite slash commands" .claude-plugin/marketplace.json
need "${agents} specialist subagents" .claude-plugin/marketplace.json
need "${hooks} hook scripts" .claude-plugin/marketplace.json

# marketplace ↔ plugin.json name / source parity.
plugin_name=$(jq -r '.name' orc/.claude-plugin/plugin.json)
if ! jq -e --arg n "$plugin_name" '.plugins[] | select(.name == $n and .source == "./orc")' \
      .claude-plugin/marketplace.json >/dev/null; then
  echo "verify-counts: marketplace.json has no plugin with name=\"$plugin_name\" and source=\"./orc\""
  status=1
fi

# docs/architecture.md tree counts + prose command count.
need "# ${skills} skills," docs/architecture.md
need "# ${commands} composite slash commands" docs/architecture.md
need "# ${agents} specialist subagents" docs/architecture.md
need "(${commands} commands," docs/architecture.md

if [ "$status" -eq 0 ]; then
  echo "verify-counts: OK (${skills} skills / ${commands} commands / ${agents} agents / ${hooks} hooks consistent across README, marketplace, architecture)"
fi
exit "$status"
