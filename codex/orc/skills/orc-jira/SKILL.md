---
name: orc-jira
description: "Manage Jira tickets via acli, and bind/unbind a ticket key to the current orc session \u2014 persists jiraTicket in .orc/orc.json + checkpoint.md so $orc-status, $orc-resume, and $orc-ship all see the link."
---

Read `../../RUNTIME.md` first, then `../../content/commands/jira.md` and follow that workflow.
Resolve paths relative to this installed skill directory. The plugin root is two directories above it.
Pass the user's arguments to the workflow. Load referenced phase modules only when needed.
