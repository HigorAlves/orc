# orc

Read CLAUDE.md for repository navigation and docs/contributing.md for conventions.

The Claude source package is `orc/`. Codex adapters live in `adapters/codex/`.
Run `python3 scripts/codex/build.py` after shared workflow or adapter changes.
Do not edit `codex/orc/` directly; it is the checked-in installable distribution.
Run `python3 scripts/codex/test_bundle.py` and the relevant existing CI checks.
Installer changes also require `go test ./...` from `cli/`.

Keep both hosts supported. Preserve `.orc` state compatibility. Codex guard
verdicts cannot use `ask`: convert them to `deny`. Follow docs/codex.md for
local installation and host limitations. Every behavioral change needs an
Unreleased changelog entry.
