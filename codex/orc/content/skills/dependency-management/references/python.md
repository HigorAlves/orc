# Python (pip / uv)

## Audit

```bash
# Preferred when installed
osv-scanner scan --lockfile requirements.txt      # also: poetry.lock, uv.lock, Pipfile.lock

# Native fallback: pip-audit (PyPA-maintained, queries OSV + PyPI advisories)
pip-audit                          # audits the current environment
pip-audit -r requirements.txt      # audits a requirements file without installing
pip-audit --fix --dry-run          # preview fixes only — apply bumps yourself, one at a time
pip-audit -f json                  # machine-parseable
```

**pip-audit vs uv**: pip-audit inspects an *environment* or a *requirements file* — it does not read `uv.lock` or `pyproject.toml` directly. In a uv project either:

```bash
uv export --format requirements-txt | pip-audit -r /dev/stdin --no-deps
# or audit the synced venv:
uv run pip-audit
```

osv-scanner reads `uv.lock` natively — prefer it in uv projects.

## Outdated

```bash
pip list --outdated                          # current vs latest for the active env
pip list --outdated --format=json
uv tree --outdated                           # uv projects: annotates the tree with latest versions
uv pip list --outdated                       # venv view
```

## Upgrade

```bash
# pip + requirements workflow
pip install -U <pkg>==<version>              # explicit target, never bare -U (grabs latest incl. majors)
pip freeze > requirements.txt                # or edit the pin by hand — keep the diff to one package

# uv workflow (lockfile-only preferred)
uv lock --upgrade-package <pkg>              # bump ONE package within pyproject constraints — the precision tool
uv lock --upgrade-package <pkg>==<version>   # to an exact version
uv sync                                      # apply the lock to the venv, then run the suite

# poetry
poetry update <pkg>                          # one package, respects pyproject range
```

Never `uv lock --upgrade` (all packages) or bare `poetry update` in the loop — those are batch bumps.

## Gotchas

- **Constraints files** (`-c constraints.txt`): pin transitive dependencies without declaring them as requirements — the pip-world analog of npm `overrides`. Use for *no-fix-yet* vulns or to hold back a known-bad transitive version: `pip install -r requirements.txt -c constraints.txt`. Same footgun: constraints outlive their reason; comment each line and re-check on the next audit.
- **Environment vs lockfile truth**: `pip list --outdated` and `pip-audit` (no `-r`) report on the *active venv*, which can drift from the requirements file. Sync first (`pip install -r requirements.txt` / `uv sync`) or audit the file itself, or you'll rank vulnerabilities the deploy doesn't have.
- **`pip install -U <pkg>` without a version** jumps straight to latest — a silent major. Always name the target version.
- **Yanked releases**: pip refuses yanked versions on fresh resolves but keeps them if already pinned. If an audit fix targets a yanked version, pick the next release up.
- **Multiple Pythons**: pip-audit results depend on the interpreter (markers like `python_version < "3.11"` change the resolved set). Audit with the same Python version CI deploys with.
