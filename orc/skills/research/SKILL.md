---
name: research
description: "Delegate a research question to a background agent that reads primary sources and lands cited findings as a Markdown file in the repo. Use when the user asks to research a topic, when docs or API facts need verifying at the source, or when reading legwork should run in the background."
license: MIT
metadata:
  author: Matt Pocock
  source: Vendored from https://github.com/mattpocock/skills @ 2ffb184
---

Spin up a **background agent** to do the research, so you keep working while it reads.

Its job:

1. Investigate the question against **primary sources** — official docs, source code, specs, first-party APIs — not a secondary write-up of them. Follow every claim back to the source that owns it.
2. Write the findings to a single Markdown file, citing each claim's source.
3. Save it where the repo already keeps such notes; match the existing convention, and if there is none, put it somewhere sensible and say where.
