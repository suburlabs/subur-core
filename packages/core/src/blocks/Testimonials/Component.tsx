import type { TestimonialsBlock } from '../../types/subur-types.js'

import type { BlockContext } from '../types.js'
import { TestimonialsRail } from './Rail.client.js'

/**
 * Rètols de rajola amb les opinions reals dels clients, en un carril que
 * llisca. Sense estrelles, sense puntuacions i sense fotografies d’autor: no
 * en tenim cap de real i no se n’inventen. L’única marca al costat de la firma
 * és el seu monograma, fet amb les inicials d’aquella firma.
 */
export function Testimonials({ heading, items, settings }: BlockContext & TestimonialsBlock) {
  if (!items || items.length === 0) return null

  return (
    <section className="wrap py-section" data-block="testimonials">
      <TestimonialsRail
        heading={heading}
        items={items}
        labels={{
          label: settings.ui.testimonialsLabel,
          next: settings.ui.testimonialsNext,
          previous: settings.ui.testimonialsPrevious,
        }}
      />
    </section>
  )
}
