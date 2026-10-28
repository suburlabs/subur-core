import { describe, expect, it } from 'vitest'

import { resolvePlan } from '../../src/subur/plan.js'

describe('resolvePlan', () => {
  it('només `business` és Business; qualsevol altra cosa compta com a Starter', () => {
    expect(resolvePlan('business')).toBe('business')
    expect(resolvePlan('starter')).toBe('starter')
    expect(resolvePlan(undefined)).toBe('starter')
    expect(resolvePlan(null)).toBe('starter')
    expect(resolvePlan('Business')).toBe('starter')
  })
})
