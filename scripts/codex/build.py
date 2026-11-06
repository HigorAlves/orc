#!/usr/bin/env python3
"""Build the checked-in, self-contained Codex distribution from shared sources."""
import argparse
import json
import re
import shutil
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DEST = ROOT / 'codex/orc'


def split(text):
    if text.startswith('---\n'):
        _, front, body = text.split('---', 2)
        return front, body.lstrip()
    return '', text


def adapt(text):
    text = re.sub(r'^!`([^`]+)`$', r'Run `\1` in the working repository and read its output before continuing.', text, flags=re.M)
    text = re.sub(r'Context is injected above \([^\n]+\)\.', 'Run context detection explicitly; shell environments do not persist between calls.', text)
    text = re.sub(r'The context banner is injected below[^\n]*:', 'Run the context command below in the working repository:', text)
    text = text.replace('Read the banner above; `ORC_*` vars are exported. Do not re-run detection.', 'Read the detected context; initialize ORC_* variables explicitly in each shell that needs them.')
    text = text.replace('Context banner (already injected via `!` preprocessing).', 'Context banner from an explicit orc-workspace-detect invocation.')
    for name in ('executing-plans', 'finishing-a-development-branch', 'using-git-worktrees', 'writing-plans'):
        text = text.replace('superpowers:' + name, 'orc-' + name)
    text = text.replace('superpowers:subagent-driven-development', 'the bundled orc-implementer role (dispatch per RUNTIME.md)')
    text = text.replace('superpowers:code-reviewer', 'orc-pr-reviewer')
    text = text.replace('CLAUDE_PLUGIN_ROOT', 'PLUGIN_ROOT')
    text = text.replace('CLAUDE.md', 'AGENTS.md')
    text = text.replace('1. **User instructions** (AGENTS.md, direct requests) — always win.\n2. **orc skills** — override default system behavior where they conflict.\n3. **Default system prompt** — lowest.', 'Follow system and developer instructions, then user instructions and project guidance, then orc workflows.')
    text = text.replace('AskUserQuestion', 'the available user-question tool (or ask in chat)')
    text = text.replace('SendMessage', 'the available agent continuation tool')
    text = text.replace('`Task` calls', 'agent spawn calls')
    text = text.replace('`Skill` tool', 'bundled skill instructions')
    text = text.replace('mcp__orc__step', 'orc-state slice set')
    text = re.sub(r'model: ["\'](?:opus|sonnet|haiku)["\']', 'inherit the configured Codex model', text)
    text = re.sub(r'/orc:([a-z][a-z0-9-]*)', r'$orc-\1', text)
    # Internal skill references resolve to the supporting skill, even on command collisions.
    text = re.sub(r'(?<![\w/])orc:([a-z][a-z0-9-]*)', r'orc-\1', text)
    return text


def write(path, text):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text)


def build(out):
    tracked = subprocess.check_output(['git', 'ls-files', 'orc'], cwd=ROOT, text=True).splitlines()
    for name in tracked:
        rel = Path(name).relative_to('orc')
        if rel.parts[0] not in {'skills', 'commands', 'agents', 'bin', 'lib'}:
            continue
        if name.endswith('SKILL.md'):
            rel = Path('content') / rel.parent / 'SKILL.md'
        elif rel.parts[0] in {'skills', 'commands', 'agents'}:
            rel = Path('content') / rel
        target = out / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(ROOT / name, target)
        if target.suffix == '.md':
            target.write_text(adapt(target.read_text()))
    # Keep supporting filenames intact outside the discoverable skills directory.
    for name in ('LICENSE', 'THIRD-PARTY-LICENSES.md'):
        shutil.copy2(ROOT / name, out / name)
    catalog = {}
    for kind, glob in [('skills', '*/SKILL.md'), ('commands', '*.md')]:
        for src in sorted((ROOT / 'orc' / kind).glob(glob)):
            name = src.parent.name if kind == 'skills' else src.stem
            front, _ = split(src.read_text())
            desc = re.search(r'^description: (.+)$', front, re.M)
            description = (desc.group(1).strip().strip('"\'') if desc else f'Run the orc {name} workflow.')
            entry = catalog.setdefault(name, {})
            entry[kind] = f'content/{kind}/{name}/SKILL.md' if kind == 'skills' else f'content/commands/{name}.md'
            entry['description'] = adapt(description).replace('<', '(').replace('>', ')')
            entry['explicit_only'] = bool(re.search(r'^disable-model-invocation: true$', front, re.M))
    for name, entry in catalog.items():
        target = entry.get('commands', entry.get('skills'))
        body = f'''---
name: orc-{name}
description: {json.dumps(entry['description'])}
---

Read `../../RUNTIME.md` first, then `../../{target}` and follow that workflow.
Resolve paths relative to this installed skill directory. The plugin root is two directories above it.
Pass the user's arguments to the workflow. Load referenced phase modules only when needed.
'''
        write(out / 'skills' / f'orc-{name}' / 'SKILL.md', body)
        write(out / 'skills' / f'orc-{name}' / 'agents/openai.yaml', ('policy:\n  allow_implicit_invocation: false\n' if entry['explicit_only'] else '') + f'interface:\n  display_name: "orc {name}"\n  short_description: "Run the orc {name} workflow"\n')
    source = json.loads((ROOT / 'orc/.claude-plugin/plugin.json').read_text())
    manifest = {k: source[k] for k in ('name', 'version', 'author', 'homepage', 'repository', 'license')}
    manifest.update(description='Full-SDLC workflows for Codex: plan, implement, QA, ship, CI and release.', skills='./skills/', hooks='./hooks/hooks.json')
    write(out / '.codex-plugin/plugin.json', json.dumps(manifest, indent=2) + '\n')
    for src in (ROOT / 'adapters/codex').rglob('*'):
        if src.is_file():
            target = out / src.relative_to(ROOT / 'adapters/codex')
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, target)
    playwright = (ROOT / 'orc/skills/playwright-qa/SKILL.md').read_text()
    execution = '## 2. Plan' + playwright.split('## 2. Plan', 1)[1]
    write(out / 'content/skills/playwright-qa/EXECUTION.md', adapt(execution))
    for src in (ROOT / 'orc/hooks/scripts').glob('*.sh'):
        target = out / 'hooks/shared' / src.name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, target)
    write(out / 'catalog.json', json.dumps(catalog, indent=2, sort_keys=True) + '\n')


def snapshot(folder):
    return {str(p.relative_to(folder)): (p.read_bytes(), p.stat().st_mode & 0o111)
            for p in folder.rglob('*') if p.is_file()}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    with tempfile.TemporaryDirectory(prefix='orc-codex-') as tmp:
        out = Path(tmp)
        build(out)
        if args.check:
            if snapshot(out) != snapshot(DEST):
                raise SystemExit('Codex bundle is stale. Run python3 scripts/codex/build.py')
        else:
            if DEST.exists():
                shutil.rmtree(DEST)
            shutil.copytree(out, DEST)
    print('Codex bundle verified' if args.check else 'Codex bundle generated')


if __name__ == '__main__':
    main()
