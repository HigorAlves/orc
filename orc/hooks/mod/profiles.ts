// model_profile: which model each orc agent runs on when the Agent call gave
// none. `balanced` keeps the agents' frontmatter (the floor every profile falls
// back to); `quality` steps investigators/reviewers up; `economy` steps down.
// Model only — effort stays in frontmatter. An explicit per-call model (an
// escalation re-dispatch) always wins.

export type Profile = 'balanced' | 'quality' | 'economy'

const QUALITY: Record<string, string> = {
  'orc-debug-investigator': 'best', // Fable where available, else Opus: investigate-before-acting root cause
  'orc-pr-reviewer': 'opus',
  'orc-ci-investigator': 'opus',
  'orc-test-author': 'opus',
  'orc-code-fixer': 'sonnet',
  'orc-reply-drafter': 'sonnet',
}

const ECONOMY: Record<string, string> = {
  'orc-debug-investigator': 'sonnet',
  'orc-jira-architect': 'sonnet',
  'orc-prd-analyzer': 'sonnet',
  'orc-refactor-architect': 'sonnet',
  'orc-security-reviewer': 'sonnet',
  'orc-stack-analyzer': 'sonnet',
  'orc-env-provisioner': 'haiku',
}

export function parseProfile(value: unknown): Profile {
  return value === 'quality' || value === 'economy' ? value : 'balanced'
}

// `orc:orc-implementer` and `orc-implementer` name the same agent.
export function modelFor(profile: Profile, subagentType: string): string | undefined {
  const name = subagentType.replace(/^orc:/, '')
  if (profile === 'quality') return QUALITY[name]
  if (profile === 'economy') return ECONOMY[name]
  return undefined
}
