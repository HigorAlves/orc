---
name: research
description: "Delegate a research question to a background agent that reads primary sources — official docs, source code, specs, first-party APIs — and lands the findings as a cited Markdown file in the repo. Use when an orc planning or implementation step needs docs or API facts verified at the source, when the user asks to research a topic, or when reading legwork should run in the background while work continues."
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
