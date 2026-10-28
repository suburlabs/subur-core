import type { Locale } from '../i18n/config.js'
import type { Footer, Form, Header, Page, SiteSettings } from '../types/subur-types.js'

/**
 * Els identificadors que el motor del seed dona al `build` de cada idioma: el
 * formulari de contacte, cada imatge (per la clau `K` del client) i cada
 * pàgina (pel slug `S` del client). Cap slug ni cap imatge és fix del nucli.
 */
export type SeedRefs<S extends string, K extends string> = {
  formId: number
  media: Record<K, number>
  pages: Record<S, number>
}

type GlobalInput<T> = Omit<T, 'createdAt' | 'id' | 'updatedAt'>

export type FormInput = Pick<
  Form,
  'confirmationMessage' | 'confirmationType' | 'emails' | 'fields' | 'submitButtonLabel' | 'title'
>

export type PageInput = Pick<Page, 'layout' | 'meta' | 'slug' | 'title'>

export type SeedBuild<S extends string> = {
  footer: GlobalInput<Footer>
  header: GlobalInput<Header>
  pages: Record<S, PageInput>
  siteSettings: GlobalInput<SiteSettings>
}

export type SeedLocaleContent<S extends string, K extends string> = {
  build: (refs: SeedRefs<S, K>) => SeedBuild<S>
  form: FormInput
}

/**
 * El contingut d'un client (spec §3.5). `pageSlugs` n'ha de portar `home`, i
 * `byLocale` l'idioma per defecte del client i, amb `.subur/`, cada idioma
 * actiu del contracte: `runSeed` rebutja el contingut que no els porti.
 */
export type SeedContent<S extends string = string, K extends string = string> = {
  pageSlugs: readonly S[]
  byLocale: Partial<Record<Locale, SeedLocaleContent<S, K>>>
}

/** Les imatges del client: `dir` és el directori dels fitxers; `items`, el fitxer i el text alternatiu de cada clau. */
export type SeedMedia<K extends string = string> = {
  dir: string
  items: Record<K, { alt: Record<Locale, string>; file: string }>
}
