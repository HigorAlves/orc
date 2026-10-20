import type { RenderSurface } from 'claude-code'
export const isRich = (surface: RenderSurface | null | undefined): boolean => surface != null && surface !== 'terminal'
