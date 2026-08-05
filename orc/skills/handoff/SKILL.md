---
name: handoff
description: "Compact the current conversation into a redacted handoff document, saved to the OS temp dir, that a fresh agent in another session or tool can pick up — /orc:resume is the counterpart for resuming in-repo orc state."
disable-model-invocation: true
argument-hint: "What will the next session be used for?"
license: MIT
metadata:
  author: Matt Pocock
  source: Vendored from https://github.com/mattpocock/skills @ 2ffb184
---

Write a handoff document summarising the current conversation so a fresh agent can continue the work. Save to the temporary directory of the user's OS - not the current workspace.

Include a "suggested skills" section in the document, which suggests skills that the agent should invoke.

Do not duplicate content already captured in other artifacts (specs, plans, ADRs, issues, commits, diffs). Reference them by path or URL instead.

Redact any sensitive information, such as API keys, passwords, or personally identifiable information.

If the user passed arguments, treat them as a description of what the next session will focus on and tailor the doc accordingly.
