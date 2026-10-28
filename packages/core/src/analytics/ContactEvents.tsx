'use client'

import { useEffect } from 'react'

import { contactEventFor } from './contactEvent.js'
import { trackEvent } from './track.js'

/** Un sol escoltador delegat per a tots els enllaços de contacte de la pàgina (spec §22.5). */
export function ContactEvents() {
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const anchor = (event.target as Element | null)?.closest?.('a[href]')
      if (!anchor) return
      const name = contactEventFor(anchor.getAttribute('href') ?? '')
      if (name) trackEvent(name)
    }
    document.addEventListener('click', onClick, { capture: true })
    return () => document.removeEventListener('click', onClick, { capture: true })
  }, [])
  return null
}
