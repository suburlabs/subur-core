import { describe, expect, it } from 'vitest'

import { emailAdapter } from '../../src/email/adapter.js'

describe('emailAdapter', () => {
  it('no configura nada sin clave de Resend', () => {
    expect(emailAdapter({})).toBeUndefined()
    expect(emailAdapter({ RESEND_API_KEY: '   ' })).toBeUndefined()
  })

  it('exige un remitente cuando hay clave', () => {
    expect(() => emailAdapter({ RESEND_API_KEY: 're_test' })).toThrow(/EMAIL_FROM_ADDRESS/)
  })

  it('devuelve el adaptador con clave y remitente', () => {
    const adapter = emailAdapter({
      EMAIL_FROM_ADDRESS: 'web@example.com',
      RESEND_API_KEY: 're_test',
    })
    expect(typeof adapter).toBe('function')
  })
})
