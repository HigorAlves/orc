<!-- orc:incident/P3 -->
_Loaded on demand via orc:phases. Do not run this phase from memory — this file is the phase._

# Phase 3 — Mitigate-first path

> **🛑 No production mutations**
>
> Never auto-execute a deploy, a flag flip or a scaling call, even when every binary is available. Present options; the user executes; orc records.

1. Build each option below from the evidence: suspect deploy, feature area, load signature.
2. Present them as options, never as executed actions.
3. For the option the user picks, print the danger preview below before anything state-changing.
4. Ask via `AskUserQuestion` with the three options listed below.
5. On "I ran it", append the timeline row.
6. Re-run `sentry issue view <SHORT-ID> --json`; compare `lastSeen` and the event rate.
7. Without Sentry, ask the user for the dashboard reading.
8. Record the verification in the timeline.
9. Once mitigated, bump the checkpoint to phase=3-done.
10. Offer the root-cause path: Read `orc:incident/P4`.

Mitigation options:

- Rollback — identify the suspect deploy from the P2 correlation. Name the exact target ("revert to `<sha>`" or "redeploy release `<version>`") and the project's deploy mechanism when discoverable (CI workflow, deploy script).
- Feature flag off — when the code path behind the failing frames is flag-gated (`Grep` for flag names near the culprit), name the flag and the kill switch.
- Scale or shed load — when the signature is saturation (timeouts, OOM, queue depth) rather than a code defect: scale replicas up, enable rate limiting, shed non-critical traffic.

Danger preview:

```markdown
> **🛑 Mitigation preview — NOT executed**
>
> Exact commands/steps below. /orc:incident does not run production mutations — you (or your deploy tooling) execute; orc records.
```

```
<the exact commands or console steps>
```

`AskUserQuestion` options: "I ran it — record in timeline" / "Show a different option" / "Abort mitigation".

NOTE: mitigation without a root cause is a snooze button, not a fix.
