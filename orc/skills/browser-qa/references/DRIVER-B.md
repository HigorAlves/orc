# Driver B — Claude-in-Chrome (run inline; the user is watching)

Disclosed from `orc:browser-qa`. Read when the driver gate resolved to `chrome`.

## Driver B — Claude-in-Chrome (run inline; the user is watching)

Do NOT dispatch `orc-qa-validator` — the extension binds to the user's browser through THIS session. Run the QA yourself, narrating each step in one short line as you go:

1. Load the extension tools in ONE `ToolSearch` call: `tabs_context_mcp`, `navigate`, `computer`, `read_page`, `tabs_create_mcp`, `read_console_messages`, `read_network_requests`, `gif_creator` (+ `form_input` when the flow has forms). Call `tabs_context_mcp` first; if the extension is not connected, surface it and fall back to Driver A (note the switch — never silently).
2. **Create a NEW tab** for the appUrl — never drive the user's existing tabs unless they explicitly asked. Start a GIF recording via `gif_creator` (name it `qa-<sanitized-branch>.gif`, capture extra frames around each action). Avoid any element that triggers JS `alert`/`confirm` dialogs — they freeze the extension; test those paths under Driver A instead.
3. Walk the **same golden path + edge cases** the `orc-qa-validator` protocol prescribes (validation errors, empty state, failure state where reachable without request mocking, auth states), **driven by the step-2 acceptance criteria**. Number every step and narrate it in one line. When a step is the moment a criterion becomes observable, say so in the narration — that step number is the criterion's evidence anchor.
4. Capture the chrome-mode evidence packet into `<qa-dir>` via `Write`:
   - `qa-<branch>.gif` — the recording (replaces per-step screenshot files; in-conversation screenshots are referenced by step number in `steps.md`)
   - `qa-manifest.json` — the machine-readable packet spine (shape in [`orc:state-protocol`'s schema](../../state-protocol/references/schema.md)): `driver: "chrome"`, artifacts, curated selection, and one `acceptance[]` row per criterion
   - `snapshot-final.txt` — final `read_page` output
   - `console.log` — `read_console_messages` output (filter noise with `pattern` but state the filter used)
   - `network-summary.md` — distilled `read_network_requests` output: method, endpoint, status per request + notable bodies (replaces `network.har`)
   - `steps.md` — same template and verdict rules as the validator's, with a `### Step <N>` heading per narrated step
5. Same verdict handling: `pass` → proceed; `fail`/`partial` → surface with the failing step + console/network line.

**Chrome-mode evidence trade-off, stated plainly:** the extension returns screenshots into the conversation and `Write` cannot emit binary, so chrome mode produces **no per-criterion PNG on disk**. A criterion's `evidence[]` entry is therefore `qa-<branch>.gif#step-<N>`, pointing at the numbered `### Step <N>` heading in `steps.md`. That is weaker than Driver A's annotated per-criterion shot — it is the cost of watching live, not a loophole. Every criterion still gets a result and an anchor.
