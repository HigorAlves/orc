# Driver A — agent-browser (dispatch the validator)

Disclosed from `orc:browser-qa`. Read when the driver gate resolved to `agent-browser`, or when Driver P returned `fallback`.

## Driver A — agent-browser (dispatch the validator)

Dispatch the `orc-qa-validator` subagent via `Task`. Pass:

- The feature description.
- **`appUrl` + `serviceEndpoints` + `envStatePath`** from `docker-env-state.json` (the validator NEVER boots infra when env state exists — it attaches). Pass `baseUrl` from the resolved target; under `--no-env`, legacy boot instructions.
- The artifact directory.
- **The acceptance lists from step 2**, each criterion tagged with its slice id and index — the agent captures a dedicated `ac-<sliceId>-<idx>-<slug>.png` at the moment each criterion is observable and scores it evidence-cited, instead of narrating vibes.
- **Whether the change is visual** (the diff touches a rendered surface) — when it is, the agent records the walk via `agent-browser record`. That recorder wraps `ffmpeg`: with ffmpeg installed the WebM is a required artifact; without it the run passes on stills and says so in one line. Never a silent omission, never an install.
- **Workspace mode only**: `repo` (the web-surface repo), `repoPath`, `siblingRepos` (already running via the provisioned environment — verify their traffic through `serviceEndpoints` in the HAR; the agent does NOT touch them), and `crossRepoContract` (when present in the plan — the agent walks an integration golden path that exercises the contract end-to-end).

The agent walks the golden path + edge cases, captures the evidence, writes `steps.md` and **`qa-manifest.json`**, and returns its verdict + a ≤3-line summary. **Read `qa-manifest.json` for the artifact list, the curated selection, and the per-criterion results — do NOT re-read `steps.md`.** `pass` → proceed; `fail`/`partial` → surface the failure with the artifact named in the failing acceptance row. The evidence-publish step takes the same manifest as its pre-curated payload.
