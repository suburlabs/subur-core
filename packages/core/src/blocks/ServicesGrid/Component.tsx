import { ArrowRight } from 'lucide-react'
import Link from 'next/link'

import { Media } from '../../components/Media/index.js'
import { pageHref } from '../../i18n/paths.js'
import { Plaque } from '../../ui/index.js'
import type { ServicesGridBlock } from '../../types/subur-types.js'

import type { BlockContext } from '../types.js'

export function ServicesGrid({ heading, intro, items, locale, settings }: ServicesGridBlock & BlockContext) {
  return (
    <section className="py-section" data-block="servicesGrid">
      {(heading || intro) && (
        <div className="wrap grid gap-6 lg:grid-cols-12 lg:items-end">
          {heading && <h2 className="text-title lg:col-span-5">{heading}</h2>}
          {intro && <p className="text-lead text-muted-foreground lg:col-span-6 lg:col-start-7">{intro}</p>}
        </div>
      )}
      <ul className="wrap mt-12 grid gap-x-6 gap-y-14 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item, index) => {
          const href =
            typeof item.page === 'object' && item.page?.slug ? pageHref(locale, item.page.slug) : null

          return (
            <li className="group flex flex-col" key={item.id ?? index}>
              <div className="relative aspect-[4/3] sm:aspect-[4/5]">
                <div className="absolute inset-0 overflow-hidden bg-surface-shade">
                  {item.image && typeof item.image === 'object' && (
                    <Media
                      className="absolute inset-0"
                      fill
                      imgClassName="object-cover"
                      resource={item.image}
                      // `ul` is `wrap` (max 80rem, clamped inline padding) → 1 column below
                      // `sm`, 2 columns at `sm` (gap-x-6 = 1.5rem), 4 columns at `lg`
                      // (3 × 1.5rem = 4.5rem of gaps). `wrap`'s content box is ~92vw for the
                      // viewports these breakpoints span, so each column is that share of
                      // 92vw minus its slice of the gaps.
                      size="(min-width: 1024px) calc(23vw - 1.125rem), (min-width: 640px) calc(46vw - 0.75rem), 92vw"
                    />
                  )}
                </div>
                {item.tagline && (
                  <div className="absolute bottom-5 left-5">
                    <Plaque as="p" size="sm">
                      {item.tagline}
                    </Plaque>
                  </div>
                )}
              </div>
              <div className="flex flex-1 flex-col gap-3 border-t-[3px] border-primary pt-4">
                <h3 className="text-subtitle">{item.title}</h3>
                {item.summary && <p>{item.summary}</p>}
                {href && (
                  <Link
                    className="mt-auto inline-flex items-center gap-2 pt-2 font-semibold text-primary"
                    href={href}
                  >
                    {settings.ui.readMore}
                    <span className="sr-only"> — {item.title}</span>
                    <ArrowRight
                      aria-hidden="true"
                      className="size-4 transition-transform duration-300 ease-(--ease-shutter) group-hover:translate-x-1"
                    />
                  </Link>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
