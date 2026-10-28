'use client'

import { usePathname, useRouter } from 'next/navigation'

import { ToggleGroup, ToggleGroupItem } from '../ui/toggle-group.js'
import { supportedLocales } from '../../i18n/catalog.js'
import { isLocale, type Locale, LOCALE_COOKIE, locales as catalogLocales } from '../../i18n/config.js'
import { switchLocalePath } from '../../i18n/paths.js'
import { cn } from '../../utilities/ui.js'

type Props = {
  className?: string
  label: string
  locale: Locale
  locales: readonly Locale[]
  tone?: 'default' | 'inverse'
}

export function LocaleSwitcher({ className, label, locale, locales, tone = 'default' }: Props) {
  const pathname = usePathname()
  const router = useRouter()

  const onValueChange = (next: string) => {
    if (!next || next === locale || !isLocale(next) || !locales.includes(next)) return
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`
    // Reconèixer el prefix ACTUAL de la URL exigeix el catàleg sencer, no la
    // llista activa: sota un idioma desactivat (`/en/...` amb `en` fora de
    // `locales`), `switchLocalePath` ha de substituir aquest primer segment,
    // no afegir-n'hi un altre davant (`/ca/en/...`).
    router.push(switchLocalePath(pathname, next, catalogLocales))
  }

  if (locales.length < 2) return null

  return (
    <ToggleGroup
      aria-label={label}
      className={cn('gap-1', className)}
      onValueChange={onValueChange}
      type="single"
      value={locale}
    >
      {locales.map((code) => (
        <ToggleGroupItem
          aria-label={supportedLocales[code].name}
          className={cn(
            'h-10 min-w-11 rounded-sm border px-2 font-display text-sm font-semibold transition-colors',
            tone === 'default'
              ? 'border-primary bg-card text-primary hover:bg-surface-shade hover:text-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground'
              : 'border-shutter-foreground bg-transparent text-shutter-foreground hover:bg-shutter-strong hover:text-shutter-foreground data-[state=on]:bg-tile data-[state=on]:text-tile-foreground',
          )}
          key={code}
          lang={code}
          value={code}
        >
          {code.toUpperCase()}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
