import { Icon } from '../../components/Icon/index.js'
import { Plaque } from '../../ui/index.js'
import type { FeatureListBlock } from '../../types/subur-types.js'
import { cn } from '../../utilities/ui.js'

import type { BlockContext } from '../types.js'

type Moment = NonNullable<FeatureListBlock['items'][number]['moment']>

export function FeatureList({ columns, heading, intro, items, settings }: FeatureListBlock & BlockContext) {
  const momentLabels: Record<Moment, string> = {
    after: settings.ui.momentAfter,
    before: settings.ui.momentBefore,
    during: settings.ui.momentDuring,
    ongoing: settings.ui.momentOngoing,
  }
  const wide = columns === '4'
  // Sense `heading` de grup no hi ha cap h2 previ en aquesta secció: els
  // títols dels ítems passen a ser h2 perquè l'ordre de capçaleres no salti
  // de l'h1 anterior a un h3 (regla `heading-order`).
  const ItemHeading = heading ? 'h3' : 'h2'

  return (
    <section className="wrap py-section" data-block="featureList">
      {(heading || intro) && (
        <div className="mb-12 grid gap-6 lg:grid-cols-12 lg:items-end">
          {heading && <h2 className="text-title lg:col-span-6">{heading}</h2>}
          {intro && <p className="text-lead text-muted-foreground lg:col-span-5 lg:col-start-8">{intro}</p>}
        </div>
      )}
      <ul className={cn('grid', wide ? 'gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-4' : 'gap-x-12 md:grid-cols-2')}>
        {items.map((item, index) => (
          <li
            className={cn(
              'border-t border-primary',
              wide ? 'flex flex-col gap-3 pt-5' : 'grid gap-4 py-8 sm:grid-cols-[auto_1fr] sm:gap-6',
            )}
            key={item.id ?? index}
          >
            <Icon className="size-7 text-primary" name={item.icon} />
            <div className="flex flex-1 flex-col gap-3">
              <ItemHeading className="text-subtitle">{item.title}</ItemHeading>
              <p>{item.text}</p>
              {item.moment && (
                <Plaque as="p" className="mt-auto self-start" size="sm">
                  {momentLabels[item.moment]}
                </Plaque>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
