// core/packages/core/tests/int/consentOpenapi.int.spec.ts — l'especificació OpenAPI no es publica (R13)
import { describe, expect, it } from 'vitest'

import { getConsentBackend } from '../../src/consent/backend.js'

const origin = 'http://localhost:3000'
const get = (path: string) => getConsentBackend().handler(new Request(`${origin}/api/c15t${path}`, { headers: { origin }, method: 'GET' }))

describe('OpenAPI del backend de consentiment', () => {
  it('/spec.json i /docs no existeixen', async () => {
    expect((await get('/spec.json')).status).toBe(404)
    expect((await get('/docs')).status).toBe(404)
  })
  it('control positiu: /status continua responent 200', async () => {
    expect((await get('/status')).status).toBe(200)
  })
})
