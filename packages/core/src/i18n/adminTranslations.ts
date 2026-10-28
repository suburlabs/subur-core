import type { SupportedLocale } from './catalog.js'

/**
 * Traduccions pròpies del panell, connectades a `i18n.translations`
 * (`buildSuburConfig`, amb el correu de suport). Dos espais de noms conviuen aquí: `subur` és
 * nostre (el tauler d’inici) i `general` sobreescriu una clau del motor,
 * `general:payloadSettings`, la capçalera de `/admin/account` que anomena
 * el motor pel seu nom en comptes de «Subur». El motor fa un `deepMerge`
 * de les traduccions pròpies sobre les seves
 * (`node_modules/@payloadcms/translations/dist/utilities/init.js`), així que
 * sobreescriure una clau de `general` no esborra la resta de l’espai.
 */

const es = {
  editPagesBody:
    'entre en Páginas, abra una página y modifique sus bloques. Pulse «Publicar» para que los cambios aparezcan en la web.',
  editPagesLinkLabel: 'Ir a Páginas',
  editPagesTitle: 'Editar páginas:',
  formMessagesBody: 'están en Envíos de formularios.',
  formMessagesLinkLabel: 'Ir a Envíos de formularios',
  formMessagesTitle: 'Ver mensajes del formulario:',
  helpBody: 'Escriba a',
  helpTitle: '¿Necesita ayuda?',
  localeActive: 'Activo',
  localesManage: 'Gestionar la suscripción',
  localesTitle: 'Idiomas',
  switchLocaleBody:
    'use el selector de idioma de la parte superior del documento. Si un texto no está traducido, la web muestra el del idioma principal.',
  switchLocaleTitle: 'Cambiar de idioma:',
  welcome: 'Bienvenido al panel de su web',
}

/** El missatge d'idioma no inclòs porta el correu de suport de `buildSuburConfig` (`support.email`). */
const localeInactive = (email: string): Record<SupportedLocale, string> => ({
  ca: `No inclòs al seu pla. Escrigui a ${email}`,
  en: `Not included in your plan. Write to ${email}`,
  es: `No incluido en su plan. Escriba a ${email}`,
})

type DashboardKey = keyof typeof es | 'localeInactive'

const ca: Record<Exclude<DashboardKey, 'localeInactive'>, string> = {
  editPagesBody:
    'entri a Pàgines, obri una pàgina i modifiqui’n els blocs. Premi «Publicar» perquè els canvis apareguin al web.',
  editPagesLinkLabel: 'Anar a Pàgines',
  editPagesTitle: 'Editar pàgines:',
  formMessagesBody: 'són a Enviaments de formulari.',
  formMessagesLinkLabel: 'Anar a Enviaments de formulari',
  formMessagesTitle: 'Veure els missatges del formulari:',
  helpBody: 'Escrigui a',
  helpTitle: 'Necessita ajuda?',
  localeActive: 'Actiu',
  localesManage: 'Gestionar la subscripció',
  localesTitle: 'Idiomes',
  switchLocaleBody:
    'faci servir el selector d’idioma de la part superior del document. Si un text no està traduït, el web mostra el de l’idioma principal.',
  switchLocaleTitle: 'Canviar d’idioma:',
  welcome: 'Benvingut al panell del seu web',
}

const en: Record<Exclude<DashboardKey, 'localeInactive'>, string> = {
  editPagesBody:
    'go to Pages, open a page and edit its blocks. Press “Publish” for the changes to appear on the site.',
  editPagesLinkLabel: 'Go to Pages',
  editPagesTitle: 'Edit pages:',
  formMessagesBody: 'they are in Form submissions.',
  formMessagesLinkLabel: 'Go to Form submissions',
  formMessagesTitle: 'See form messages:',
  helpBody: 'Write to',
  helpTitle: 'Need help?',
  localeActive: 'Active',
  localesManage: 'Manage the subscription',
  localesTitle: 'Languages',
  switchLocaleBody:
    'use the language selector at the top of the document. If a text is not translated, the site shows the main language.',
  switchLocaleTitle: 'Switch language:',
  welcome: 'Welcome to your site’s panel',
}

/**
 * Sobreescriptura de `general:payloadSettings` (capçalera de `/admin/account`).
 * Confirmat el text exacte i la clau a
 * `node_modules/@payloadcms/translations/dist/languages/{es,ca,en}.js`.
 */
type GeneralKey = 'payloadSettings'

const generalEs: Record<GeneralKey, string> = {
  payloadSettings: 'Configuración de Subur',
}

const generalCa: Record<GeneralKey, string> = {
  payloadSettings: 'Configuració de Subur',
}

const generalEn: Record<GeneralKey, string> = {
  payloadSettings: 'Subur settings',
}

/**
 * El connector de redireccions (`@payloadcms/plugin-redirects`) porta les seves etiquetes en `en, es, fr, ja, pt, sv`,
 * però no en català: un panell `ca` mostrava les claus nues (`key not found: plugin-redirects:*`). Les claus són les de
 * `node_modules/@payloadcms/plugin-redirects/dist/translations/languages/en.js`; el connector fa un `deepMergeSimple`
 * de les seves traduccions per sota de les de la configuració (`dist/index.js`), així que aquest bloc s'hi afegeix.
 */
type RedirectsKey = 'customUrl' | 'documentToRedirect' | 'fromUrl' | 'internalLink' | 'redirectType' | 'toUrlType'

const redirectsCa: Record<RedirectsKey, string> = {
  customUrl: 'URL personalitzada',
  documentToRedirect: 'Document de destinació',
  fromUrl: 'URL d’origen',
  internalLink: 'Enllaç intern',
  redirectType: 'Tipus de redirecció',
  toUrlType: 'Tipus de destinació',
}

type PanelTranslations = {
  general: Record<GeneralKey, string>
  'plugin-redirects'?: Record<RedirectsKey, string>
  subur: Record<DashboardKey, string>
}

export const adminTranslations = (supportEmail: string): Record<SupportedLocale, PanelTranslations> => {
  const inactive = localeInactive(supportEmail)
  return {
    ca: { general: generalCa, 'plugin-redirects': redirectsCa, subur: { ...ca, localeInactive: inactive.ca } },
    en: { general: generalEn, subur: { ...en, localeInactive: inactive.en } },
    es: { general: generalEs, subur: { ...es, localeInactive: inactive.es } },
  }
}
