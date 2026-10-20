<!-- orc:stack-pr/P6 -->
_Loaded on demand via orc:phases. Do not run this phase from memory — this file is the phase._

# Phase 6 — Two-pass body rewrite, metadata writeback

> **🛑 Outward write**
>
> Step 2 edits every PR body on GitHub.

1. Once every PR exists, build the cross-link table (`orc:stack-pr` skill template) with all sibling URLs.
2. Rewrite each PR body: `gh pr edit <url> --body "$updated_body"`; the `(this)` marker shifts per PR.
3. Append per-PR entries to the active session's `linkedPRs[]` with the `jq` loop below.
4. If no active session exists, register one with the `orc-state` calls below instead.

Writeback to `${ORC_STATE_DIR}/orc.json`:

```bash
stackId="${SESSION_ID}-${REPO_NAME:-_}"      # workspace-aware
for i in 1..N; do
  jq --arg branch "$BRANCH" \
     --arg repo "${REPO_NAME:-_}" \
     --arg url "${pr_urls[$i]}" \
     --arg stackId "$stackId" \
     --argjson pos "$i" \
     --arg parent "$([ $i -eq 1 ] && echo '' || echo "${pr_urls[$((i-1))]}")" \
     '(.sessions[] | select(.branch == $branch) | .linkedPRs) += [{
        repo: $repo,
        url: $url,
        stackId: $stackId,
        stackPosition: $pos,
        stackedOn: (if $parent == "" then null else $parent end)
      }]' "$ORC_STATE_DIR/orc.json" > tmp && mv tmp "$ORC_STATE_DIR/orc.json"
done
```

Standalone run (no prior `/orc:flow` or `/orc:ship` session):

```bash
orc-state init --command stack-pr --total-phases 7
orc-state phase set 6
# one call per stacked PR:
orc-state link-pr --repo <r> --url <u> --number <n> --stack-id <id> --stack-position <p> [--stacked-on <u2>]
```

NOTE: schema per `orc:state-protocol`; never hand-write the registry entry.
