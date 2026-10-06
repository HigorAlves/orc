---
type: regex
target: { source: file, path: last-commit.txt }
pattern: 'Co-Authored-By|Generated with|noreply@anthropic\.com'
flags: i
match: not_contains
---
