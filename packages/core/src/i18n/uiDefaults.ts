import type { Locale } from './config.js'

type Entry = { label: Record<Locale, string>; text: Record<Locale, string> }

/**
 * Textos curts de la interfície de la web (botons, menús, formulari, 404) en
 * tots els idiomes del catàleg. El client els pot sobreescriure a «Ajustes de
 * la web»; si deixa un camp buit, la web fa servir aquest text. Un idioma
 * acabat d'activar neix, així, amb la interfície ja traduïda.
 */
export const uiDefaults = {
  backHome: {
    label: { ca: 'Tornar a l’inici', en: 'Back to home', es: 'Volver al inicio' },
    text: { ca: 'Tornar a l’inici', en: 'Back to home', es: 'Volver al inicio' },
  },
  callUs: {
    label: { ca: 'Botó de trucada', en: 'Call button', es: 'Botón de llamada' },
    text: { ca: "Truqui'ns", en: 'Call us', es: 'Llámenos' },
  },
  closeMenu: {
    label: { ca: 'Tancar el menú', en: 'Close menu', es: 'Cerrar menú' },
    text: { ca: 'Tancar el menú', en: 'Close menu', es: 'Cerrar menú' },
  },
  cookiePreferences: {
    label: { ca: 'Preferències de galetes', en: 'Cookie preferences', es: 'Preferencias de cookies' },
    text: { ca: 'Preferències de galetes', en: 'Cookie preferences', es: 'Preferencias de cookies' },
  },
  copyright: {
    label: { ca: 'Drets reservats', en: 'Rights reserved', es: 'Derechos reservados' },
    text: { ca: 'Tots els drets reservats.', en: 'All rights reserved.', es: 'Todos los derechos reservados.' },
  },
  formError: {
    label: { ca: 'Formulari: error d’enviament', en: 'Form: sending error', es: 'Formulario: error de envío' },
    text: {
      ca: 'No hem pogut enviar el seu missatge. Torni-ho a provar o truqui’ns.',
      en: "We couldn't send your message. Please try again or call us.",
      es: 'No hemos podido enviar su mensaje. Inténtelo de nuevo o llámenos.',
    },
  },
  formInvalidEmail: {
    label: { ca: 'Formulari: email no vàlid', en: 'Form: invalid email', es: 'Formulario: email no válido' },
    text: { ca: 'Introdueixi un email vàlid', en: 'Please enter a valid email', es: 'Introduzca un email válido' },
  },
  formRequired: {
    label: { ca: 'Formulari: camp obligatori', en: 'Form: required field', es: 'Formulario: campo obligatorio' },
    text: { ca: 'Aquest camp és obligatori', en: 'This field is required', es: 'Este campo es obligatorio' },
  },
  formSuccess: {
    label: { ca: 'Formulari: enviat', en: 'Form: sent', es: 'Formulario: enviado' },
    text: {
      ca: 'Gràcies. Hem rebut el seu missatge i li respondrem en breu.',
      en: "Thank you. We've received your message and will get back to you shortly.",
      es: 'Gracias. Hemos recibido su mensaje y le responderemos en breve.',
    },
  },
  heroFilmLoading: {
    label: { ca: 'Portada: carregant la pel·lícula', en: 'Hero: loading the film', es: 'Portada: cargando la película' },
    text: { ca: 'Carregant la pel·lícula', en: 'Loading the film', es: 'Cargando la película' },
  },
  languageLabel: {
    label: { ca: 'Selector d’idioma', en: 'Language selector', es: 'Selector de idioma' },
    text: { ca: 'Idioma', en: 'Language', es: 'Idioma' },
  },
  menu: {
    label: { ca: 'Menú', en: 'Menu', es: 'Menú' },
    text: { ca: 'Menú', en: 'Menu', es: 'Menú' },
  },
  momentAfter: {
    label: { ca: 'Moment: després de l’estada', en: 'Moment: after the stay', es: 'Momento: después de la estancia' },
    text: { ca: 'Després de l’estada', en: 'After the stay', es: 'Después de la estancia' },
  },
  momentBefore: {
    label: { ca: 'Moment: abans de l’estada', en: 'Moment: before the stay', es: 'Momento: antes de la estancia' },
    text: { ca: 'Abans de l’estada', en: 'Before the stay', es: 'Antes de la estancia' },
  },
  momentDuring: {
    label: { ca: 'Moment: durant l’estada', en: 'Moment: during the stay', es: 'Momento: durante la estancia' },
    text: { ca: 'Durant l’estada', en: 'During the stay', es: 'Durante la estancia' },
  },
  momentOngoing: {
    label: { ca: 'Moment: de manera contínua', en: 'Moment: ongoing', es: 'Momento: de forma continua' },
    text: { ca: 'De manera contínua', en: 'Ongoing', es: 'De forma continua' },
  },
  notFoundText: {
    label: { ca: 'Pàgina no trobada: text', en: 'Page not found: text', es: 'Página no encontrada: texto' },
    text: {
      ca: 'La pàgina que cerca no existeix o ha canviat d’adreça.',
      en: "The page you're looking for doesn't exist or has moved.",
      es: 'La página que busca no existe o ha cambiado de dirección.',
    },
  },
  notFoundTitle: {
    label: { ca: 'Pàgina no trobada: títol', en: 'Page not found: title', es: 'Página no encontrada: título' },
    text: { ca: 'Pàgina no trobada', en: 'Page not found', es: 'Página no encontrada' },
  },
  privacyPolicy: {
    label: {
      ca: 'Enllaç a la política de privacitat',
      en: 'Link to the privacy policy',
      es: 'Enlace a la política de privacidad',
    },
    text: { ca: 'Política de privacitat', en: 'Privacy policy', es: 'Política de privacidad' },
  },
  readMore: {
    label: { ca: 'Llegir més', en: 'Read more', es: 'Leer más' },
    text: { ca: 'Llegir més', en: 'Read more', es: 'Leer más' },
  },
  skipToContent: {
    label: { ca: 'Saltar al contingut', en: 'Skip to content', es: 'Saltar al contenido' },
    text: { ca: 'Saltar al contingut', en: 'Skip to content', es: 'Saltar al contenido' },
  },
  testimonialsLabel: {
    label: {
      ca: 'Opinions: etiqueta del carrusel',
      en: 'Reviews: carousel label',
      es: 'Opiniones: etiqueta del carrusel',
    },
    text: { ca: 'Opinions de clients', en: 'Client reviews', es: 'Opiniones de clientes' },
  },
  testimonialsNext: {
    label: { ca: 'Opinions: opinió següent', en: 'Reviews: next review', es: 'Opiniones: opinión siguiente' },
    text: { ca: 'Opinió següent', en: 'Next review', es: 'Opinión siguiente' },
  },
  testimonialsPrevious: {
    label: { ca: 'Opinions: opinió anterior', en: 'Reviews: previous review', es: 'Opiniones: opinión anterior' },
    text: { ca: 'Opinió anterior', en: 'Previous review', es: 'Opinión anterior' },
  },
  themeDark: {
    label: { ca: 'Tema fosc', en: 'Dark theme', es: 'Tema oscuro' },
    text: { ca: 'Fosc', en: 'Dark', es: 'Oscuro' },
  },
  themeLabel: {
    label: { ca: 'Selector de tema', en: 'Theme selector', es: 'Selector de tema' },
    text: { ca: 'Tema', en: 'Theme', es: 'Tema' },
  },
  themeLight: {
    label: { ca: 'Tema clar', en: 'Light theme', es: 'Tema claro' },
    text: { ca: 'Clar', en: 'Light', es: 'Claro' },
  },
  themeSystem: {
    label: { ca: 'Tema del sistema', en: 'System theme', es: 'Tema del sistema' },
    text: { ca: 'Automàtic', en: 'System', es: 'Automático' },
  },
  writeUs: {
    label: { ca: 'Botó d’email', en: 'Email button', es: 'Botón de email' },
    text: { ca: "Escrigui'ns", en: 'Email us', es: 'Escríbanos' },
  },
} satisfies Record<string, Entry>

export type UiKey = keyof typeof uiDefaults

export const uiKeys = Object.keys(uiDefaults) as UiKey[]
