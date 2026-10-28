import type { Metadata } from 'next'
import { draftMode } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { siteConfig } from 'subur-site-config'

import { RenderBlocks } from '../blocks/RenderBlocks.js'
import { JsonLd } from '../components/JsonLd.js'
import { LivePreviewListener } from '../components/LivePreviewListener/index.js'
import { Redirects, resolveRedirectTarget } from '../components/Redirects/index.js'
import { isLocale } from '../i18n/config.js'
import { pageHref } from '../i18n/paths.js'
import { buildPageGraph } from '../seo/pageGraph.js'
import { defaultLocaleOf } from '../site/index.js'
import { generateMeta } from '../utilities/generateMeta.js'
import { getServerSideURL } from '../utilities/getURL.js'
import { type ConfigArg, createSiteData } from './siteData.js'

export type PageArgs = {
  params: Promise<{ locale: string; slug?: string }>
}

/**
 * La pàgina de `[locale]/[slug]` (spec §3.1). `generateStaticParams` es queda al fitxer de ruta del client: Next el
 * llegeix de manera estàtica.
 */
export function createSlugPage({ config }: { config: ConfigArg }) {
  const data = createSiteData(config)

  /**
   * Quan `getPage` no troba res, la decisió de `redirect()`/`notFound()` es
   * pren aquí, al cos de la pàgina, abans de retornar cap JSX — no delegada a
   * un component fill que faci la seva pròpia consulta i llenci després.
   * Mesurat abans i després del canvi (build de producció, `curl` sense JS a
   * `/es/no-existe`): abans, l'HTML inicial sense JavaScript no portava
   * `lang` ni `<title>`, i tampoc cap text de la 404 (`<html
   * id="__next_error__">`, cos ocult darrere d'un `<template>` amb el
   * càrrega útil de React Server Components, sense res llegible sense
   * hidratar). Després d'aquest canvi, decidir-ho aquí fa que un navegador
   * amb JavaScript hidrati més de pressa i de manera més fiable cap a
   * `<html lang>` correcte — però la mateixa comprovació amb `curl` mostra
   * que l'HTML servit sense JavaScript **es manté igual**: Next.js 16 amb
   * Turbopack no arriba a compondre el contingut de `not-found.tsx` (ni el
   * `<title>`) a la resposta inicial per a cap ruta dinàmica que acabi en
   * `notFound()`, independentment d'on es cridi ni de si aquell component és
   * síncron; ho vaig aïllar substituint `not-found.tsx` per una versió
   * mínima i síncrona i tornava a passar. És un límit conegut de Next.js
   * (vegeu vercel/next.js#98295 i #61236, reproduïts amb Turbopack en builds
   * de producció) i no un defecte d'aquest component: aquí es documenta
   * perquè qui hi torni no dedueixi que el problema ja està tancat.
   */
  async function Page({ params }: PageArgs) {
    const { locale, slug = 'home' } = await params
    if (!isLocale(locale)) notFound()

    const decodedSlug = decodeURIComponent(slug)
    const { isEnabled: draft } = await draftMode()

    // Un idioma del catàleg que aquesta web no té contractat: la mateixa pàgina
    // en l'idioma per defecte. Temporal (307), perquè l'idioma es pot activar
    // després; el hook únic d'invalidació (`'*'`) llença aquesta resposta de la
    // memòria cau en desar `subscription`. En mode esborrany no es redirigeix
    // mai: el flux és «preparar el contingut en un idioma nou i després
    // activar-lo», i un superadmin previsualitzant-lo l'ha de poder veure abans
    // d'activar-lo.
    const activeLocales = await data.getActiveLocales()
    if (!draft && !activeLocales.includes(locale)) redirect(pageHref(defaultLocaleOf(siteConfig), decodedSlug))

    const page = await data.getPage(decodedSlug, locale)

    if (!page) {
      const target = await resolveRedirectTarget(data, locale, decodedSlug)
      if (target) redirect(target)
      notFound()
    }

    const [settings, modules, home] = await Promise.all([
      data.getSiteSettings(locale),
      data.getModules(),
      decodedSlug === 'home' ? Promise.resolve(page) : data.getPage('home', locale),
    ])
    const pageGraph = buildPageGraph({
      areaServed: (settings.location?.areaServed ?? []).map((area) => area.name).filter(Boolean),
      homeTitle: home?.title ?? siteConfig.name,
      locale,
      modules,
      page,
      siteUrl: getServerSideURL(),
    })

    return (
      <article>
        <JsonLd graph={pageGraph} />
        <Redirects data={data} locale={locale} slug={decodedSlug} />
        {draft && <LivePreviewListener />}
        <RenderBlocks blocks={page.layout} locale={locale} settings={settings} />
      </article>
    )
  }

  async function generateMetadata({ params }: PageArgs): Promise<Metadata> {
    const { locale, slug = 'home' } = await params
    if (!isLocale(locale)) return {}

    const decodedSlug = decodeURIComponent(slug)
    const { isEnabled: draft } = await draftMode()
    const activeLocales = await data.getActiveLocales()
    // Mateixa excepció que al cos de la pàgina: en mode esborrany no s'amaguen
    // les metadades d'un idioma encara no contractat.
    if (!draft && !activeLocales.includes(locale)) return {}

    const page = await data.getPage(decodedSlug, locale)

    // Mateixa decisió que al cos de la pàgina: si aquí no es reconeix que la
    // ruta acabarà en `notFound()`, les metadades resoltes (títol, OG) queden
    // penjades a un segment que mai es renderitza. Coherent amb el cos, però
    // no tanca el forat sense JavaScript documentat més amunt: vegeu el
    // comentari de `Page`. Si hi ha una redirecció, es deixa `{}` — el
    // `redirect()` del cos ja hi porta abans que cap metadada importi.
    if (!page) {
      const target = await resolveRedirectTarget(data, locale, decodedSlug)
      if (!target) notFound()
      return {}
    }

    return generateMeta({ activeLocales, doc: page, locale, slug: decodedSlug })
  }

  return { generateMetadata, Page }
}

/** La portada de `[locale]` és la pàgina `home`: la mateixa fàbrica, sense `slug`. */
export const createLocalePage = createSlugPage
