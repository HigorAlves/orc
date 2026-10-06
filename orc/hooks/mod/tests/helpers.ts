// Shared test fixtures for the orc mod.

// What $.process.run resolves to.
export const ran = (stdout: string, exitCode = 0) => ({
  value: { exitCode, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false },
})

export const ORIGIN = { plugin: 'engine', tier: 'core' } as const

// An Agent call as the engine fires agent.spawn for it.
export const spawnOf = (subagentType: string, model?: string) => ({
  prompt: 'do the slice', description: 'slice 1', subagentType, provider: ORIGIN, parentModel: 'claude-opus-5-5',
  tool_use_id: 'toolu_1', background: false, fork: false,
  ...(model ? { model } : {}),
})

// Let fire-and-forget timer work (async callbacks the clock can't await) finish.
export async function flush(times = 50) {
  for (let i = 0; i < times; i++) await Promise.resolve()
}
