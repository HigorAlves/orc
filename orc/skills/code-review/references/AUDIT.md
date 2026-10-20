<!-- orc:code-review/AUDIT -->
_Loaded on demand (orc:phases protocol). Do not run this phase from memory — this file is the phase._

# Audit mode (`--audit`)

A repo-wide security pass over the current checkout. No PR ref, no diff, no posting.

1. Dispatch `orc-security-reviewer` in audit scope via one `Task` call.
2. In the same response, run the secret scan below.
3. Merge agent findings with secret-scan hits; redact every matched value.
4. Sort by severity and print the P8 summary with an extra `## Secrets` group.

Audit brief (under 400 words): audit mode; scope is the whole working tree via Glob and Grep; the "introduced by this change" rule is suspended; output is the strict-JSON findings contract. Pass the repo root and any standards file paths.

Secret scan:

- If `command -v gitleaks` succeeds, run `gitleaks detect --no-banner --redact -v` and parse its findings.
- Otherwise `Grep` the tree, excluding lockfiles, `node_modules/`, `.git/` and test fixtures, for the patterns below. Each hit is a `security` finding.

```
AKIA[0-9A-Z]{16}
ghp_[A-Za-z0-9]{36}
github_pat_[A-Za-z0-9_]{22,}
xox[baprs]-[A-Za-z0-9-]+
sk_live_[A-Za-z0-9]{20,}
-----BEGIN( RSA| EC| OPENSSH)? PRIVATE KEY-----
(api[_-]?key|secret|password|token)\s*[:=]\s*['"][A-Za-z0-9_\-]{16,}['"]
```

NOTE: `--include-nits` still applies to the summary. No event is computed.
