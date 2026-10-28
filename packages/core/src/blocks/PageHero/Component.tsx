import { Media } from '../../components/Media/index.js'
import type { PageHeroBlock } from '../../types/subur-types.js'

export function PageHero({ heading, image, lead }: PageHeroBlock) {
  return (
    <header className="pb-section" data-block="pageHero">
      <div className="wrap mt-[clamp(2.5rem,2rem+3vw,5rem)] grid gap-8 lg:grid-cols-12 lg:items-end">
        <h1 className="text-display lg:col-span-7">{heading}</h1>
        {lead && <p className="max-w-[46ch] text-lead text-muted-foreground lg:col-span-5">{lead}</p>}
      </div>
      {image && typeof image === 'object' && (
        <div className="wrap mt-12">
          <div className="relative aspect-[16/7] overflow-hidden bg-surface-shade">
            <Media
              className="absolute inset-0"
              fill
              imgClassName="object-cover"
              resource={image}
              // The photo spans `.wrap`'s content box: `max-width: 80rem` (1280px) with
              // `padding-inline: clamp(1rem, 4vw, 3rem)` on each side. Below 1280px the
              // padding scales with the viewport, so the box is ~92vw down to the clamp's
              // floor; at 1280px+ `wrap` itself caps out at 80rem - 2×3rem = 1184px.
              size="(min-width: 1280px) 1184px, (min-width: 1200px) calc(100vw - 6rem), (min-width: 400px) 92vw, calc(100vw - 2rem)"
            />
          </div>
        </div>
      )}
    </header>
  )
}
