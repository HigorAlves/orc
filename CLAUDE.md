# orc

Navigation pointers only; the conventions live where they point. Layout and the why: `docs/architecture.md`. Adding a skill, command, agent, or hook, and the release steps: `docs/contributing.md`. What issues are accepted: `SCOPE.md`; what was rejected and why: `docs/agents/out-of-scope.md`. Decisions: `docs/adr/`. Terms: `GLOSSARY.md`. Every behavioural PR adds a line under `## [Unreleased]` in `CHANGELOG.md`.

## Agent skills

### Issue tracker

GitHub Issues in `HigorAlves/orc`. See `docs/agents/issue-tracker.md`.

### Triage labels

The default vocabulary, each label string equal to its role name. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `GLOSSARY.md` + `docs/adr/` at the root. See `docs/agents/domain.md`.
