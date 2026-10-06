#!/usr/bin/env bash
# main with one staged change, ready to commit.
set -euo pipefail
git init -q -b main .
git config user.email dev@example.com && git config user.name Dev && git config commit.gpgsign false
printf 'export const slugify = (s) => s.toLowerCase().trim().replace(/\\s+/g, "-");\n' > slug.js
git add slug.js && git commit -q -m "chore: init"
printf 'export const unslug = (s) => s.replace(/-/g, " ");\n' >> slug.js
git add slug.js
