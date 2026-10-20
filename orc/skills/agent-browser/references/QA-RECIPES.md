# QA recipes (orc-qa-validator)

Command shapes for each step of the `orc-qa-validator` workflow. `agent-browser skills get core` is the source of truth for the installed version; prefer it when the two disagree.

## Open, capture, record

```bash
agent-browser open <url>
agent-browser network har start

# record start succeeds optimistically; only record stop fails without ffmpeg
command -v ffmpeg >/dev/null 2>&1 && \
  agent-browser record start "<qa-dir>/qa-<sanitized-branch>.webm"

agent-browser set viewport 375 667 2          # iPhone-ish
agent-browser set device "iPhone 14"          # or a named device
```

## Walk a step

```bash
agent-browser snapshot                                           # accessibility tree with @eN refs
agent-browser screenshot --annotate "<qa-dir>/screenshot-NN-<step-slug>.png"
agent-browser screenshot --annotate "<qa-dir>/ac-<sliceId>-<idx>-<criterion-slug>.png"  # at the moment a criterion is observable

agent-browser click @e2
agent-browser fill @e3 "test@example.com"
agent-browser press Enter

agent-browser find role button click --name "Submit"             # semantic locators when refs are unstable
agent-browser find label "Email" fill "test@example.com"

agent-browser wait --text "Welcome"
agent-browser wait --url "**/dashboard"
agent-browser wait --load networkidle

agent-browser batch "open <url>" "snapshot" "screenshot --annotate <qa-dir>/screenshot-01-loaded.png"
```

## Edge cases

- Validation errors: submit empty required fields and wrong formats; screenshot the inline error.
- Empty state: a fresh user, or a stubbed API.
- Failure state:

```bash
agent-browser network route "**/api/billing" --abort
agent-browser network route "**/api/billing" --body '{"error":"server"}'
```

- Loading or suspense: throttle the network (project-dependent; DevTools or Chrome flags).
- Auth states: signed-in and signed-out when the change applies to both.

## Capture artifacts

```bash
agent-browser network har stop "<qa-dir>/network.har"
agent-browser console > "<qa-dir>/console.log"
agent-browser snapshot > "<qa-dir>/snapshot-final.txt"
command -v ffmpeg >/dev/null 2>&1 && agent-browser record stop   # before close, or the file is lost
agent-browser close
```

Optional GIF for ticket embedding (a GIF renders inline in Jira; a WebM does not):

```bash
ffmpeg -y -i "<qa-dir>/qa-<branch>.webm" -vf "fps=8,scale=960:-1:flags=lanczos" \
  "<qa-dir>/qa-<branch>.gif" || echo "gif conversion failed — webm stands"
```

Optional, never required:

- Chrome DevTools trace: `agent-browser trace start "<qa-dir>/trace.json"` … `agent-browser trace stop`.
- React render profile: `agent-browser react renders start` / `stop --json > "<qa-dir>/react-renders.json"`.
- Web Vitals: `agent-browser vitals --json > "<qa-dir>/vitals.json"`.
