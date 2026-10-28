import { Phone } from 'lucide-react'
import Link from 'next/link'

import { Button } from '../components/ui/button.js'
import { pageHref } from '../i18n/paths.js'
import { getRequestLocale } from '../i18n/requestLocale.js'
import { Plaque } from '../ui/index.js'
import { telHref } from '../utilities/contactHref.js'
import { type ConfigArg, createSiteData } from './siteData.js'

/**
 * La 404 de `[locale]` (spec §3.1): el `Plaque` del hero d'inici sense la fotografia, amb els textos dels ajustos.
 * L'idioma és el que hi ha desat el layout (`not-found.tsx` no rep `params`).
 */
export function createNotFound({ config }: { config: ConfigArg }) {
  const data = createSiteData(config)

  return async function NotFound() {
    const locale = getRequestLocale()
    const settings = await data.getSiteSettings(locale)
    const { ui } = settings
    const phoneHref = telHref(settings.phone)

    return (
      <section className="wrap flex min-h-[60svh] flex-col justify-center py-section">
        <Plaque className="w-fit max-w-full" size="lg">
          <h1 className="max-w-[18ch] text-hero">{ui.notFoundTitle}</h1>
          <p className="mt-4 max-w-[32ch] font-sans text-lead text-tile-muted-foreground">{ui.notFoundText}</p>
          <div className="mt-6 flex flex-wrap gap-3 font-sans">
            <Button asChild size="lg">
              <Link href={pageHref(locale, 'home')}>{ui.backHome}</Link>
            </Button>
            {phoneHref && (
              <Button asChild size="lg" variant="outline">
                <a href={phoneHref}>
                  <Phone />
                  {ui.callUs}
                </a>
              </Button>
            )}
          </div>
        </Plaque>
      </section>
    )
  }
}
