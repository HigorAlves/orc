---
type: tool_order
before: { tool: Bash, input_match: 'git (switch (-c|--create)|checkout -b) ' }
after: { tool: Bash, input_match: 'git commit' }
---
