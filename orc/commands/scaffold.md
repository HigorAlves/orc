---
description: Bootstrap a new package, service, or app — scaffold with proper README, Diátaxis-shaped docs, an initial test, and a first commit. No business code, just the well-shaped shell.
argument-hint: "<package-or-service-name> [--type=lib|service|app|cli]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Skill
  - AskUserQuestion
  - Bash(mkdir:*)
  - Bash(git:*)
  - Bash(npm init:*)
  - Bash(pnpm init:*)
  - Bash(yarn init:*)
  - Bash(go mod init:*)
  - Bash(cargo init:*)
---

# /orc:scaffold

Stand up a new package/service shell with the structure that future-you will not regret. Strictly the skeleton — no business logic, no fake examples.

## Arguments

- `<name>` — package or service name (kebab-case).
- `--type` — `lib` (default), `service`, `app`, `cli`. Affects the initial directory layout.

## Workflow

### Phase 1 — Confirm intent

Print the Gate headline (`**⛔ Gate — scaffold shape**`, per `orc:insights`), then `AskUserQuestion`:
- Where does this live? (project root / `packages/<name>/` / `services/<name>/` / `apps/<name>/`)
- Language? (TypeScript / Go / Rust / Python)
- License? (MIT / Apache-2.0 / inherit from repo)

### Phase 2 — Initialize

Create the directory. Run the appropriate init for the language (`npm init -y`, `go mod init`, `cargo init`, `python -m venv` + `pyproject.toml`).

### Phase 3 — Author README

Invoke `orc:create-readme`. The skill writes a README with the standard sections (What / Why / Install / Usage / Test / License). Adjust to type-specific bits (services include "Run", apps include "Dev server").

### Phase 4 — Author docs

Invoke `orc:documentation-writer`. Set up the Diátaxis structure under `docs/`:
- `docs/tutorial/` — getting-started flows
- `docs/how-to/` — task recipes
- `docs/reference/` — API/CLI/config reference
- `docs/explanation/` — concepts, architecture

Create a stub `docs/README.md` linking the four quadrants.

### Phase 5 — First failing test

Invoke `orc:tdd`. Write the simplest possible failing test for the package/service entry point. Run the suite — it must fail meaningfully.

### Phase 6 — First commit

Invoke `orc:git-commit`. Conventional Commits format. Title: `chore(scaffold): initialize <name> package` or similar. Body lists what was scaffolded.

## Output

- New directory with proper layout for the chosen type
- `README.md`, `docs/` Diátaxis quadrants, license file
- One failing test, one commit
- Echo the path to the new package, then close with the handoff:

```markdown
> **➡️ Next**
>
> Run `/orc:start` to begin real work in `<path>`.
```
