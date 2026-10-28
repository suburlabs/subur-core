import type { Metadata, Viewport } from 'next'
import { draftMode } from 'next/headers'
import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'
import { siteConfig } from 'subur-site-config'

import { ContactEvents } from '../analytics/ContactEvents.js'
import { AdminBar } from '../components/AdminBar/index.js'
import { InlineScript } from '../components/InlineScript/index.js'
import { JsonLd } from '../components/JsonLd.js'
import { Footer } from '../Footer/Component.js'
import { Header } from '../Header/Component.js'
import { isLocale } from '../i18n/config.js'
import { setRequestLocale } from '../i18n/requestLocale.js'
import { ConsentProvider } from '../providers/Consent.js'
import { ThemeProvider } from '../providers/Theme.js'
import { buildSchemaGraph as defaultSchemaGraph, type SchemaInput } from '../seo/schema.js'
import { defaultLocaleOf } from '../site/index.js'
import { getServerSideURL } from '../utilities/getURL.js'
import { mergeOpenGraph } from '../utilities/mergeOpenGraph.js'
import { type ConfigArg, createSiteData } from './siteData.js'

/**
 * El layout de `[locale]` (spec §3.1): la configuració del CMS i les variables de les fonts del client arriben per
 * argument; la resta, de `subur-site-config`. El fitxer de ruta del client hi afegeix el seu `globals.css` i, literals
 * perquè Next els llegeix de manera estàtica, `generateStaticParams` (cap pàgina es genera en compilar: el build de
 * Docker no té base de dades) i `revalidate` (el termini de stale-while-revalidate de l'HTML, spec §26.4).
 */
export function createLocaleLayout({
  buildSchemaGraph = defaultSchemaGraph,
  config,
  fontVariables,
}: {
  buildSchemaGraph?: (input: SchemaInput) => ReturnType<typeof defaultSchemaGraph>
  config: ConfigArg
  fontVariables: string
}) {
  const data = createSiteData(config)
  const metadata: Metadata = {
    icons: { icon: siteConfig.assets.favicon },
    metadataBase: new URL(getServerSideURL()),
    openGraph: mergeOpenGraph({ siteName: siteConfig.name }),
  }
  // Excepció deliberada a la regla de cap color literal: el navegador llegeix `<meta name="theme-color">` abans de cap
  // full d'estil, així que no pot llegir cap propietat CSS. Són els valors literals del client (spec §3.4), còpies del
  // `--background` de `:root` i `.dark` del seu tema.
  const viewport: Viewport = {
    themeColor: [
      { color: siteConfig.themeColor.light, media: '(prefers-color-scheme: light)' },
      { color: siteConfig.themeColor.dark, media: '(prefers-color-scheme: dark)' },
    ],
  }

  async function Layout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
    const { locale } = await params
    if (!isLocale(locale)) notFound()

    const { isEnabled } = await draftMode()

    // Sota un idioma no contractat, la pàgina pública redirigeix (vegeu `createSlugPage`); si el que es renderitza
    // igualment és la 404, que surti en un idioma real. En mode esborrany no hi ha excepció: un superadmin
    // previsualitzant un idioma encara no contractat l'ha de veure tal com és.
    const activeLocales = await data.getActiveLocales()
    const effectiveLocale = isEnabled || activeLocales.includes(locale) ? locale : defaultLocaleOf(siteConfig)
    setRequestLocale(effectiveLocale)

    // El graf de dades estructurades surt dels ajustos, en l'idioma efectiu: la mateixa lectura en memòria cau que ja
    // fan la capçalera i el peu.
    const settings = await data.getSiteSettings(effectiveLocale)
    const siteUrl = getServerSideURL()
    const graph = buildSchemaGraph({
      activeLocales,
      locale: effectiveLocale,
      logoUrl: `${siteUrl}${siteConfig.assets.logo}`,
      schemaType: siteConfig.seo.schemaType,
      settings,
      siteName: siteConfig.name,
      siteUrl,
    })

    return (
      <html className={fontVariables} lang={effectiveLocale} suppressHydrationWarning>
        <head>
          {/* Abans de la hidratació: marca l'escenari del hero com a fixat des del primer frame (vegeu `[data-js]` a
              primitives.css), no les quatre seccions estàtiques que només sobreviuen sense JS. */}
          <InlineScript html="document.documentElement.dataset.js=''" />
          <JsonLd graph={graph} />
        </head>
        <body className="flex min-h-svh flex-col">
          <ConsentProvider locale={effectiveLocale}>
            <ContactEvents />
            <ThemeProvider>
              <AdminBar adminBarProps={{ preview: isEnabled }} />
              <Header data={data} locale={effectiveLocale} />
              <main className="flex-1" id="contenido">
                {children}
              </main>
              <Footer data={data} locale={effectiveLocale} />
            </ThemeProvider>
          </ConsentProvider>
        </body>
      </html>
    )
  }

  return { Layout, metadata, viewport }
}
