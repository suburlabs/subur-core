import { Phone } from 'lucide-react'
import Link from 'next/link'

import { SiteLogo } from '../components/brand/SiteLogo.js'
import { LocaleSwitcher } from '../components/LocaleSwitcher/index.js'
import { Button } from '../components/ui/button.js'
import type { Locale } from '../i18n/config.js'
import { pageHref } from '../i18n/paths.js'
import { siteConfig } from 'subur-site-config'
import type { SiteData } from '../app/siteData.js'
import { mailtoHref, telHref } from '../utilities/contactHref.js'

import { MobileMenu } from './MobileMenu.client.js'
import { HeaderNav } from './Nav.client.js'

export async function Header({ data, locale }: { data: SiteData; locale: Locale }) {
  const [header, settings, activeLocales] = await Promise.all([
    data.getCachedGlobal('header', locale, 1)(),
    data.getSiteSettings(locale),
    data.getActiveLocales(),
  ])
  const { ui } = settings
  const items = header.navItems ?? []
  const phoneHref = telHref(settings.phone)

  return (
    <>
      <a
        className="sr-only z-50 bg-card px-4 py-3 font-semibold text-primary focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
        href="#contenido"
      >
        {ui.skipToContent}
      </a>
      <header
        className="sticky top-0 z-40 border-b border-shutter bg-background"
        data-site-header
      >
        <div className="wrap flex h-[calc(var(--header-h)-1px)] items-center gap-6">
          <Link aria-label={siteConfig.name} className="shrink-0" href={pageHref(locale, 'home')}>
            <span className="logo-mount">
              <SiteLogo />
            </span>
          </Link>
          <HeaderNav className="hidden lg:flex" items={items} label={ui.menu} locale={locale} />
          <div className="ml-auto hidden items-center gap-4 lg:flex">
            <LocaleSwitcher label={ui.languageLabel} locale={locale} locales={activeLocales} />
            {phoneHref && (
              <Button asChild>
                <a href={phoneHref}>
                  <Phone />
                  {ui.callUs}
                </a>
              </Button>
            )}
          </div>
          <div className="ml-auto flex items-center gap-2 lg:hidden">
            {phoneHref && (
              <Button aria-label={ui.callUs} asChild size="icon" variant="outline">
                <a href={phoneHref}>
                  <Phone className="size-5" />
                </a>
              </Button>
            )}
            <MobileMenu
              emailHref={mailtoHref(settings.email)}
              items={items}
              labels={{
                callUs: ui.callUs,
                closeMenu: ui.closeMenu,
                languageLabel: ui.languageLabel,
                menu: ui.menu,
                writeUs: ui.writeUs,
              }}
              locale={locale}
              locales={activeLocales}
              phoneHref={phoneHref}
            />
          </div>
        </div>
      </header>
    </>
  )
}
