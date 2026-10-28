import { seedOrderOf } from '../site/index.js'
import type { SiteConfig } from '../utilities/defineSiteConfig.js'
import type { SuburContract } from './contract.js'

export type Locale = 'ca' | 'en' | 'es'
export type ThemeColor = { light: string; dark: string }
export type Facts = {
  schema: 1
  id: string
  domain: string
  /** `https://${domain}` */
  url: string
  name: string
  /** siteConfig.clientLocale */
  locale: 'ca' | 'es'
  defaultLocale: Locale
  /** null: l'script local d'E3a; objecte: `subur facts` del paquet (spec §5.2). */
  themeColor: ThemeColor | null
  /** Versió del package.json del repo (fins a E2; després, la de @suburlabs/core). */
  coreVersion: string
  /** deploy/backup/VERSION, retallat, o null. */
  backupVersion: string | null
  /** siteConfig.assets.heroFilm.posters[].src */
  posters: string[]
  /** seedOrderOf(siteConfig).slice(0, contract.maxLanguages); sense contracte, només l'idioma per defecte. */
  activeLocales: Locale[]
}
export type FactsInput = {
  /** `themeColor` en `#rrggbb`: `collectFacts` el valida amb la mateixa regla que `parseFacts`. */
  siteConfig: Pick<SiteConfig, 'assets' | 'clientLocale' | 'defaultLocale' | 'domain' | 'id' | 'name' | 'themeColor'>
  packageVersion: string
  backupVersion: string | null
  contract: Pick<SuburContract, 'maxLanguages'> | null
}

/** El nom de l'script del protocol. */
export const FACTS_SCRIPT = 'subur:facts'

// Mateixa expressió que CLIENT_ID de scripts/ops/site.ts i de scripts/handoff/data.ts:
// la capa core no pot importar de scripts/, per això es duplica.
const CLIENT_ID = /^[a-z0-9_]+$/
const DOMAIN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/
const LOCALES: readonly Locale[] = ['ca', 'en', 'es']

const isLocale = (v: unknown): v is Locale => typeof v === 'string' && (LOCALES as readonly string[]).includes(v)
const HEX = /^#[0-9a-f]{6}$/i
const parseThemeColor = (v: unknown): ThemeColor | null => {
  if (v === null) return null
  const t = v as Partial<ThemeColor> | undefined
  if (typeof v !== 'object' || Array.isArray(v) || typeof t?.light !== 'string' || typeof t.dark !== 'string' || !HEX.test(t.light) || !HEX.test(t.dark)) {
    throw new Error('facts: themeColor ha de ser null o { light, dark } en hexadecimal')
  }
  return { dark: t.dark, light: t.light }
}

export function collectFacts(input: FactsInput): Facts {
  const { siteConfig: s } = input
  if (!CLIENT_ID.test(s.id)) throw new Error(`facts: id invàlid «${s.id}» (minúscules, xifres i _)`)
  if (!DOMAIN.test(s.domain)) throw new Error(`facts: domain invàlid «${s.domain}» (sense https:// ni barres)`)
  if (s.clientLocale !== 'ca' && s.clientLocale !== 'es') throw new Error(`facts: locale invàlid «${s.clientLocale}» (ca o es)`)
  const count = input.contract ? input.contract.maxLanguages : 1
  return {
    schema: 1,
    id: s.id,
    domain: s.domain,
    url: `https://${s.domain}`,
    name: s.name,
    locale: s.clientLocale,
    defaultLocale: s.defaultLocale,
    themeColor: parseThemeColor(s.themeColor),
    coreVersion: input.packageVersion,
    backupVersion: input.backupVersion,
    posters: s.assets.heroFilm.posters.map((p) => p.src),
    activeLocales: seedOrderOf(s).slice(0, count),
  }
}

export function parseFacts(json: string): Facts {
  let raw: unknown
  try {
    raw = JSON.parse(json)
  } catch {
    throw new Error('facts: la sortida no és JSON')
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new Error('facts: ha de ser un objecte')
  const o = raw as Record<string, unknown>
  if (o.schema !== 1) throw new Error(`facts: esquema ${String(o.schema)} desconegut (s'espera 1)`)
  const str = (k: string): string => {
    const v = o[k]
    if (typeof v !== 'string' || v === '') throw new Error(`facts: ${k} ha de ser un text no buit`)
    return v
  }
  const id = str('id')
  if (!CLIENT_ID.test(id)) throw new Error(`facts: id invàlid «${id}»`)
  const domain = str('domain')
  if (!DOMAIN.test(domain)) throw new Error(`facts: domain invàlid «${domain}»`)
  const url = str('url')
  if (url !== `https://${domain}`) throw new Error('facts: url ha de ser https://<domain>')
  const locale = o.locale
  if (locale !== 'ca' && locale !== 'es') throw new Error('facts: locale ha de ser ca o es')
  if (!isLocale(o.defaultLocale)) throw new Error('facts: defaultLocale ha de ser ca, en o es')
  const themeColor = parseThemeColor(o.themeColor)
  if (o.backupVersion !== null && typeof o.backupVersion !== 'string') throw new Error('facts: backupVersion ha de ser un text o null')
  const { posters, activeLocales } = o
  if (!Array.isArray(posters) || !posters.every((p) => typeof p === 'string')) throw new Error('facts: posters ha de ser una llista de textos')
  if (!Array.isArray(activeLocales) || activeLocales.length === 0 || !activeLocales.every(isLocale)) {
    throw new Error('facts: activeLocales ha de ser una llista no buida de ca, en o es')
  }
  return {
    schema: 1,
    id,
    domain,
    url,
    name: str('name'),
    locale,
    defaultLocale: o.defaultLocale,
    themeColor,
    coreVersion: str('coreVersion'),
    backupVersion: o.backupVersion,
    posters,
    activeLocales,
  }
}
