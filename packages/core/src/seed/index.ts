import type { BasePayload } from 'payload'

import { isBlockEnabled } from '../blocks/registry.js'
import { clearCacheRows, tombstoneAll } from '../cache/flush.js'
import { defaultLocaleOf, seedOrderOf, type SiteConfig } from '../site/index.js'
import { assertSeedAllowed } from '../utilities/seedGuard.js'

import { mergeLocalized } from './mergeLocalized.js'
import { seedMediaFiles } from './media.js'
import { prepareLocalizedSiteSettings } from './prepareLocalizedSiteSettings.js'
import { seedSubscription } from './subscription.js'
import type { PageInput, SeedContent, SeedMedia, SeedRefs } from './types.js'
import { seedUiOverrides } from './uiOverrides.js'

const context = { disableRevalidate: true }

const pick = <T extends object, K extends keyof T>(source: T, keys: readonly K[]) =>
  Object.fromEntries(keys.map((key) => [key, source[key]])) as Pick<T, K>

/**
 * La memòria cau persistent (spec §26.5): les pàgines sembrades substitueixen
 * les anteriors, i un render començat durant el seed no pot deixar-ne una a
 * mitges (la làpida '*'). No es toca mai next_cache_tags sencera.
 */
export async function flushSiteCacheAfterSeed(payload: BasePayload): Promise<void> {
  await clearCacheRows(payload.db.drizzle)
  await tombstoneAll(payload.db.drizzle)
  payload.logger.info('Seed: memòria cau del web buidada')
}

/**
 * Un bloc que `optionalBlocks` desactiva no es crea (spec §3.3, «el seed no en
 * crea»): es treu del `layout` abans de desar, perquè el motor el rebutjaria.
 * Es filtra igual a cada idioma, i així les traduccions (que es fusionen per
 * posició amb el document de l'idioma per defecte) hi continuen quadrant.
 */
const withEnabledBlocks = (page: PageInput, optionalBlocks: SiteConfig['optionalBlocks']): PageInput =>
  page.layout ? { ...page, layout: page.layout.filter((block) => isBlockEnabled(block.blockType, optionalBlocks)) } : page

/**
 * Esborra el contingut i el torna a sembrar amb el del client (spec §3.5):
 * pàgines, imatges, formulari de contacte, ajustos, capçalera i peu, en
 * l'ordre d'idiomes `seedOrderOf(siteConfig)`; amb `.subur/` a `repoRoot`, el
 * global `subscription`; i en acabar, la memòria cau del web.
 */
