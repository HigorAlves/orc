#!/usr/bin/env python3
"""Translate shared guard verdicts to Codex's supported allow/deny contract."""
import json
import os
from pathlib import Path
import subprocess
import sys


def deny(reason):
    print(json.dumps({'hookSpecificOutput': {'hookEventName': 'PreToolUse', 'permissionDecision': 'deny', 'permissionDecisionReason': reason}}))


def main():
    try:
        payload = json.load(sys.stdin)
        command = payload['tool_input']['command']
        if not isinstance(command, str):
            raise ValueError('missing command string')
        root = Path(__file__).resolve().parents[1]
        env = dict(os.environ, CLAUDE_PLUGIN_ROOT=str(root))
        result = subprocess.run(['bash', str(root / 'hooks/shared/pre-git-guard.sh')], input=json.dumps(payload), text=True, capture_output=True, cwd=payload.get('cwd') or os.getcwd(), env=env, timeout=20)
        if result.returncode:
            raise ValueError('shared guard failed')
        if not result.stdout.strip():
            return
        verdict = json.loads(result.stdout)['hookSpecificOutput']
        if verdict['permissionDecision'] not in ('ask', 'deny'):
            raise ValueError('unexpected guard verdict')
        reason = verdict['permissionDecisionReason']
        if "is a protected branch" in reason:
            reason = reason.split(' Approve only')[0] + ' Codex blocks this operation; use a feature branch.'
        deny(reason)
    except Exception as exc:
        deny(f'orc guard could not validate this operation: {exc}')


if __name__ == '__main__':
    main()
