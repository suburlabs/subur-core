import type { Graph, LocalBusiness, Organization, PostalAddress, WebSite } from 'schema-dts'

import type { Locale } from '../i18n/config.js'
import { clean } from './clean.js'
import type { SiteConfig } from '../utilities/defineSiteConfig.js'
import type { ResolvedSiteSettings } from '../utilities/siteSettings.js'

/**
 * Graf JSON-LD del lloc (spec §20.3): Organization, WebSite i el negoci
 * local del subtipus de `siteConfig.seo.schemaType`, construït només des
 * dels ajustos. Res d'inventat: un camp buit no surt (Google penalitza les
 * claus buides més que l'absència).
 */
export type SchemaInput = {
  activeLocales: readonly Locale[]
  locale: Locale
  logoUrl: string
  schemaType: SiteConfig['seo']['schemaType']
  settings: Pick<
    ResolvedSiteSettings,
    'address' | 'email' | 'googleBusinessProfile' | 'hours' | 'location' | 'phone' | 'socials'
  >
  siteName: string
  siteUrl: string
}

const postalAddress = (
  location: SchemaInput['settings']['location'],
): PostalAddress | undefined => {
  if (!location) return undefined
  const address = clean({
    '@type': 'PostalAddress' as const,
    addressCountry: location.addressCountry ?? undefined,
    addressLocality: location.addressLocality ?? undefined,
    addressRegion: location.addressRegion ?? undefined,
    postalCode: location.postalCode ?? undefined,
    streetAddress: location.streetAddress ?? undefined,
  })
  return Object.keys(address).length > 1 ? address : undefined
}

export function buildSchemaGraph(input: SchemaInput): Graph {
  const { settings, siteUrl } = input
  const base = siteUrl.replace(/\/$/, '')
  const orgId = `${base}/#organization`
  const bizId = `${base}/#business`

  const sameAs = [
    ...(settings.socials ?? []).map((s) => s.url).filter((u): u is string => Boolean(u)),
    ...(settings.googleBusinessProfile ? [settings.googleBusinessProfile] : []),
  ]

  // `as const` a cada `@type`: `clean` retorna el mateix tipus que rep i, sense
  // això, TypeScript n'eixampla el valor a `string` i cap tipus de `schema-dts`
  // (que discrimina per `@type`) l'accepta.
  const organization: Organization = clean({
    '@type': 'Organization' as const,
    '@id': orgId,
    logo: input.logoUrl,
    name: input.siteName,
    sameAs: sameAs.length > 0 ? sameAs : undefined,
    url: base,
  })

  const website: WebSite = {
    '@type': 'WebSite',
    '@id': `${base}/#website`,
    inLanguage: [...input.activeLocales],
    name: input.siteName,
    publisher: { '@id': orgId },
    url: base,
  }

  const geo =
    settings.location?.geo?.latitude != null && settings.location?.geo?.longitude != null
      ? {
          '@type': 'GeoCoordinates' as const,
          latitude: settings.location.geo.latitude,
          longitude: settings.location.geo.longitude,
        }
      : undefined
  const areaServed = (settings.location?.areaServed ?? []).map((a) => ({
    '@type': 'City' as const,
    name: a.name,
  }))

  const business = clean({
    '@type': input.schemaType,
    '@id': bizId,
    address: postalAddress(settings.location),
    areaServed: areaServed.length > 0 ? areaServed : undefined,
    email: settings.email,
    geo,
    image: input.logoUrl,
    name: input.siteName,
    parentOrganization: { '@id': orgId },
    priceRange: settings.location?.priceRange ?? undefined,
    telephone: settings.phone,
    url: base,
  }) as LocalBusiness

  return { '@context': 'https://schema.org', '@graph': [organization, website, business] }
}
