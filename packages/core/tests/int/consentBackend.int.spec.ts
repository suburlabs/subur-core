import config from '../fixtures/app/src/payload.config.js'
import { getPayload } from 'payload'
import pg from 'pg'
import { beforeAll, describe, expect, it } from 'vitest'

import { getConsentBackend } from '../../src/consent/backend.js'
import { consentMessages } from '../../src/consent/messages.js'

/**
 * El backend de c15t viu dins de la web i escriu a la base del client
 * (spec §21.2). Es prova el handler directament (sense servidor HTTP) sobre
 * la base efímera, on la cadena de migracions ha creat les taules `c15t_*`.
 */
const origin = 'http://localhost:3000'
const call = (method: string, path: string, body?: unknown) =>
  getConsentBackend().handler(
    new Request(`${origin}/api/c15t${path}`, {
      body: body === undefined ? undefined : JSON.stringify(body),
      headers: { 'content-type': 'application/json', origin },
      method,
    }),
  )

describe('backend de consentiment', () => {
  beforeAll(async () => {
    await getPayload({ config }) // migracions aplicades per globalSetup; assegura la config carregada
  })

  it('la migració ha creat les taules c15t_* amb el prefix', async () => {
    const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
    await client.connect()
    try {
      const { rows } = await client.query<{ table_name: string }>(
        "select table_name from information_schema.tables where table_schema = 'public' and table_name like 'c15t\\_%' order by 1",
      )
      expect(rows.map((r) => r.table_name)).toEqual(expect.arrayContaining(['c15t_consent', 'c15t_subject']))
    } finally {
      await client.end()
    }
  })

  it('GET /status respon', async () => {
    const res = await call('GET', '/status')
    expect(res.status).toBe(200)
  })

  it('GET /init dóna la jurisdicció GDPR sense geolocalitzar', async () => {
    const res = await call('GET', '/init')
    expect(res.status).toBe(200)
    const body = (await res.json()) as { jurisdiction?: { code?: string } } & Record<string, unknown>
    expect(JSON.stringify(body)).toMatch(/GDPR/)
  })

  it('POST /subjects deixa una fila a c15t_consent', async () => {
    const res = await call('POST', '/subjects', {
      domain: 'localhost',
      givenAt: Date.now(),
      preferences: { measurement: true, necessary: true },
      // c15t (instal·lat) valida subjectId amb /^sub_[1-9A-HJ-NP-Za-km-z]+$/
      // (sense guions baixos): "sub_test_h2" del brief no hi passa, d'aquí el
      // canvi mecànic a "sub_testh2".
      subjectId: 'sub_testh2',
      type: 'cookie_banner',
    })
    expect(res.status).toBeLessThan(300)
    const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
    await client.connect()
    try {
      const { rows } = await client.query('select count(*)::int as n from c15t_consent')
      expect(rows[0].n).toBeGreaterThan(0)
    } finally {
      await client.end()
    }
  })

  it('la IP desada surt de x-forwarded-for, mai de x-client-ip (Caddy la deixa passar sense filtrar)', async () => {
    const res = await getConsentBackend().handler(
      new Request(`${origin}/api/c15t/subjects`, {
        body: JSON.stringify({
          domain: 'localhost',
          givenAt: Date.now(),
          preferences: { measurement: true, necessary: true },
          subjectId: 'sub_testip',
          type: 'cookie_banner',
        }),
        headers: {
          'content-type': 'application/json',
          origin,
          // Un visitant real pot enviar qualsevol `X-Client-IP`: si el
          // backend el mirés abans que `X-Forwarded-For`, aquesta prova
          // guardaria `203.0.113.0` (la falsificada) en lloc de
          // `198.51.100.0` (la real, emmascarada per `masking: true` per
          // defecte del paquet).
          'x-client-ip': '203.0.113.77',
          'x-forwarded-for': '198.51.100.9',
        },
        method: 'POST',
      }),
    )
    expect(res.status).toBeLessThan(300)
    const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
    await client.connect()
    try {
      // La fila més recent: aquest POST és l'última escriptura a
      // `c15t_consent` en aquest fitxer de proves.
      const { rows } = await client.query<{ ipAddress: string | null }>(
        'select "ipAddress" from c15t_consent order by "givenAt" desc limit 1',
      )
      expect(rows[0]?.ipAddress).toBe('198.51.100.0')
      expect(rows[0]?.ipAddress).not.toBe('203.0.113.0')
    } finally {
      await client.end()
    }
  })

  // En mode `hosted`, el client pinta el bàner en l'idioma que respon `/init`: si el backend no conegués un idioma del
  // catàleg (abans, `ca`), el bàner d'aquella ruta sortiria en anglès encara que el client en tingués els textos.
  it.each(['ca', 'es', 'en'] as const)('GET /init amb Accept-Language %s respon aquest idioma i els textos propis', async (locale) => {
    const res = await getConsentBackend().handler(
      new Request(`${origin}/api/c15t/init`, { headers: { 'accept-language': locale, origin } }),
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as { translations: { language: string; translations: { common: { acceptAll: string } } } }
    expect(body.translations.language).toBe(locale)
    expect(body.translations.translations.common.acceptAll).toBe(consentMessages[locale].common?.acceptAll)
  })

  it('un origen no de confiança no rep CORS', async () => {
    const res = await getConsentBackend().handler(
      new Request(`${origin}/api/c15t/status`, { headers: { origin: 'https://atacant.example' } }),
    )
    expect(res.headers.get('access-control-allow-origin')).not.toBe('https://atacant.example')
  })
})
