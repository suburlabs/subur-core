'use client'

import { useEffect, useId, useMemo, useState } from 'react'

import { Avatar, AvatarFallback } from '../../components/ui/avatar.js'
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from '../../components/ui/carousel.js'
import { Plaque } from '../../ui/index.js'
import type { TestimonialsBlock } from '../../types/subur-types.js'
import { cn } from '../../utilities/ui.js'

type Props = {
  heading?: string | null
  items: TestimonialsBlock['items']
  labels: { label: string; next: string; previous: string }
}

/**
 * Monograma de la firma: com a molt dues inicials, i sempre de la firma real.
 * No hi ha cap fotografia d’autor perquè no en tenim cap de real — vegeu
 * DESIGN.md, «Testimonials».
 */
const initials = (author: string) =>
  author
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => Array.from(word)[0] ?? '')
    .join('')
    .toLocaleUpperCase()

/**
 * El carril d’opinions. Els rètols mantenen la seva pròpia alçada
 * (`items-start`) com a la graella d’abans: un rètol curt no s’estira per
 * igualar el més alt de la fila.
 */
export function TestimonialsRail({ heading, items, labels }: Props) {
  const headingId = useId()
  const [api, setApi] = useState<CarouselApi>()
  const [snaps, setSnaps] = useState<number[]>([])
  const [selected, setSelected] = useState(0)
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setReducedMotion(query.matches)

    sync()
    query.addEventListener('change', sync)

    return () => query.removeEventListener('change', sync)
  }, [])

  useEffect(() => {
    if (!api) return

    const sync = () => {
      setSnaps(api.scrollSnapList())
      setSelected(api.selectedScrollSnap())
    }

    sync()
    api.on('reInit', sync)
    api.on('select', sync)

    return () => {
      api.off('reInit', sync)
      api.off('select', sync)
    }
  }, [api])

  // Amb moviment reduït el carril salta a la posició en comptes d’arrossegar-s’hi.
  const opts = useMemo(
    () => ({
      align: 'start' as const,
      containScroll: 'trimSnaps' as const,
      duration: reducedMotion ? 0 : 22,
    }),
    [reducedMotion],
  )

  // Abans que Embla s’iniciï —i sense JS— la comptem pel nombre d’opinions, que
  // és el que val a mòbil. Així la fila de marques no canvia d’alçada en hidratar.
  const marks = snaps.length > 0 ? snaps.length : items.length
  const many = items.length > 1

  return (
    <Carousel
      aria-label={heading ? undefined : labels.label}
      aria-labelledby={heading ? headingId : undefined}
      data-rail=""
      opts={opts}
      setApi={setApi}
    >
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        {heading && (
          <h2 className="text-title" id={headingId}>
            {heading}
          </h2>
        )}
        {many && (
          <div className="flex items-center gap-3" data-rail-controls="">
            <CarouselPrevious
              aria-label={labels.previous}
              className="static size-11 translate-y-0 rounded-sm"
            />
            <CarouselNext
              aria-label={labels.next}
              className="static size-11 translate-y-0 rounded-sm"
            />
          </div>
        )}
      </div>

      <CarouselContent className="mt-12 -ml-6 items-start">
        {items.map((item, index) => (
          <CarouselItem
            aria-label={item.author}
            className="basis-full pl-6 sm:basis-1/2 lg:basis-1/3"
            key={item.id ?? index}
          >
            <Plaque as="blockquote" className="flex w-full flex-col gap-4" size="md">
              <p className="font-sans text-subtitle">{item.quote}</p>
              <footer className="flex items-center gap-3">
                <Avatar aria-hidden="true" className="size-10 rounded-sm">
                  <AvatarFallback className="rounded-sm bg-tile-shade font-sans text-sm font-semibold text-tile-foreground">
                    {initials(item.author)}
                  </AvatarFallback>
                </Avatar>
                <p className="font-sans text-sm font-semibold text-tile-foreground">
                  {item.author}
                  {item.detail && (
                    <span className="block font-normal text-tile-muted-foreground">
                      {item.detail}
                    </span>
                  )}
                </p>
              </footer>
            </Plaque>
          </CarouselItem>
        ))}
      </CarouselContent>

      {many && (
        <div
          aria-label={labels.label}
          className="mt-4 flex flex-wrap items-center justify-center"
          data-rail-marks=""
          role="group"
        >
          {Array.from({ length: marks }, (_, index) => (
            <button
              aria-current={index === selected ? true : undefined}
              aria-label={items[index]?.author}
              className="group flex size-9 items-center justify-center"
              key={index}
              onClick={() => api?.scrollTo(index)}
              type="button"
            >
              <span
                className={cn(
                  'size-3 rounded-sm border border-primary transition-colors duration-200 ease-(--ease-shutter)',
                  index === selected ? 'bg-primary' : 'bg-transparent group-hover:bg-surface-shade',
                )}
              />
            </button>
          ))}
        </div>
      )}
    </Carousel>
  )
}
