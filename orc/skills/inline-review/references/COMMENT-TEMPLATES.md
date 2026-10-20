# Comment-body templates and helpers

Disclosed from `orc:inline-review`. Read when writing a comment body: the suggestion-block format, one template per finding kind, the gh helpers, and the GitHub docs links.

## Suggestion block format

Format inside the comment `body`:

````
Brief prose description of the problem.

```suggestion
const token = parseToken(req);
if (!token) return res.status(401).end();
```

Optional follow-up prose (caveat, edge case, etc.).
````

If `suggestion_code` is set on a finding but doesn't meet the rules above, drop it from the suggestion block and keep the prose only.

## Comment-body templates

### Bug with concrete fix (suggestion block fits)

````
Null deref when `req.headers.authorization` is missing — `parseToken()` returns null and the next line accesses `.userId` unconditionally. 500 to client, no log.

```suggestion
const token = parseToken(req);
if (!token) return res.status(401).end();
```
````

### Bug without concrete fix (prose only)

```
Race condition: `cycleParticipants.id` is read in line 507 then mutated in line 512 by a concurrent worker. The intermediate state can leak into the cycleDetails projection. Either lock the row in the outer transaction or refetch after mutation.
```

### Test gap (no suggestion possible)

```
`evaluateeAllowedByStepFilter` has no test for `participants: []` (array, not object). `typeof [] === 'object'` passes the guard; `p.blacklistedUsers` is undefined; `safeIds(undefined)` returns []; the filter silently allows everyone. Add a test case with `participants: []` to pin the fail-open behavior, OR add an `Array.isArray(p)` guard.
```

### Question (low confidence, asking author)

```
q: This new `getWorkflowOverview` endpoint duplicates the admin router's. Is the intent to migrate one to the other, or are they meant to diverge? If the latter, worth a comment explaining the split.
```

## Getting help

```bash
# Inspect what the gh api invocation will look like (dry-run alternative)
echo "$PAYLOAD_JSON" | jq .

# After posting, fetch the posted review for verification
gh api repos/${OWNER}/${REPO}/pulls/${PR}/reviews/${REVIEW_ID}

# List all reviews on a PR
gh pr view ${PR} --json reviews
```

## References

- GitHub REST API — Reviews: https://docs.github.com/en/rest/pulls/reviews
- Suggestion block format: https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/reviewing-changes-in-pull-requests/incorporating-feedback-in-your-pull-request#applying-suggested-changes
- Sibling skills: `orc:gh-cli` (the gh CLI / API surface), `orc:caveman-review` (tone discipline for comment bodies).
