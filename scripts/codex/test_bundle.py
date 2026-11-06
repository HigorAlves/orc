import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
BUNDLE = ROOT / 'codex/orc'


class BundleTests(unittest.TestCase):
    def test_catalog(self):
        catalog = json.loads((BUNDLE / 'catalog.json').read_text())
        for kind, pattern in [('commands', '*.md'), ('skills', '*/SKILL.md')]:
            for src in (ROOT / 'orc' / kind).glob(pattern):
                name = src.stem if kind == 'commands' else src.parent.name
                self.assertTrue((BUNDLE / catalog[name][kind]).is_file(), name)
                self.assertTrue((BUNDLE / 'skills' / f'orc-{name}' / 'SKILL.md').is_file())
        self.assertEqual(len(list((BUNDLE / 'content/agents').glob('*.md'))), len(list((ROOT / 'orc/agents').glob('*.md'))))
        for skill in (BUNDLE / 'skills').glob('*/SKILL.md'):
            lines = skill.read_text().splitlines()
            self.assertEqual(lines[0], '---')
            self.assertEqual(lines[1], 'name: ' + skill.parent.name)
            description = json.loads(lines[2].removeprefix('description: '))
            self.assertTrue(0 < len(description) <= 1024)
            self.assertNotIn('<', description)
            self.assertNotIn('>', description)
        self.assertFalse(list(BUNDLE.rglob('node_modules')))
        self.assertFalse(any(p.is_symlink() for p in BUNDLE.rglob('*')))

    def test_internal_references(self):
        import re
        for path in (BUNDLE / 'content').rglob('*.md'):
            self.assertIsNone(re.search(r'^!`', path.read_text(), re.M), str(path))
            self.assertNotIn('superpowers:', path.read_text(), str(path))
            for name in re.findall(r'`orc-([a-z][a-z0-9-]*)`', path.read_text()):
                candidates = [BUNDLE / 'content/skills' / name / 'SKILL.md',
                              BUNDLE / 'content/commands' / f'{name}.md',
                              BUNDLE / 'content/agents' / f'orc-{name}.md',
                              BUNDLE / 'bin' / f'orc-{name}']
                self.assertTrue(any(p.is_file() for p in candidates), f'{path}: {name}')

    def test_authoring_keeps_skill_entrypoint_name(self):
        guide = (BUNDLE / 'content/skills/skill-writing/SKILL.md').read_text()
        self.assertIn('SKILL.md', guide)
        self.assertNotIn('GUIDE.md', guide)

    def test_codex_playwright_does_not_write_claude_config(self):
        with tempfile.TemporaryDirectory() as tmp:
            for command in ('init-agents', 'mcp-merge'):
                result = subprocess.run([str(BUNDLE / 'bin/orc-playwright'), command, tmp,
                                         '--dir', 'e2e', '--config', 'e2e/playwright.config.ts'],
                                        text=True, capture_output=True)
                self.assertEqual(result.returncode, 2)
                self.assertIn('agent-browser', result.stderr)
                self.assertEqual(list(Path(tmp).iterdir()), [])

    def test_playwright_preserves_guarded_execution(self):
        execution = (BUNDLE / 'content/skills/playwright-qa/EXECUTION.md').read_text()
        self.assertIn('--grep-invert @mutating', execution)
        self.assertIn('ORC_TARGET_JSON=', execution)
        self.assertIn('## 5. Heal', execution)
        self.assertIn('## 6. Evidence', execution)
        guide = (BUNDLE / 'content/skills/playwright-qa/SKILL.md').read_text()
        self.assertIn('Read `EXECUTION.md`', guide)

    def test_reproducible(self):
        subprocess.run(['python3', str(ROOT / 'scripts/codex/build.py'), '--check'], check=True)

    def test_guards(self):
        with tempfile.TemporaryDirectory() as tmp:
            subprocess.run(['git', 'init', '-b', 'main', tmp], check=True, capture_output=True)
            def guard(command, overrides=None):
                env = dict(os.environ, PLUGIN_ROOT=str(BUNDLE))
                env.pop('ORC_ALLOW_DESTRUCTIVE_GIT', None)
                env.pop('ORC_ALLOW_AI_ATTRIBUTION', None)
                env.update(overrides or {})
                result = subprocess.run(['bash', str(BUNDLE / 'hooks/guard.sh')], input=json.dumps({'cwd': tmp, 'tool_name': 'Bash', 'tool_input': {'command': command}}), text=True, capture_output=True, env=env, check=True)
                return json.loads(result.stdout)['hookSpecificOutput']['permissionDecision'] if result.stdout else 'allow'
            self.assertEqual(guard('git status'), 'allow')
            self.assertEqual(guard('git commit -m test'), 'deny')
            self.assertEqual(guard('git push origin main'), 'deny')
            self.assertEqual(guard('git reset --hard'), 'deny')
            self.assertEqual(guard('git reset --hard', {'ORC_ALLOW_DESTRUCTIVE_GIT': '1'}), 'allow')
            subprocess.run(['git', '-C', tmp, 'switch', '-c', 'feature'], check=True, capture_output=True)
            self.assertEqual(guard('git commit -m test'), 'allow')
            self.assertEqual(guard('git commit -m "Generated with Claude Code"'), 'deny')

    def test_malformed_input_blocks(self):
        result = subprocess.run(['python3', str(BUNDLE / 'hooks/guard.py')], input='invalid', text=True, capture_output=True, check=True)
        self.assertEqual(json.loads(result.stdout)['hookSpecificOutput']['permissionDecision'], 'deny')

    def test_missing_shared_guard_blocks(self):
        import shutil
        with tempfile.TemporaryDirectory() as tmp:
            hooks = Path(tmp) / 'hooks'
            hooks.mkdir()
            shutil.copy(BUNDLE / 'hooks/guard.py', hooks / 'guard.py')
            result = subprocess.run(['python3', str(hooks / 'guard.py')], input=json.dumps({'tool_input': {'command': 'git commit -m test'}}), text=True, capture_output=True, check=True)
            self.assertEqual(json.loads(result.stdout)['hookSpecificOutput']['permissionDecision'], 'deny')


if __name__ == '__main__':
    unittest.main()
