#!/usr/bin/env bash
# A tiny repo on a feature branch — enough for orc-state to find a git root.
set -euo pipefail
git init -q -b feat/slug .
git config user.email dev@example.com && git config user.name Dev && git config commit.gpgsign false
printf '{ "name": "slug", "type": "module", "scripts": { "test": "node --test" } }\n' > package.json
git add package.json && git commit -q -m "chore: init"
