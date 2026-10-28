import type { Form as FormType } from '@payloadcms/plugin-form-builder/types'

import { pageHref } from '../../i18n/paths.js'
import { siteConfig } from 'subur-site-config'
import { Plaque } from '../../ui/index.js'
import type { ContactBlock } from '../../types/subur-types.js'
import { mailtoHref, telHref } from '../../utilities/contactHref.js'

import type { BlockContext } from '../types.js'
import { ContactForm } from './ContactForm.js'

export function Contact({ form, heading, locale, settings, text }: ContactBlock & BlockContext) {
  const { ui } = settings
  const phoneHref = telHref(settings.phone)
  const emailHref = mailtoHref(settings.email)

  return (
    <section className="wrap grid gap-12 py-section lg:grid-cols-12" data-block="contact">
      <div className="flex flex-col gap-6 lg:col-span-5">
        <h2 className="text-title">{heading}</h2>
        {text && <p className="text-lead text-muted-foreground">{text}</p>}
        <address className="flex flex-col gap-4 not-italic">
          {phoneHref && (
            <Plaque className="flex flex-col gap-1">
              <span className="font-sans text-sm font-semibold text-tile-muted-foreground">{ui.callUs}</span>
              <a className="text-subtitle text-tile-foreground" href={phoneHref}>
                {settings.phone}
              </a>
            </Plaque>
          )}
          {emailHref && (
            <Plaque className="flex flex-col gap-1">
              <span className="font-sans text-sm font-semibold text-tile-muted-foreground">{ui.writeUs}</span>
              <a className="break-all text-subtitle text-tile-foreground" href={emailHref}>
                {settings.email}
              </a>
            </Plaque>
          )}
          <Plaque className="flex flex-col gap-1">
            <p className="whitespace-pre-line font-sans">{settings.address}</p>
            <p className="font-sans text-sm text-tile-muted-foreground">{settings.hours}</p>
          </Plaque>
        </address>
      </div>
      {typeof form === 'object' && (
        <div className="border-[1.5px] border-primary bg-card p-[clamp(1.25rem,1rem+2vw,2.5rem)] lg:col-span-7">
          <ContactForm
            form={form as unknown as FormType}
            labels={{
              error: ui.formError,
              invalidEmail: ui.formInvalidEmail,
              privacyHref: pageHref(locale, siteConfig.legalSlugs.privacy),
              privacyPolicy: ui.privacyPolicy,
              required: ui.formRequired,
              success: ui.formSuccess,
            }}
            locale={locale}
          />
        </div>
      )}
    </section>
  )
}
