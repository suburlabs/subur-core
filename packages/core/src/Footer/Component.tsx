import { CookiePreferencesTrigger } from '../components/CookiePreferencesTrigger/index.js'
import { CMSLink } from '../components/Link/index.js'
import { SocialLinks } from '../components/SocialLinks/index.js'
import { SuburCredit } from '../components/SuburCredit/index.js'
import { ThemeToggle } from '../components/ThemeToggle/index.js'
import { SiteLogo } from '../components/brand/SiteLogo.js'
import { footerLink } from './footerLink.js'
import type { Locale } from '../i18n/config.js'
import { siteConfig } from 'subur-site-config'
import type { SiteData } from '../app/siteData.js'
import { Divider, Plaque } from '../ui/index.js'
import { mailtoHref, telHref } from '../utilities/contactHref.js'

export async function Footer({ data, locale }: { data: SiteData; locale: Locale }) {
  const [footer, settings, footerCredit] = await Promise.all([
    data.getCachedGlobal('footer', locale, 1)(),
    data.getSiteSettings(locale),
    data.getFooterCredit(),
  ])
  const phoneHref = telHref(settings.phone)
  const emailHref = mailtoHref(settings.email)

  return (
    <footer className="mt-auto bg-shutter text-shutter-foreground" data-field="shutter" data-site-footer>
      <Divider density="tight" tone="inverse" />
      <div className="wrap grid gap-12 py-section lg:grid-cols-12">
        <div className="flex flex-col gap-6 lg:col-span-4">
          <Plaque className="self-start" size="md">
            <SiteLogo className="h-12 lg:h-14" />
          </Plaque>
          {footer.tagline && (
            <p className="max-w-[30ch] font-display text-subtitle">{footer.tagline}</p>
          )}
        </div>

        <div className="grid gap-10 sm:grid-cols-2 lg:col-span-4">
          {footer.columns?.map((column, index) => (
            <nav aria-label={column.title} key={column.id ?? index}>
              <p className="font-display text-lg font-semibold">{column.title}</p>
              <ul className="mt-3 flex flex-col gap-2">
                {column.links?.map((item, linkIndex) => (
                  <li key={item.id ?? linkIndex}>
                    <CMSLink {...item.link} className={footerLink} locale={locale} />
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="flex flex-col gap-4 lg:col-span-4">
          <Plaque as="address" className="flex flex-col gap-3 not-italic" size="md">
            <p className="whitespace-pre-line text-lg leading-snug">{settings.address}</p>
            {phoneHref && (
              <a className="font-sans font-semibold text-tile-foreground" href={phoneHref}>
                {settings.phone}
              </a>
            )}
            {emailHref && (
              <a className="[overflow-wrap:anywhere] font-sans text-tile-foreground" href={emailHref}>
                {settings.email}
              </a>
            )}
            <p className="font-sans text-sm text-tile-muted-foreground">{settings.hours}</p>
          </Plaque>
          <SocialLinks socials={settings.socials} />
        </div>
      </div>

      <div className="wrap pb-6 text-sm">
        <div className="flex flex-col gap-6 border-t border-shutter-strong pt-6 lg:flex-row lg:items-center lg:justify-between">
          <p>
            © {new Date().getFullYear()} {siteConfig.name}. {settings.ui.copyright}
          </p>
          {/* Només si el contracte el porta (`subscription.footerCredit`, spec §0.5). */}
          {footerCredit && <SuburCredit locale={locale} />}
          <ul className="flex flex-wrap gap-x-6 gap-y-2">
            {footer.legalLinks?.map((item, index) => (
              <li key={item.id ?? index}>
                <CMSLink {...item.link} className={footerLink} locale={locale} />
              </li>
            ))}
            <li>
              <CookiePreferencesTrigger label={settings.ui.cookiePreferences} />
            </li>
          </ul>
          <ThemeToggle
            labels={{
              dark: settings.ui.themeDark,
              label: settings.ui.themeLabel,
              light: settings.ui.themeLight,
              system: settings.ui.themeSystem,
            }}
          />
        </div>
      </div>
    </footer>
  )
}
