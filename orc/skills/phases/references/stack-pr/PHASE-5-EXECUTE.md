<!-- orc:stack-pr/P5 -->
_Loaded on demand via orc:phases. Do not run this phase from memory — this file is the phase._

# Phase 5 — Execute: backup, reshape, push, open PRs

> **⚠️ Caution**
>
> Steps 2–3 rewrite branch history. Step 1 is the non-negotiable backup.

1. Create the backup branch: `git branch "${current_branch}-pre-stack-backup"`.
2. For each slice in order, run the reshape loop below.
3. If a cherry-pick fails, print the danger callout and the abort commands below, then stop.

> **🛑 Outward write**
>
> Steps 4–5 push branches and open PRs.

4. Push and open the PRs with the path P1 chose, below.
5. Capture each created PR URL.
6. If any PR creation fails, print the recovery script (`orc:stack-pr` skill, Recovery) and stop.

Reshape loop:

```bash
git checkout "$base_ref"
git checkout -b "$slice_branch"
for sha in "${cherry_pick[@]}"; do
  git cherry-pick --no-edit "$sha" || exit 1
done
```

Cherry-pick failure:

```markdown
> **🛑 Cherry-pick of <sha> failed**
>
> Your original branch is safe in `${current_branch}-pre-stack-backup`.
```

```
git cherry-pick --abort && git reset --hard ${current_branch}-pre-stack-backup
```

NOTE: the fenced abort is the quick path. Full teardown of a partial stack follows the `orc:stack-pr` skill's Recovery section.

`gh-stack` path:

```bash
gs push                                   # pushes every layer
gs submit --base "$base"                  # creates the chained PRs
```

Then capture each URL via `gh pr list --json number,url,headRefName --limit $N`, filtered to the new branch names.

Plain-gh fallback:

```bash
for i in 1..N; do
  prev=$([ $i -eq 1 ] && echo "$base" || echo "$slice_branch_$((i-1))")
  git push -u origin "$slice_branch_$i"
  gh pr create --base "$prev" --head "$slice_branch_$i" \
    --title "[$i/$N] $subject_i" \
    --body "$body_placeholder_i" \
    ${ARG_DRAFT:+--draft}
done
```
