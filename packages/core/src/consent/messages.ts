import type { Translations } from 'c15t'

import type { Locale } from '../i18n/config.js'

/**
 * Textos del bàner i del diàleg de consentiment, una sola font per al client i per al backend.
 *
 * - El client (`src/providers/Consent.tsx`) els passa com a `i18n.messages` de `ConsentManagerProvider`.
 * - El backend (`src/consent/backend.ts`) els registra com a perfil `default` d'`i18n.messages` de `c15tInstance`.
 *   Sense això, el backend només coneix els idiomes de `baseTranslations` (`@c15t/translations/dist/all.js`), on no hi
 *   ha `ca`: per a `Accept-Language: ca`, `/init` responia `"language": "en"` i el client, que en mode `hosted` pren
 *   sempre l'idioma de la resposta (`c15t/dist/index.js`, `buildStoreUpdate`), pintava el bàner en anglès a `/ca`.
 *
 * El paquet de c15t només porta l'anglès com a base al client (`@c15t/translations/dist/translations` només té `en`), i
 * el backend fa servir l'anglès de base per a un idioma que no és a `baseTranslations`. Per això cada idioma es defineix
 * complet aquí, no com a pedaç parcial sobre les traduccions incloses.
 *
 * És un mòdul de dades pur (sense directiva ni cap import de valor) perquè el comparteixen el proveïdor de client
 * (`src/providers/Consent.tsx`, `'use client'`) i el backend de servidor (`src/consent/backend.ts`, a través de
 * `src/app/consent.ts`): un import de valor arrossegaria codi de servidor al paquet del client, o React al backend.
 */
export const consentMessages: Record<Locale, Partial<Translations>> = {
  es: {
    cookieBanner: {
      title: 'Cookies',
      description:
        'Esta web usa lo imprescindible para funcionar: recordar su idioma, recordar si prefiere el tema claro u oscuro y mantener la sesión del panel de administración. Si lo acepta, también recoge estadísticas de uso anónimas (Umami, sin cookies) para mejorar la web. No hay publicidad ni seguimiento de terceros.',
    },
    common: {
      acceptAll: 'Aceptar',
      rejectAll: 'Rechazar',
      customize: 'Preferencias',
      save: 'Guardar',
      close: 'Cerrar',
    },
    consentManagerDialog: {
      title: 'Preferencias de cookies',
      description:
        'Esta web usa lo estrictamente necesario para funcionar y una categoría opcional que puede activar o desactivar.',
    },
    consentTypes: {
      necessary: {
        title: 'Estrictamente necesarias',
        description:
          'Recordar su idioma, su preferencia de tema claro u oscuro y mantener la sesión del panel de administración.',
      },
      measurement: {
        title: 'Medición',
        description:
          'Estadísticas de uso anónimas para mejorar la web: visitas y uso de los botones de contacto (Umami, sin cookies). Puede desactivarlas.',
      },
    },
  },
  ca: {
    cookieBanner: {
      title: 'Galetes',
      description:
        'Aquest web fa servir el que és imprescindible per funcionar: recordar el seu idioma, recordar si prefereix el tema clar o fosc i mantenir la sessió del tauler d’administració. Si ho accepta, també recull estadístiques d’ús anònimes (Umami, sense galetes) per millorar el web. No hi ha publicitat ni seguiment de tercers.',
    },
    common: {
      acceptAll: 'Accepta',
      rejectAll: 'Rebutja',
      customize: 'Preferències',
      save: 'Desa',
      close: 'Tanca',
    },
    consentManagerDialog: {
      title: 'Preferències de galetes',
      description:
        'Aquest web fa servir el que és estrictament necessari per funcionar i una categoria opcional que pot activar o desactivar.',
    },
    consentTypes: {
      necessary: {
        title: 'Estrictament necessàries',
        description:
          'Recordar el seu idioma, la seva preferència de tema clar o fosc i mantenir la sessió del tauler d’administració.',
      },
      measurement: {
        title: 'Mesurament',
        description:
          'Estadístiques d’ús anònimes per millorar el web: visites i ús dels botons de contacte (Umami, sense galetes). Les pot desactivar.',
      },
    },
  },
  en: {
    cookieBanner: {
      title: 'Cookies',
      description:
        'This site uses what it needs to work: remembering your language, remembering whether you prefer the light or dark theme, and keeping the admin session. If you accept, it also collects anonymous usage statistics (Umami, no cookies) to improve the site. There is no advertising and no third-party tracking.',
    },
    common: {
      acceptAll: 'Accept',
      rejectAll: 'Reject',
      customize: 'Preferences',
      save: 'Save',
      close: 'Close',
    },
    consentManagerDialog: {
      title: 'Cookie preferences',
      description: 'This site uses what is strictly necessary to work, plus one optional category you can turn on or off.',
    },
    consentTypes: {
      necessary: {
        title: 'Strictly necessary',
        description:
          'Remembering your language, your light/dark theme preference, and keeping the admin panel session.',
      },
      measurement: {
        title: 'Measurement',
        description:
          'Anonymous usage statistics to improve the site: visits and use of the contact buttons (Umami, no cookies). You can turn them off.',
      },
    },
  },
}
