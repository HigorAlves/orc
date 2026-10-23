#!/usr/bin/env bash
# Feature branch with one committed change, ready for a PR.
set -euo pipefail
git init -q -b main .
git config user.email dev@example.com && git config user.name Dev && git config commit.gpgsign false
printf 'export const slugify = (s) => s.toLowerCase().trim().replace(/\\s+/g, "-");\n' > slug.js
git add slug.js && git commit -q -m "chore: init"
git switch -q -c feat/unslug
printf 'export const unslug = (s) => s.replace(/-/g, " ");\n' >> slug.js
git add slug.js && git commit -q -m "feat: add unslug"
