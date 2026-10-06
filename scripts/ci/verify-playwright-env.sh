#!/usr/bin/env bash
# Fixture tests for bin/orc-playwright — detect / scaffold / mcp-merge for the
# committed e2e/ Playwright project orc's Driver P runs. No npm, no network.
# shellcheck disable=SC2015  # `cond && ok || fail` is the intended assert idiom
set -euo pipefail
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cli="$repo_root/orc/bin/orc-playwright"
status=0; pass_count=0
fail() { echo "verify-playwright-env: FAIL — $1"; status=1; }
ok() { pass_count=$((pass_count + 1)); }
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT

# detect: nothing → exit 1
mkdir -p "$tmp/r1"; bash "$cli" detect "$tmp/r1" >/dev/null 2>&1 && fail "detect must exit 1 with no project" || ok
# detect: root config
mkdir -p "$tmp/r2"; : > "$tmp/r2/playwright.config.ts"
[ "$(bash "$cli" detect "$tmp/r2")" = $'.\tplaywright.config.ts' ] && ok || fail "detect root config"
# detect: e2e config wins when both absent at root
mkdir -p "$tmp/r3/e2e"; : > "$tmp/r3/e2e/playwright.config.ts"
[ "$(bash "$cli" detect "$tmp/r3")" = $'e2e\te2e/playwright.config.ts' ] && ok || fail "detect e2e config"

# scaffold: creates the set, never overwrites
mkdir -p "$tmp/r4"
out="$(bash "$cli" scaffold "$tmp/r4")"
for f in e2e/package.json e2e/playwright.config.ts e2e/tests/fixtures.ts e2e/tests/auth.setup.ts e2e/tests/seed.spec.ts e2e/.gitignore e2e/specs/README.md; do
  [ -f "$tmp/r4/$f" ] && ok || fail "scaffold missing $f"
done
printf '%s' "$out" | grep -q 'created e2e/playwright.config.ts' && ok || fail "scaffold must report created files"
grep -q "from './fixtures'" "$tmp/r4/e2e/tests/seed.spec.ts" && ok || fail "seed must import the console-capturing fixtures"
printf 'custom' > "$tmp/r4/e2e/tests/seed.spec.ts"
out2="$(bash "$cli" scaffold "$tmp/r4")"; printf '%s' "$out2" | grep -q 'kept e2e/tests/seed.spec.ts' && [ "$(cat "$tmp/r4/e2e/tests/seed.spec.ts")" = "custom" ] && ok || fail "scaffold must not overwrite"
grep -q 'ORC_TARGET_JSON' "$tmp/r4/e2e/playwright.config.ts" && ok || fail "config must read ORC_TARGET_JSON"
grep -q "level: 'step'" "$tmp/r4/e2e/playwright.config.ts" && ok || fail "config must enable step overlays"
grep -q "name: 'demo'" "$tmp/r4/e2e/playwright.config.ts" && ok || fail "config must define the demo project"
jq -e '.devDependencies["@playwright/test"]' "$tmp/r4/e2e/package.json" >/dev/null && ok || fail "package.json must pin @playwright/test"

# mcp-merge: preserves existing servers, backs up, sets our entry
mkdir -p "$tmp/r5"
printf '{"mcpServers":{"other":{"command":"x","args":[]}}}' > "$tmp/r5/.mcp.json"
bash "$cli" mcp-merge "$tmp/r5" --dir e2e --config e2e/playwright.config.ts >/dev/null
jq -e '.mcpServers.other.command == "x"' "$tmp/r5/.mcp.json" >/dev/null && ok || fail "mcp-merge must keep existing servers"
jq -e '.mcpServers["playwright-test"].command == "node" and .mcpServers["playwright-test"].args == ["e2e/node_modules/playwright/cli.js","run-test-mcp-server","-c","e2e/playwright.config.ts"]' "$tmp/r5/.mcp.json" >/dev/null && ok || fail "mcp-merge entry shape"
ls "$tmp/r5"/.orc/backups/.mcp.json.* >/dev/null 2>&1 && ok || fail "mcp-merge must back up under .orc/backups"
ls "$tmp/r5"/.mcp.json.orc-backup-* >/dev/null 2>&1 && fail "backup must never land in the repo root" || ok
# mcp-merge with no prior file
mkdir -p "$tmp/r6"; bash "$cli" mcp-merge "$tmp/r6" --dir . --config playwright.config.ts >/dev/null
jq -e '.mcpServers["playwright-test"].args[0] == "node_modules/playwright/cli.js"' "$tmp/r6/.mcp.json" >/dev/null && ok || fail "mcp-merge root dir path"

[ "$status" -eq 0 ] && echo "verify-playwright-env: OK ($pass_count cases)"
exit "$status"
