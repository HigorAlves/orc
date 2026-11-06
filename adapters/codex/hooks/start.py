#!/usr/bin/env python3
import json
from pathlib import Path
import shutil
import sys

sys.stdin.read()
root = Path(__file__).resolve().parents[1]
missing = [name for name in ('git', 'jq', 'python3') if not shutil.which(name)]
context = f'orc is installed at {root}. Read {root}/RUNTIME.md before an orc workflow. Use its skills for relevant tasks. Resume interrupted work through $orc-resume and verify persisted state against Git.'
output = {'hookSpecificOutput': {'hookEventName': 'SessionStart', 'additionalContext': context}}
if missing:
    output['systemMessage'] = 'orc missing runtime tools: ' + ', '.join(missing)
print(json.dumps(output))
