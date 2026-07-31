#!/usr/bin/env bash
# Verify the plugin's hook wiring is internally consistent:
#   1. every `command` in orc/hooks/hooks.json resolves to an existing,
#      executable script under the plugin root;
#   2. the SessionStart skill that session-start-using-orc.sh hard-reads exists;
#   3. every userConfig key in plugin.json is consumed — either a
#      CLAUDE_PLUGIN_OPTION_<UPPER> env var read by a hook/lib script, or a
#      by-name gate in a command prompt under orc/commands (commands read
#      config from prose, not the environment) — so nothing is dead config.
# Run from the repo root. Exits non-zero on the first class of failure found.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"

hooks_json="orc/hooks/hooks.json"
plugin_json="orc/.claude-plugin/plugin.json"
status=0

# 1. Hook command scripts exist and are executable.
while IFS= read -r cmd; do
  # command looks like: "${CLAUDE_PLUGIN_ROOT}/hooks/scripts/foo.sh"
  # strip literal quotes and resolve ${CLAUDE_PLUGIN_ROOT} -> orc
  path="${cmd//\"/}"
  path="${path/\$\{CLAUDE_PLUGIN_ROOT\}/orc}"
  if [ ! -f "$path" ]; then
    echo "verify-hooks: hooks.json references a missing script: $path"
    status=1
  elif [ ! -x "$path" ]; then
    echo "verify-hooks: hook script is not executable (chmod +x): $path"
    status=1
  fi
done < <(jq -r '.. | objects | select(has("command")) | .command' "$hooks_json")

# 2. Hard dependency: session-start-using-orc.sh reads this skill by path.
if [ ! -f "orc/skills/using-orc/SKILL.md" ]; then
  echo "verify-hooks: missing orc/skills/using-orc/SKILL.md (read by session-start-using-orc.sh)"
  status=1
fi

# 3. Every userConfig key is consumed — by a CLAUDE_PLUGIN_OPTION_<UPPER> env
#    var in a hook/lib script, or by name in a command prompt (orc/commands),
#    since commands gate on config from prose rather than the environment.
while IFS= read -r key; do
  [ -n "$key" ] || continue
  upper="$(printf '%s' "$key" | tr '[:lower:]' '[:upper:]')"
  env_var="CLAUDE_PLUGIN_OPTION_${upper}"
  if grep -rqF "$env_var" orc/hooks orc/lib; then
    continue
  fi
  if grep -rqw "$key" orc/commands; then
    continue
  fi
  echo "verify-hooks: userConfig key '$key' is dead — no \$$env_var consumer in orc/hooks or orc/lib, and no '$key' gate in orc/commands"
  status=1
done < <(jq -r '(.userConfig // {}) | keys[]' "$plugin_json")

if [ "$status" -eq 0 ]; then
  echo "verify-hooks: OK (hook scripts, using-orc skill, userConfig consumers all resolve)"
fi
exit "$status"
