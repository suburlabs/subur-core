import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { collectFacts, readSuburContract } from '@suburlabs/core/contract'
// Intern del paquet, pel camí de font del workspace (regla de les proves de la demo, Task 16; D56)
import { seedSubscription } from '../../../../packages/core/src/seed/subscription.js'
import { describe, expect, it } from 'vitest'

import { OUTPUTS } from '../../scripts/make-media'
import { content } from '../../src/site/seed/content/index'
import { media } from '../../src/site/seed/media'
import { siteConfig } from '../../src/site/site.config'

const refs = {
  formId: 1,
  media: Object.fromEntries(Object.keys(media.items).map((k, i) => [k, i + 1])),
  pages: Object.fromEntries(content.pageSlugs.map((s, i) => [s, i + 1])),
}
/** L'estructura d'una llengua: per pàgina, la llista de tipus de bloc i les claus de cada bloc. */
const shape = (locale: 'ca' | 'en' | 'es') =>
  Object.fromEntries(Object.entries(content.byLocale[locale]!.build(refs as never).pages).map(([slug, page]) => [slug, (page.layout ?? []).map((b) => `${b.blockType}:${Object.keys(b).sort().join(',')}`)]))

describe('la demo (spec §10 E1)', () => {
  it('el contingut fa servir els 12 blocs (miniatures i e2e)', () => {
    const blocks = new Set(Object.values(content.byLocale.ca!.build(refs as never).pages).flatMap((p) => (p.layout ?? []).map((b) => b.blockType)))
    expect([...blocks].sort()).toEqual(['contact', 'ctaBand', 'faq', 'featureList', 'note', 'pageHero', 'richTextSection', 'scrollHero', 'servicesGrid', 'statement', 'taskCatalog', 'testimonials'])
  })
  it('tres idiomes amb la mateixa estructura, bloc a bloc', () => {
    expect(Object.keys(content.byLocale).sort()).toEqual(['ca', 'en', 'es'])
    expect(shape('es')).toEqual(shape('ca'))
    expect(shape('en')).toEqual(shape('ca'))
  })
  it('els mitjans versionats són exactament els que genera make-media (ruling P13)', () => {
    // També els fitxers nous encara sense commit (D31, D51; sonda S11)
    const tracked = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', 'public/site', 'src/site/seed/media'], { encoding: 'utf8' }).trim().split('\n').sort()
    expect(tracked).toEqual([...OUTPUTS].sort())
    for (const item of Object.values(media.items)) expect(existsSync(`${media.dir}/${item.file}`), item.file).toBe(true)
    for (const p of siteConfig.assets.heroFilm.posters) expect(OUTPUTS).toContain(`public${p.src}`)
  })
  it('fets = seed: el global que escriu el seed de la demo porta els idiomes dels fets, i el contingut els té tots (ruling P8; D59)', () => {
    const contract = readSuburContract(process.cwd(), 'demo')
    const facts = collectFacts({ backupVersion: null, contract, packageVersion: '0.0.0', siteConfig })
    expect(seedSubscription({ repoRoot: process.cwd(), siteConfig })!.activeLocales).toEqual(facts.activeLocales)
    expect(facts.activeLocales).toEqual(['ca', 'es', 'en'])
    for (const locale of facts.activeLocales) expect(content.byLocale[locale], locale).toBeDefined()
  })
})
