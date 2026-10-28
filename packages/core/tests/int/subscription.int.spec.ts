import config from '../fixtures/app/src/payload.config.js'
import { Forbidden, getPayload, ValidationError } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createSubscription } from '../../src/config/subscription.js'
import { validateActiveLocales as createValidator } from '../../src/Subscription/validateActiveLocales.js'
import { siteConfig } from '../fixtures/app/src/site/site.config.js'

// Al paquet, el global i el validador es construeixen amb l'idioma per defecte del client de prova (es; Task 5).
const Subscription = createSubscription(siteConfig)
const validateActiveLocales = createValidator('es')

const context = { disableRevalidate: true }

describe('validateActiveLocales', () => {
  it('exige al menos un idioma', () => {
    expect(validateActiveLocales([])).toMatch(/al menos un idioma/)
    expect(validateActiveLocales(undefined)).toMatch(/al menos un idioma/)
  })

  it('exige el idioma por defecto', () => {
    expect(validateActiveLocales(['ca', 'en'])).toMatch(/por defecto/)
  })

  it('acepta una lista con el idioma por defecto', () => {
    expect(validateActiveLocales(['es'])).toBe(true)
    expect(validateActiveLocales(['en', 'es'])).toBe(true)
  })

  it('rechaza un idioma que no está en el catálogo', () => {
    expect(validateActiveLocales(['es', 'zz'])).toMatch(/no disponible en el catálogo: zz/)
  })

  it('rechaza idiomas repetidos', () => {
    expect(validateActiveLocales(['es', 'es'])).toMatch(/repetidos/)
  })

  it('rechaza un valor que no es un idioma en forma de texto', () => {
    expect(validateActiveLocales(['es', 42])).toMatch(/no disponible en el catálogo: 42/)
  })

  it('no admite más idiomas que maxLanguages (el límite del contrato)', () => {
    expect(validateActiveLocales(['es', 'ca', 'en'], 2)).toMatch(/máximo 2 idiomas/)
    expect(validateActiveLocales(['es', 'ca'], 2)).toBe(true)
    expect(validateActiveLocales(['es', 'ca', 'en'], undefined)).toBe(true) // sense límit conegut (base antiga), no bloqueja
  })
})

describe('global subscription', () => {
  // El superadministrador real de la base de dev/test (`ensureSuperAdmin`), no un usuario
  // fabricado: así las pruebas de acceso pasan por el control de acceso real.
  let superadmin: { collection: 'users' } & Record<string, unknown>

  beforeAll(async () => {
    const payload = await getPayload({ config })
    const { docs } = await payload.find({
      collection: 'users',
      limit: 1,
      where: { role: { equals: 'superadmin' } },
    })
    if (!docs[0]) {
      throw new Error('No hay ningún superadministrador en la base de datos de pruebas.')
    }
    superadmin = { ...docs[0], collection: 'users' }
  })

  afterAll(async () => {
    const payload = await getPayload({ config })
    await payload.updateGlobal({
      context,
      // Els valors de `tests/fixtures/subur/` (els del client de prova), escrits aquí i no importats:
      // la fixture és de la capa subur-ops i aquesta prova viatja al paquet de traspàs.
      data: {
        activeLocales: ['es', 'ca', 'en'],
        maxLanguages: 3,
        modules: ['blog', 'advanced-seo', 'ai-visibility', 'priority-support', 'internacional'],
        plan: 'business',
      },
      slug: 'subscription',
    })
  })

  it('plan, modules y maxLanguages se guardan y se leen; modules es una lista de ids', async () => {
    const payload = await getPayload({ config })
    await payload.updateGlobal({
      context,
      data: { maxLanguages: 3, modules: ['blog', 'ai-visibility'], plan: 'business' },
      slug: 'subscription',
    })
    const doc = await payload.findGlobal({ depth: 0, slug: 'subscription' })
    expect(doc.plan).toBe('business')
    expect(doc.modules).toEqual(['blog', 'ai-visibility'])
    expect(doc.maxLanguages).toBe(3)
  })

  it('los tres campos son de solo lectura en el panel (admin.readOnly), activeLocales no', () => {
    // El motor afegeix `updatedAt` i `createdAt` al mateix objecte en arrencar: aquí només els camps declarats.
    const fields = (Subscription.fields as { admin?: { readOnly?: boolean }; name?: string }[]).filter(
      (f) => f.name !== 'createdAt' && f.name !== 'updatedAt',
    )
    const readOnly = Object.fromEntries(fields.map((f) => [f.name, f.admin?.readOnly === true]))
    // Al paquet, el global porta també `footerCredit` (Task 14), editable a posta pel superadministrador.
    expect(readOnly).toEqual({ activeLocales: false, footerCredit: false, maxLanguages: true, modules: true, plan: true })
  })

  it('activeLocales no puede superar maxLanguages', async () => {
    const payload = await getPayload({ config })
    await payload.updateGlobal({ context, data: { activeLocales: ['es'], maxLanguages: 1 }, slug: 'subscription' })
    const rejected = await payload.updateGlobal({ context, data: { activeLocales: ['es', 'ca'] }, slug: 'subscription' }).then(
      () => null,
      (error: unknown) => error,
    )
    expect(rejected).toBeInstanceOf(ValidationError)
    // L'error és del camp dels idiomes actius (el que el panell marca), no del límit.
    expect((rejected as ValidationError).data.errors).toEqual(expect.arrayContaining([expect.objectContaining({ path: 'activeLocales' })]))
  })

  it('solo lo lee y lo edita el superadministrador', async () => {
    const payload = await getPayload({ config })
    const client = { collection: 'users' as const, email: 'x@subur.dev', id: 999_999, role: 'admin' as const }

    await expect(
      payload.findGlobal({ overrideAccess: false, slug: 'subscription', user: client as never }),
    ).rejects.toThrow(Forbidden)
    await expect(
      payload.updateGlobal({
        context,
        data: { plan: 'business' },
        overrideAccess: false,
        slug: 'subscription',
        user: client as never,
      }),
    ).rejects.toThrow(Forbidden)
  })

  it('la API local lo lee sin usuario, como hace la web', async () => {
    const payload = await getPayload({ config })
    const subscription = await payload.findGlobal({ slug: 'subscription' })
    expect(subscription).toBeDefined()
  })

  it('el validador de idiomas está conectado al campo, no solo correcto en aislado', async () => {
    const payload = await getPayload({ config })

    await expect(
      payload.updateGlobal({
        context,
        // El tipus generat només admet el catàleg (`'ca' | 'en' | 'es'`); aquí es força
        // expressament un codi que no hi és, per provar el validador en temps real.
        data: { activeLocales: ['es', 'zz'] as never },
        overrideAccess: false,
        slug: 'subscription',
        user: superadmin as never,
      }),
    ).rejects.toThrow(ValidationError)
  })

  it('el superadministrador puede actualizar la suscripción (fila de acceso real)', async () => {
    const payload = await getPayload({ config })

    const updated = await payload.updateGlobal({
      context,
      data: { plan: 'business' },
      overrideAccess: false,
      slug: 'subscription',
      user: superadmin as never,
    })
    expect(updated.plan).toBe('business')

    const restored = await payload.updateGlobal({
      context,
      data: { plan: 'starter' },
      overrideAccess: false,
      slug: 'subscription',
      user: superadmin as never,
    })
    expect(restored.plan).toBe('starter')
  })
})
