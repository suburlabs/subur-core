// @vitest-environment node
// El seed puja fitxers a Mitjans: sota jsdom, la detecció del tipus pel contingut (`file-type`) no reconeix el
// buffer de Node i el motor rebutja la imatge («The following field is invalid: file»).
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getPayload } from 'payload'
import sharp from 'sharp'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { pageLink, paragraph, richText, runSeed, type SeedContent, type SeedLocaleContent, type SeedMedia } from '../../src/seed/exports.js'
import { seedSubscription } from '../../src/seed/subscription.js'
import { readSuburContract } from '../../src/subur/contract.js'
import { collectFacts } from '../../src/subur/facts.js'
import config from '../fixtures/app/src/payload.config.js'
import { siteConfig } from '../fixtures/app/src/site/site.config.js'

// Els fitxers que el seed puja a Mitjans van a un directori temporal: `Media` llegeix `MEDIA_DIR` en carregar la
// configuració, i `vi.hoisted` el fixa abans dels imports (si no, anirien a `public/media` del paquet).
const { mediaDir } = await vi.hoisted(async () => {
  const { mkdtempSync } = await import('node:fs')
  const { tmpdir } = await import('node:os')
  const { join } = await import('node:path')
  const mediaDir = mkdtempSync(join(tmpdir(), 'seed-static-'))
  process.env.MEDIA_DIR = mediaDir
  return { mediaDir }
})

const dir = mkdtempSync(path.join(tmpdir(), 'seed-media-'))
const media: SeedMedia<'hero'> = { dir, items: { hero: { alt: { ca: 'Imatge', en: 'Image', es: 'Imagen' }, file: 'hero.webp' } } }
const locale = (title: string): SeedLocaleContent<'home' | 'contacte', 'hero'> => ({
  build: ({ pages }) => ({
    footer: { columns: [], legalLinks: [], tagline: title },
    header: { navItems: [{ link: pageLink(pages.contacte, title) }] },
    pages: {
      contacte: { layout: [{ blockType: 'pageHero', heading: title }], meta: { title }, slug: 'contacte', title },
      home: {
        layout: [
          { blockType: 'note', text: 'x', title },
          { blockType: 'taskCatalog', groups: [{ icon: 'sofa', tasks: [{ text: 'x' }], title }] },
        ],
        meta: { title },
        slug: 'home',
        title,
      },
    },
    siteSettings: { address: 'Carrer de Prova 1', email: 'hola@fixture.example', hours: '9–18', phone: '+34 600 000 000' },
  }),
  form: { confirmationMessage: richText(paragraph(title)), confirmationType: 'message', emails: [], fields: [], submitButtonLabel: title, title },
})
const content: SeedContent<'home' | 'contacte', 'hero'> = { byLocale: { es: locale('Inicio') }, pageSlugs: ['home', 'contacte'] }

describe('runSeed (motor, spec §3.5)', () => {
  beforeAll(async () => {
    await sharp({ create: { background: '#888', channels: 3, height: 8, width: 8 } }).webp().toFile(path.join(dir, 'hero.webp'))
  })
  afterAll(() => {
    for (const d of [dir, mediaDir]) rmSync(d, { force: true, recursive: true })
  })
  it('sembra el contingut del client que rep, sense cap slug fix', async () => {
    const payload = await getPayload({ config })
    await runSeed({ content, media, payload, repoRoot: dir, siteConfig })
    const { docs } = await payload.find({ collection: 'pages', depth: 0, locale: 'es', pagination: false })
    expect(docs.map((d) => d.slug).sort()).toEqual(['contacte', 'home'])
    expect((await payload.find({ collection: 'media', limit: 0 })).totalDocs).toBe(1)
  })
  it('el seed no crea un bloc que optionalBlocks desactiva (spec §3.3)', async () => {
    const payload = await getPayload({ config })
    await runSeed({ content, media, payload, repoRoot: dir, siteConfig: { ...siteConfig, optionalBlocks: { scrollHero: true, taskCatalog: false } } })
    const { docs } = await payload.find({ collection: 'pages', depth: 0, locale: 'es', pagination: false, where: { slug: { equals: 'home' } } })
    expect((docs[0].layout ?? []).map((b) => b.blockType)).toEqual(['note'])
  })
  it('un client en amb només contingut en se sembra en en', async () => {
    const payload = await getPayload({ config })
    await runSeed({ content: { byLocale: { en: locale('Home') }, pageSlugs: ['home', 'contacte'] }, media, payload, repoRoot: dir, siteConfig: { ...siteConfig, defaultLocale: 'en' as const } })
    const { docs } = await payload.find({ collection: 'pages', depth: 0, fallbackLocale: false as never, locale: 'en', where: { slug: { equals: 'home' } } })
    expect(docs.map((d) => d.title)).toEqual(['Home'])
  })
  it('rebutja un contingut sense l\'idioma per defecte del client', async () => {
    const payload = await getPayload({ config })
    await expect(runSeed({ content: { ...content, byLocale: {} }, media, payload, repoRoot: dir, siteConfig })).rejects.toThrow(/idioma/)
    // Es rebutja abans d'esborrar res: hi continuen les dues pàgines de la sembra anterior.
    expect((await payload.count({ collection: 'pages' })).totalDocs).toBe(2)
  })
  it('rebutja un contingut sense la pàgina home', async () => {
    const payload = await getPayload({ config })
    await expect(runSeed({ content: { ...content, pageSlugs: ['contacte'] }, media, payload, repoRoot: dir, siteConfig })).rejects.toThrow(/home/)
  })
  describe('amb .subur/ a limits.languages 2 i per defecte en (D59)', () => {
    const repoRoot = mkdtempSync(path.join(tmpdir(), 'seed-subur-'))
    const enConfig = { ...siteConfig, defaultLocale: 'en' as const }
    beforeAll(() => {
      cpSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../fixtures/subur'), path.join(repoRoot, '.subur'), { recursive: true })
      const modulesFile = path.join(repoRoot, '.subur/modules.json')
      const modules = JSON.parse(readFileSync(modulesFile, 'utf8')) as { limits: Record<string, number> }
      writeFileSync(modulesFile, JSON.stringify({ ...modules, limits: { ...modules.limits, languages: 2 } }))
    })
    afterAll(() => rmSync(repoRoot, { force: true, recursive: true }))
    it('el que el seed escriu al global és el que diuen els fets: [en, es]', () => {
      const facts = collectFacts({ backupVersion: null, contract: readSuburContract(repoRoot, 'fixture'), packageVersion: '0.0.0', siteConfig: enConfig })
      expect(seedSubscription({ repoRoot, siteConfig: enConfig })!.activeLocales).toEqual(facts.activeLocales)
      expect(facts.activeLocales).toEqual(['en', 'es'])
    })
    it('runSeed rebutja un contingut sense un dels idiomes actius (aquí, es)', async () => {
      const payload = await getPayload({ config })
      await expect(runSeed({ content: { ...content, byLocale: { en: locale('Home') } }, media, payload, repoRoot, siteConfig: enConfig })).rejects.toThrow(/idioma es/)
    })
    it('amb en i es, sembra i el global subscription diu el que diuen els fets: [en, es]', async () => {
      const payload = await getPayload({ config })
      await runSeed({ content: { ...content, byLocale: { en: locale('Home'), es: locale('Inicio') } }, media, payload, repoRoot, siteConfig: enConfig })
      expect((await payload.findGlobal({ slug: 'subscription' })).activeLocales).toEqual(['en', 'es'])
    })
  })
})
