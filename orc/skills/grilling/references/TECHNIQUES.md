# Elicitation techniques

Named reasoning frames for a grilling round. The default round — ask the frontier, recommend an answer — is the right tool most of the time. Reach for a technique when the default has stopped producing new information: the answers are coming back plausible-but-thin, or the frontier keeps returning "seems fine."

## How to use them

1. Pick **one** technique per round. Say which one, and why: _"Running a pre-mortem on the migration plan — the frontier went quiet and this design has one obvious way to fail badly."_
2. Apply it to a **specific decision**, never the whole design. "Red-team the auth flow" works; "red-team the plan" produces noise.
3. Take what it surfaces back to the normal round structure. A technique generates questions; it does not replace the interview.
4. **Stop after two.** Techniques have sharply diminishing returns, and stacking them past two reliably produces invented problems.

## The menu

| Technique | Ask | Best for |
|---|---|---|
| **Pre-mortem** | "It's six months from now and this failed. What's the story?" | Plans and migrations — anything with a schedule |
| **Inversion** | "How would I guarantee this fails?" then avoid each answer | Hidden risk in something that looks safe |
| **First principles** | Strip every assumption; rebuild from what must be true | Architecture, and inherited designs nobody has re-justified |
| **Red team / blue team** | Attack it, then defend it, in that order | Security, auth, edge cases, adversarial input |
| **Socratic** | "Why?" and "how do you know?" against each claim, repeatedly | Confident assertions with no evidence behind them |
| **Constraint removal** | Drop every constraint, design freely, then re-apply one at a time | When a constraint everyone accepted turns out to be assumed |
| **Stakeholder mapping** | Re-read the design as each affected party | Requirements gaps, and cross-team work |

### Pre-mortem

State the failure as accomplished fact — "the migration shipped and we rolled it back in week two" — then work backward for the cause. The past tense matters: it licenses concreteness that "what could go wrong?" never gets, because a hypothetical invites hedging and a post-hoc explanation invites detail.

Best on plans with a timeline. Weakest on pure interface design, where there is no story to tell.

### Inversion

Ask how to *guarantee* failure, list the mechanisms, then check which the current design already permits. Inversion finds omissions — the missing timeout, the unhandled empty state — where forward reasoning finds only what is present.

### First principles

Name every assumption the design rests on, then ask of each: is this a fact, or an inheritance? Rebuild from the facts. Expect this to be slow and to occasionally rediscover the existing design, which is a real result and not a wasted round.

Use it when a design was inherited and nobody present can say why it is shaped this way.

### Red team / blue team

Two passes, strictly ordered. Attack first — enumerate concrete exploits and abuses, not categories. Then defend each, honestly: some attacks are already mitigated, and saying so is the point of the second pass.

Attacking without defending produces a list of scary-sounding non-issues.

### Socratic questioning

Against each claim: why do you believe it, how would you know if it were false, what would change your mind. Three levels deep is usually where the real assumption sits.

Sharpest against confident claims — which is exactly where the default round is least likely to push.

### Constraint removal

List the constraints, drop them all, design the thing you would actually build. Then re-apply constraints one at a time and watch which one costs the most. Frequently the expensive constraint turns out to be assumed rather than real — nobody ever checked, and the check is cheap.

### Stakeholder mapping

Enumerate everyone the change touches — end users, on-call, support, the team that owns the neighbouring service, whoever operates it. Re-read the design as each. Requirements gaps show up as "nobody asked what happens to X."

## The honest caveat

Every technique here **instructs you to find problems**, so you will find some — including ones that are not there. Expect a false-positive rate: nitpicks dressed as risks, misread intent, invented failure modes.

Filtering is the point of the round, not a step you can skip. Take each finding back to the user as a question with your read attached, exactly as the default round does. A technique that produces ten findings and no filter has made the design worse, not better — it has moved judgment from the interview into a list.
