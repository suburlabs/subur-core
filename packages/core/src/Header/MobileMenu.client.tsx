'use client'

import { Mail, Menu, Phone } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

import { resolveLinkHref } from '../components/Link/resolveLinkHref.js'
import { LocaleSwitcher } from '../components/LocaleSwitcher/index.js'
import { Button } from '../components/ui/button.js'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '../components/ui/sheet.js'
import type { Locale } from '../i18n/config.js'

import { isActiveNavHref } from './isActiveNavHref.js'
import type { NavItem } from './Nav.client.js'

type Props = {
  emailHref?: string
  items: NavItem[]
  labels: {
    callUs: string
    closeMenu: string
    languageLabel: string
    menu: string
    writeUs: string
  }
  locale: Locale
  locales: readonly Locale[]
  phoneHref?: string
}

export function MobileMenu({ emailHref, items, labels, locale, locales, phoneHref }: Props) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  // Close the sheet when navigation changes the route. Adjusted during render
  // (React's recommended pattern for "reset state when a prop changes")
  // rather than in a useEffect, which would call setState after paint and
  // trip this repo's react-hooks/set-state-in-effect lint rule.
  const [lastPathname, setLastPathname] = useState(pathname)
  if (pathname !== lastPathname) {
    setLastPathname(pathname)
    setOpen(false)
  }

  return (
    <Sheet onOpenChange={setOpen} open={open}>
      <SheetTrigger asChild>
        <Button aria-label={labels.menu} size="icon" variant="outline">
          <Menu className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent
        className="gap-0 border-none bg-[repeating-linear-gradient(to_bottom,var(--shutter)_0_22px,var(--shutter-strong)_22px_23px)] p-0 text-shutter-foreground [&>button]:text-shutter-foreground"
        closeLabel={labels.closeMenu}
        data-field="shutter"
        side="top"
      >
        <SheetHeader className="wrap py-5">
          <SheetTitle className="font-display text-subtitle text-shutter-foreground">{labels.menu}</SheetTitle>
        </SheetHeader>
        <nav aria-label={labels.menu} className="wrap">
          <ul className="flex flex-col">
            {items.map((item, index) => {
              const href = resolveLinkHref(item.link, locale)
              if (!href) return null
              const active = isActiveNavHref(pathname, href)
              return (
                <li className="border-b border-shutter-foreground" key={item.id ?? index}>
                  <Link
                    aria-current={active ? 'page' : undefined}
                    className="block py-4 font-display text-title text-shutter-foreground no-underline aria-[current=page]:underline"
                    href={href}
                  >
                    {item.link.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>
        <div className="wrap flex flex-col gap-6 pb-8 pt-6">
          <LocaleSwitcher label={labels.languageLabel} locale={locale} locales={locales} tone="inverse" />
          {(phoneHref || emailHref) && (
            <div className="grid grid-cols-2 gap-3">
              {phoneHref && (
                <Button asChild size="lg" variant="secondary">
                  <a href={phoneHref}>
                    <Phone />
                    {labels.callUs}
                  </a>
                </Button>
              )}
              {emailHref && (
                <Button asChild size="lg" variant="secondary">
                  <a href={emailHref}>
                    <Mail />
                    {labels.writeUs}
                  </a>
                </Button>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
