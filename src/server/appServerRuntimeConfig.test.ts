import { describe, expect, it } from 'vitest'
import { buildAppServerArgs } from './appServerRuntimeConfig'

describe('app-server runtime config', () => {
  it('defers to the Codex config when no explicit memory flag is provided', () => {
    const args = buildAppServerArgs()
    expect(args).not.toContain('features.memories=true')
    expect(args).not.toContain('features.memories=false')
  })

  it('can disable Codex memories through runtime configuration', () => {
    process.env.CODEXUI_MEMORIES = 'false'
    try {
      const args = buildAppServerArgs()
      const featureIndex = args.indexOf('features.memories=false')

      expect(featureIndex).toBeGreaterThan(0)
      expect(args[featureIndex - 1]).toBe('-c')
      expect(args).not.toContain('features.memories=true')
    } finally {
      delete process.env.CODEXUI_MEMORIES
    }
  })
})