export async function runSeed<S extends string, K extends string>({
  content,
  media,
  payload,
  repoRoot,
  siteConfig,
}: {
  content: SeedContent<S, K>
  media: SeedMedia<K>
  payload: BasePayload
  repoRoot?: string
  siteConfig: SiteConfig
}): Promise<void> {
  const log = (line: string) => payload.logger.warn(line)
  const defaultLocale = defaultLocaleOf(siteConfig)
  const order = seedOrderOf(siteConfig)
  const subscription = seedSubscription({ log, repoRoot: repoRoot ?? process.cwd(), siteConfig })

  // Cada idioma que el global activarà ha de tenir contingut (ruling P8): amb
  // `.subur/`, els actius del contracte; sense, l'idioma per defecte. Es
  // comprova abans d'esborrar res.
  for (const locale of subscription ? subscription.activeLocales : [defaultLocale]) {
    if (!content.byLocale[locale]) throw new Error(`Seed: falta el contingut de l'idioma ${locale}`)
  }
  if (!content.pageSlugs.includes('home' as S)) throw new Error('Seed: el contingut no porta la pàgina «home»')

  const base = content.byLocale[defaultLocale]!
  const translations = order.filter((locale) => locale !== defaultLocale && content.byLocale[locale])
  const pageSlugs = content.pageSlugs
  const pageOf = (build: { pages: Record<S, PageInput> }, slug: S) =>
    withEnabledBlocks(build.pages[slug], siteConfig.optionalBlocks)

  const { totalDocs } = await payload.count({ collection: 'pages' })
  assertSeedAllowed({ env: process.env, existingPages: totalDocs })

  payload.logger.info('Seed: limpiando contenido')
  for (const collection of ['form-submissions', 'forms', 'redirects', 'media', 'pages'] as const) {
    // `media` és l'única col·lecció amb fitxers: un objecte `context` nou per
    // esborrat, pel mateix motiu que a `media.ts` (el complement
    // d'emmagatzematge S3 recorda el primer fitxer dins l'objecte `context`
    // que li passa l'API local). La resta de col·leccions d'aquest seed no
    // porten mai fitxer i poden compartir el `context` del mòdul.
    await payload.delete({
      collection,
      context: { disableRevalidate: true },
      where: { id: { exists: true } },
    })
  }

  payload.logger.info('Seed: creando páginas vacías')
  const pages = {} as Record<S, number>
  for (const slug of pageSlugs) {
    const doc = await payload.create({
      collection: 'pages',
      context,
      data: { layout: [], slug, title: slug },
      draft: true,
      locale: defaultLocale,
    })
    pages[slug] = doc.id
  }

  payload.logger.info('Seed: imágenes')
  // El text alternatiu va a tots els idiomes de l'ordre del seed, no només als
  // que porten contingut: cada imatge el té per a tot el catàleg.
  const mediaIds = await seedMediaFiles(payload, media, {
    defaultLocale,
    translations: order.filter((locale) => locale !== defaultLocale),
  })

  payload.logger.info('Seed: formulario de contacto')
  const form = await payload.create({
    collection: 'forms',
    context,
    data: base.form,
    locale: defaultLocale,
  })

  for (const locale of translations) {
    const localeContent = content.byLocale[locale]!
    const current = await payload.findByID({
      collection: 'forms',
      depth: 0,
      id: form.id,
      locale: defaultLocale,
    })
    const keys = [
      'title',
      'fields',
      'submitButtonLabel',
      'confirmationType',
      'confirmationMessage',
      'emails',
    ] as const
    await payload.update({
      collection: 'forms',
      context,
      data: mergeLocalized(pick(current, keys), localeContent.form),
      id: form.id,
      locale,
    })
  }

  const refs: SeedRefs<S, K> = { formId: form.id, media: mediaIds, pages }
  const baseBuild = base.build(refs)

  payload.logger.info('Seed: contenido de páginas')
  for (const slug of pageSlugs) {
    await payload.update({
      collection: 'pages',
      context,
      data: { ...pageOf(baseBuild, slug), _status: 'published' },
      id: pages[slug],
      locale: defaultLocale,
    })
  }

  payload.logger.info('Seed: ajustes, cabecera y pie')
  // `ui` s'escriu sempre sencer i explícit (clau per clau, `null` on el
  // client no sobreescriu): una sembra repetida no seria reproduïble si es
  // deixés que la fusió parcial de `updateGlobal` conservés una
  // sobreescriptura d'una sembra anterior.
  await payload.updateGlobal({
    context,
    data: { ...baseBuild.siteSettings, ui: seedUiOverrides(baseBuild.siteSettings.ui ?? undefined) },
    locale: defaultLocale,
    slug: 'site-settings',
  })
  await payload.updateGlobal({
    context,
    data: baseBuild.header,
    locale: defaultLocale,
    slug: 'header',
  })
  await payload.updateGlobal({
    context,
    data: baseBuild.footer,
    locale: defaultLocale,
    slug: 'footer',
  })

  for (const locale of translations) {
    payload.logger.info(`Seed: traducción ${locale}`)
    const build = content.byLocale[locale]!.build(refs)

    for (const slug of pageSlugs) {
      const current = await payload.findByID({
        collection: 'pages',
        depth: 0,
        draft: false,
        id: pages[slug],
        locale: defaultLocale,
      })
      const keys = ['title', 'slug', 'layout', 'meta'] as const
      await payload.update({
        collection: 'pages',
        context,
        data: { ...mergeLocalized(pick(current, keys), pageOf(build, slug)), _status: 'published' },
        id: pages[slug],
        locale,
      })
    }

    for (const slug of ['site-settings', 'header', 'footer'] as const) {
      const current = await payload.findGlobal({ depth: 0, locale: defaultLocale, slug })
      const {
        createdAt: _createdAt,
        globalType: _globalType,
        id: _id,
        updatedAt: _updatedAt,
        ...data
      } = current as unknown as Record<string, unknown>
      // `site-settings` escriu `ui` sencer i explícit amb
      // `prepareLocalizedSiteSettings` (Tasca 6, ronda de revisió): mai
      // s'hereta el text de l'idioma per defecte de `current` (llegit sempre
      // en aquest idioma) ni queda penjada una sobreescriptura d'una sembra
      // anterior, perquè la fusió parcial de `updateGlobal` no l'esborraria
      // per si sola.
      const merged =
        slug === 'site-settings'
          ? prepareLocalizedSiteSettings(data, build.siteSettings)
          : mergeLocalized(data, slug === 'header' ? build.header : build.footer)
      await payload.updateGlobal({
        context,
        data: merged as never,
        locale,
        slug,
      })
    }
  }

  if (subscription) {
    payload.logger.info('Seed: suscripción')
    await payload.updateGlobal({ context, data: subscription, slug: 'subscription' })
  }

  await flushSiteCacheAfterSeed(payload)

  payload.logger.info('Seed: completado')
}
