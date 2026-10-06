// The orc mod: in-process event hooks layered on top of orc's bash settings
// hooks, which stay the safety floor. Nothing here replaces a guard — when
// mods can't load (Claude Code < 2.1.287, --safe-mode, disableAllHooks, an
// org policy) or `mod_enabled` is false, orc behaves exactly as without it.
import type { EngineInterface, On, PluginOptions } from 'claude-code'

export function register(on: On, options: PluginOptions) {
  if (options.mod_enabled === false) return
  register_attribution(on)
  register_compaction(on)
}

// Iron rule 5 at the source: blank the attribution text the model is told to
// write into commits and PRs, so it never drafts a trailer that
// pre-commit-no-ai-attribution.sh then has to deny. The engine's own gate
// sentences (`exemption`, `remedy`) pass through; the bash deny stays as backstop.
function register_attribution(on: On) {
  on('attribution.text', { kind: ['commit', 'pr'] }, async ($, e, next) => {
    if ((await $.env.get('ORC_ALLOW_AI_ATTRIBUTION')) === '1') return next(e)
    return { text: '' }
  })
}

// Compaction keeps orc's place: the summarizer is told the live session state
// (`orc-state line` — command, phase, slices, policy) so the post-compact
// transcript still knows where the flow is. The PreCompact bash hook writes the
// same facts to checkpoint.md for /orc:resume; this covers the live session.
// Speculative precomputes and subagent transcripts are left alone.
function register_compaction(on: On) {
  on('session.compact', { trigger: ['manual', 'auto'] }, async ($, e, next) => {
    if (e.agentId) return next(e)
    const line = await orc_state_line($)
    if (!line) return next(e)
    const note = 'orc session state (authoritative, from orc-state): ' + line +
      ' — keep the current phase, slice progress, and any pending gate decision in the summary.'
    return next({ ...e, instructions: e.instructions ? e.instructions + '\n\n' + note : note })
  })
}

// One-line JSON of the live orc session, or '' when there is none (or it can't be read).
async function orc_state_line($: EngineInterface): Promise<string> {
  try {
    const r = await $.process.run([$.plugin.root + '/bin/orc-state', 'line'], { timeoutMs: 5000 })
    return r.exitCode === 0 ? r.stdout.trim() : ''
  } catch {
    return ''
  }
}
