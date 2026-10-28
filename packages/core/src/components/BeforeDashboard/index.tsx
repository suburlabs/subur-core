import { Banner } from '@payloadcms/ui/elements/Banner'
import Link from 'next/link'
import type { ServerProps } from 'payload'
import React from 'react'

import { sortActiveLocales } from '../../i18n/activeLocalesOrder.js'
import { supportedLocales } from '../../i18n/catalog.js'
import { isLocale, locales } from '../../i18n/config.js'

import './index.scss'

const baseClass = 'before-dashboard'

/**
 * Component de servidor (§13.3): el panell li passa `i18n`, `payload` i
 * `user` (`ServerProps`, `node_modules/payload/dist/config/types.d.ts`), i
 * `buildSuburConfig` hi afegeix `supportEmail` per `serverProps`.
 * `i18n.t` del panell està tipat només amb les claus del motor
 * (`ClientTranslationKeys`); les nostres viuen a l'espai `subur` afegit a
 * `i18n.translations` (`src/i18n/adminTranslations.ts`), d'aquí el cast
 * puntual — no n'hi ha cap altre a aquest fitxer.
 */
const BeforeDashboard = async ({ i18n, payload, supportEmail, user }: ServerProps & { supportEmail: string }) => {
  const t = (key: string): string => (i18n.t as (key: string) => string)(`subur:${key}`)
  const isSuperAdmin = user?.role === 'superadmin'
  // L'idioma per defecte de la configuració resolta (`buildSuburConfig` sempre en posa un, el del client).
  const configured = payload.config.localization ? payload.config.localization.defaultLocale : ''
  const defaultLocale = isLocale(configured) ? configured : locales[0]

  const subscription = await payload.findGlobal({ depth: 0, slug: 'subscription' })
  const active = sortActiveLocales(subscription.activeLocales ?? [], defaultLocale)

  return (
    <div className={baseClass}>
      <Banner className={`${baseClass}__banner`} type="success">
        <h4>{t('welcome')}</h4>
      </Banner>
      <ul className={`${baseClass}__instructions`}>
        <li>
          <strong>{t('editPagesTitle')}</strong> {t('editPagesBody')}{' '}
          <Link aria-label={t('editPagesLinkLabel')} href="/admin/collections/pages">
            →
          </Link>
        </li>
        <li>
          <strong>{t('switchLocaleTitle')}</strong> {t('switchLocaleBody')}
        </li>
        <li>
          <strong>{t('formMessagesTitle')}</strong> {t('formMessagesBody')}{' '}
          <Link aria-label={t('formMessagesLinkLabel')} href="/admin/collections/form-submissions">
            →
          </Link>
        </li>
        <li>
          <strong>{t('helpTitle')}</strong> {t('helpBody')}{' '}
          <a href={`mailto:${supportEmail}`}>{supportEmail}</a>.
        </li>
      </ul>

      <section className={`${baseClass}__locales`} data-testid="dashboard-locales">
        <h4>{t('localesTitle')}</h4>
        <ul>
          {locales.map((code) => {
            const isActive = active.includes(code)
            return (
              <li data-active={isActive} key={code}>
                <strong lang={code}>{supportedLocales[code].name}</strong>{' '}
                <span>{isActive ? t('localeActive') : t('localeInactive')}</span>
              </li>
            )
          })}
        </ul>
        {isSuperAdmin && <Link href="/admin/globals/subscription">{t('localesManage')}</Link>}
      </section>
    </div>
  )
}

export default BeforeDashboard
