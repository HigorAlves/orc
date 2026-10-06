---
type: regex
target: { source: file, path: last-commit.txt }
pattern: '^(feat|fix|docs|style|refactor|perf|test|build|ci|chore)(\([^)]+\))?!?: \S'
---
