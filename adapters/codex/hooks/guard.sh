#!/usr/bin/env bash
# Exit 2 blocks the tool if the adapter cannot start.
root="${PLUGIN_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
if ! command -v python3 >/dev/null 2>&1 || [ ! -f "$root/hooks/guard.py" ]; then
  cat >/dev/null
  echo 'orc guard unavailable; install Python 3 and reinstall orc.' >&2
  exit 2
fi
python3 "$root/hooks/guard.py"
rc=$?
if [ "$rc" -ne 0 ]; then
  echo 'orc guard failed; operation blocked.' >&2
  exit 2
fi
