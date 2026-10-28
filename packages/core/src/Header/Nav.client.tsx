'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { resolveLinkHref } from '../components/Link/resolveLinkHref.js'
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
} from '../components/ui/navigation-menu.js'
import type { Locale } from '../i18n/config.js'
import type { Header } from '../types/subur-types.js'
import { cn } from '../utilities/ui.js'

import { isActiveNavHref } from './isActiveNavHref.js'

export type NavItem = NonNullable<Header['navItems']>[number]

type Props = {
  className?: string
  items: NavItem[]
  label: string
  locale: Locale
}

export function HeaderNav({ className, items, label, locale }: Props) {
  const pathname = usePathname()

  return (
    <NavigationMenu aria-label={label} className={className} viewport={false}>
      <NavigationMenuList className="gap-1">
        {items.map((item, index) => {
          const href = resolveLinkHref(item.link, locale)
          if (!href) return null
          const active = isActiveNavHref(pathname, href)

          return (
            <NavigationMenuItem key={item.id ?? index}>
              <NavigationMenuLink active={active} asChild>
                <Link
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'relative rounded-none bg-transparent px-3 py-2 font-sans text-[0.9375rem] font-medium text-foreground',
                    'hover:bg-transparent hover:text-primary focus:bg-transparent data-[active=true]:bg-transparent data-[active=true]:text-primary',
                    'after:absolute after:inset-x-3 after:bottom-0 after:h-[3px] after:origin-left after:scale-x-0 after:bg-primary after:transition-transform after:duration-300 after:ease-(--ease-shutter)',
                    'hover:after:scale-x-100 data-[active=true]:after:scale-x-100',
                  )}
                  href={href}
                >
                  {item.link.label}
                </Link>
              </NavigationMenuLink>
            </NavigationMenuItem>
          )
        })}
      </NavigationMenuList>
    </NavigationMenu>
  )
}
