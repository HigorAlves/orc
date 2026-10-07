#!/usr/bin/env bash
# Fixture test for lib/pr-size-budget.sh exclusions — generated Playwright
# specs/tests never count toward the budget (settled decision: proof is not logic).
set -euo pipefail
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
cd "$tmp" && git init -q -b main && git config user.email t@t && git config user.name t
printf 'a\n' > src.txt && git add . && git commit -qm base
git checkout -qb feat
mkdir -p e2e/specs e2e/tests/x src
mkdir -p lib/sub && printf '{"a":1,\n"b":2}\n' > lib/sub/package-lock.json
printf 'spec\nspec\n' > e2e/specs/x.md; printf 'test\ntest\ntest\n' > e2e/tests/x/a.spec.ts; printf 'b\n' >> src.txt
git add . && git commit -qm feat
# shellcheck disable=SC1091
. "$repo_root/orc/lib/pr-size-budget.sh"
loc="$(orc_pr_loc main "$tmp")"
if [ "$loc" = "1" ]; then echo "verify-pr-size: OK (e2e specs/tests + nested lockfiles excluded, loc=$loc)"; else echo "verify-pr-size: FAIL — expected 1, got $loc"; exit 1; fi
