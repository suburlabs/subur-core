import { describe, expect, it } from 'vitest'

import { cn } from '../../src/utilities/ui.js'

describe('cn', () => {
  it('keeps a custom theme font-size utility alongside a text-color utility', () => {
    const result = cn('text-foreground', 'text-subtitle text-primary-foreground')
    expect(result).toContain('text-subtitle')
    expect(result).toContain('text-primary-foreground')
  })

  it('still resolves conflicts between two custom theme font-size utilities', () => {
    expect(cn('text-body', 'text-lead')).toBe('text-lead')
  })

  it('still resolves conflicts between two text-color utilities', () => {
    expect(cn('text-primary', 'text-foreground')).toBe('text-foreground')
  })
})
