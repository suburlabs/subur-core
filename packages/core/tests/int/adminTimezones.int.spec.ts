import config from '../fixtures/app/src/payload.config.js'
import { getPayload } from 'payload'
import { describe, expect, it } from 'vitest'

describe('zona horària del panell', () => {
  it('és Europe/Madrid per defecte i la llista comença per Madrid/Barcelona i Canàries', async () => {
    const payload = await getPayload({ config })
    const timezones = payload.config.admin.timezones
    expect(timezones.defaultTimezone).toBe('Europe/Madrid')
    const [first, second] = timezones.supportedTimezones
    expect(first).toEqual({ label: '(UTC+01:00) Madrid, Barcelona', value: 'Europe/Madrid' })
    expect(second.value).toBe('Atlantic/Canary')
    // La resta de la llista del motor hi continua sent, sense duplicats.
    const values = timezones.supportedTimezones.map((tz) => tz.value)
    expect(values).toContain('Europe/Berlin')
    expect(new Set(values).size).toBe(values.length)
  })
})
