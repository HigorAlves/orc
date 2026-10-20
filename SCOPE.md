# Scope

orc is a full-SDLC Claude Code plugin built around one loop: plan → implement → QA → ship → CI → release, with hooks that enforce the discipline instead of asking for it. It is curated: ideas are welcome, and each one is judged against the bar below. Issues track changes to orc; questions and discussion go to [GitHub Discussions](https://github.com/HigorAlves/orc/discussions).

## The bar

A bug or idea stays open only if it clears **both** parts:

1. **Observed failure.** It describes something that went wrong in a real session: the surface (`/orc:flow`, `orc:tdd`, `orc-implementer`, a hook), the orc and Claude Code versions, the model, what you ran, what orc did, and what you expected. A hypothetical improvement ("it would be better if…") does not clear this part.
2. **Fits the philosophy.** It does not match an entry in [`docs/agents/out-of-scope.md`](./docs/agents/out-of-scope.md) or a past rejection, and it is not a config knob, a harness-specific branch for a harness orc does not target, or a tweak to suit one person's workflow. Those belong in your own `CLAUDE.md`, in `userConfig`, or in a fork.

Size is irrelevant: a one-word fix and a rewrite face the same bar. Reactions and +1 comments do not count towards it.

## New surfaces

A new skill, command, or agent is accepted only when the behaviour cannot be composed from what orc already ships, and only with the CI gates it needs (`scripts/ci/verify-*.sh`, the eval suite where routing changes). Every surface is permanent maintenance: it has to stay in step with the router (`orc:map`), the catalog (`docs/commands.md`), the counts, and the examples. Fewer, sharper surfaces are cheaper to keep correct.

## Vendored skills

Fifteen skills are vendored or derived from MIT-licensed upstreams (`THIRD-PARTY-LICENSES.md`), tracked at a pinned commit. A failure in one of them is judged like any other issue; a request to resync with upstream names the upstream change and the session where its absence bit. Upstream deltas are absorbed in trains, not one commit at a time.

## Unclear issues

An issue that can't be judged against the bar gets one round of questions and the `needs-info` label. With no reply from the reporter in 14 days, it is closed (`.github/workflows/needs-info.yml`). Rejections close as "not planned", and a rejected enhancement is recorded in `docs/agents/out-of-scope.md` so it is not re-litigated.

## How issues move

`/orc:triage` runs this repo's own queue, with the labels in [`docs/agents/triage-labels.md`](./docs/agents/triage-labels.md): every new issue is `needs-triage`; from there it becomes `needs-info`, `ready-for-agent`, `ready-for-human`, or `wontfix`.
