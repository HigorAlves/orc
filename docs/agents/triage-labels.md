# Triage labels

orc's triage surfaces speak in canonical roles; this table maps them to the label strings used in this repo's tracker. The defaults are kept as-is: every label string equals its role name.

| Canonical role    | Label in this tracker | Meaning                                  |
| ----------------- | --------------------- | ---------------------------------------- |
| `bug`             | `bug`                 | Category: something is broken            |
| `enhancement`     | `enhancement`         | Category: new feature or improvement     |
| `needs-triage`    | `needs-triage`        | Maintainer needs to evaluate             |
| `needs-info`      | `needs-info`          | Waiting on reporter for more information |
| `ready-for-agent` | `ready-for-agent`     | Fully specified, ready for an AFK agent  |
| `ready-for-human` | `ready-for-human`     | Requires human implementation            |
| `wontfix`         | `wontfix`             | Will not be actioned                     |

When a skill mentions a role ("apply the AFK-ready label"), use the corresponding string from this table. `needs-info` issues close after 14 days without a reply (`.github/workflows/needs-info.yml`); a reporter's comment returns them to `needs-triage`.
